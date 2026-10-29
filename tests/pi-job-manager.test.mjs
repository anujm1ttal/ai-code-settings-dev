import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJobManager } from '../pi/lib/job-manager.mjs';
import { createExpensiveGate } from '../pi/lib/expensive-gate.mjs';

const usage = (total) => ({ input: total, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: total,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } });
const okResult = (text = 'Source: a.mjs:1', total = 10) => ({ role: 'explorer', model: 'pilot-gpt/luna',
  thinking: 'medium', text, usage: usage(total), toolCounts: { read: 1 }, successfulReads: 1 });

// A controllable fake runner: each call returns a handle the test settles explicitly.
function harness(options = {}) {
  const calls = [];
  const run = (task, { signal }) => new Promise((resolve, reject) => {
    const call = { task, signal, resolve, reject, aborted: false };
    signal.addEventListener('abort', () => { call.aborted = true; }, { once: true });
    calls.push(call);
  });
  const budget = { reserve: () => ({}), settle: () => ({ usd: 0, overBudget: false }), snapshot: () => ({}) };
  return { calls, manager: createJobManager({ run, budget, gate: createExpensiveGate(), ...options }) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('terminal callback observes settled state after budget and gate release', async () => {
  const events = [];
  const gate = createExpensiveGate();
  let manager;
  const budget = { reserve: () => ({}), settle: () => { events.push('settled'); return { usd: 0.2 }; } };
  const env = harness({ gate, budget, onTerminal: (event) => {
    events.push({ ...event, observed: manager.status(event.id).state, gate: gate.active() });
  } });
  manager = env.manager;
  const job = manager.start('plan', { role: 'strategist' });
  assert.deepEqual(events, []);
  env.calls[0].resolve(okResult()); await tick();
  assert.deepEqual(events, ['settled', { id: job.id, role: 'strategist', state: 'succeeded', observed: 'succeeded', gate: undefined }]);
});

for (const role of ['explorer', 'strategist', 'auditor']) {
  for (const state of ['succeeded', 'failed', 'cancelled']) {
    test(`${role}: ${state} emits exactly once after settlement, not during status or collect`, async () => {
      const events = [];
      const { manager, calls } = harness({ onTerminal: event => events.push(event) });
      const job = manager.start('work', { role });
      manager.status(job.id); manager.collect(job.id);
      assert.deepEqual(events, []);
      if (state === 'cancelled') manager.cancel(job.id);
      if (state === 'succeeded') calls[0].resolve(okResult('private answer', 42));
      else calls[0].reject(new Error('private error'));
      await tick();
      assert.deepEqual(events, [{ id: job.id, role, state }]);
      const first = manager.collect(job.id); const second = manager.collect(job.id);
      manager.status(job.id); manager.cancel(job.id);
      assert.deepEqual(events, [{ id: job.id, role, state }]);
      if (state === 'succeeded') {
        assert.equal(first.usage.totalTokens, 42);
        assert.equal(second.usage, undefined);
      }
    });
  }
}

test('cancellation racing duplicate settlement emits exactly one notification', async () => {
  const events = [];
  const { manager, calls } = harness({ onTerminal: event => events.push(event) });
  const job = manager.start('race');
  manager.cancel(job.id); manager.cancel(job.id);
  calls[0].resolve(okResult()); calls[0].reject(new Error('too late'));
  await tick(); manager.cancel(job.id); await tick();
  assert.deepEqual(events, [{ id: job.id, role: 'explorer', state: 'succeeded' }]);
});

for (const method of ['discardAll', 'shutdown']) {
  test(`${method} suppresses discarded outcomes, with a fresh-job presence control`, async () => {
    const events = [];
    const { manager, calls } = harness({ onTerminal: event => events.push(event) });
    manager.start('discard success'); manager.start('discard failure');
    const draining = manager[method]();
    calls[0].resolve(okResult()); calls[1].reject(new Error('aborted'));
    await draining;
    assert.deepEqual(events, []);
    const control = method === 'shutdown' ? harness({ onTerminal: event => events.push(event) }) : { manager, calls };
    const job = control.manager.start('fresh');
    control.calls.at(-1).resolve(okResult()); await tick();
    assert.deepEqual(events, [{ id: job.id, role: 'explorer', state: 'succeeded' }]);
  });
  test(`${method} reports discarded cleanup-unconfirmed failures as quarantined`, async () => {
    const events = [];
    const gate = createExpensiveGate();
    const { manager, calls } = harness({ gate, onTerminal: event => events.push({ ...event, gate: gate.active() }) });
    const job = manager.start('stuck', { role: 'auditor' });
    const draining = manager[method]();
    calls[0].reject(new Error('cleanup unconfirmed')); await draining;
    assert.deepEqual(events, [{ id: job.id, role: 'auditor', state: 'failed', gate: 'background auditor job' }]);
    if (method === 'discardAll') assert.equal(manager.status(job.id).quarantined, true);
  });
}

test('throwing terminal callback preserves settlement, quarantine, budget and gate behavior', async () => {
  const { createJobBudget } = await import('../pi/lib/job-budget.mjs');
  async function run(withCallback, outcome) {
    const gate = createExpensiveGate(); let callbackCount = 0;
    const budget = createJobBudget({ perJobUsd: 1, perSessionUsd: 4,
      rates: { model: { inputPerMTok: 2, outputPerMTok: 4 } }, modelOf: () => 'model' });
    const { manager, calls } = harness({ gate, budget, ...(withCallback ? { onTerminal: () => {
      callbackCount++; throw new Error('notification failed');
    } } : {}) });
    const job = manager.start('expensive', { role: 'strategist' });
    if (outcome === 'success') calls[0].resolve({ ...okResult(), usage: { input: 100000, output: 0 } });
    else calls[0].reject(new Error('cleanup unconfirmed'));
    await tick();
    const collected = manager.collect(job.id);
    const repeat = manager.collect(job.id);
    return { callbackCount, state: collected.state, quarantined: collected.quarantined,
      usage: collected.usage, repeatUsage: repeat.usage, cost: collected.cost, gate: gate.active(), budget: manager.budgetSnapshot() };
  }
  for (const outcome of ['success', 'quarantine']) {
    const baseline = await run(false, outcome); const throwing = await run(true, outcome);
    assert.equal(throwing.callbackCount, 1);
    throwing.callbackCount = 0;
    assert.deepEqual(throwing, baseline);
  }
});

test('start returns an opaque job id immediately while the runner is still pending', async () => {
  const { manager, calls } = harness();
  const a = manager.start('Find callers');
  const b = manager.start('Find imports');
  assert.equal(calls.length, 2);
  assert.equal(a.state, 'running');
  assert.notEqual(a.id, b.id);
  assert.match(a.id, /^job-[A-Za-z0-9-]+$/);
  assert.equal(manager.collect(a.id).ready, false);
});

test('rejects a third active job before launching, then admits one after a job finishes', async () => {
  const { manager, calls } = harness();
  manager.start('one');
  const second = manager.start('two');
  assert.throws(() => manager.start('three'), /active|capacity|limit/i);
  assert.equal(calls.length, 2, 'rejected start must not launch');
  calls[1].resolve(okResult());
  await tick();
  assert.equal(manager.status(second.id).state, 'succeeded');
  manager.start('three');
  assert.equal(calls.length, 3);
});

test('collect is not_ready while running, then returns the result; usage is reported exactly once', async () => {
  const { manager, calls } = harness();
  const job = manager.start('Explore');
  assert.deepEqual(manager.collect(job.id), { id: job.id, state: 'running', role: 'explorer', ready: false });
  calls[0].resolve(okResult('Final answer', 42));
  await tick();
  const first = manager.collect(job.id);
  assert.equal(first.ready, true);
  assert.equal(first.state, 'succeeded');
  assert.equal(first.text, 'Final answer');
  assert.equal(first.usage.totalTokens, 42);
  assert.equal(first.usageReported, true);
  const second = manager.collect(job.id);
  assert.equal(second.text, 'Final answer');
  assert.equal(second.usage, undefined, 'repeat collect must not report usage again');
  assert.equal(second.usageReported, false);
});

test('evidence is checked after success and on every collection; absent evidence stays absent', async () => {
  const { manager, calls } = harness(); let checks = 0;
  const job = manager.start('audit', { role: 'auditor', evidence: { verify: () => { checks++; } } });
  const plain = manager.start('plain');
  calls[0].resolve(okResult()); calls[1].resolve(okResult()); await tick();
  assert.equal(checks, 1);
  assert.deepEqual(manager.collect(job.id).evidence, { status: 'VERIFIED' });
  assert.deepEqual(manager.collect(job.id).evidence, { status: 'VERIFIED' });
  assert.equal(checks, 3);
  assert.equal(Object.hasOwn(manager.collect(plain.id), 'evidence'), false);
});

test('throwing evidence checks never crash, stay incomplete and bound the reason', async () => {
  const { manager, calls } = harness(); let valid = false; let checks = 0;
  const job = manager.start('audit', { evidence: { verify: () => { checks++; if (!valid) throw new Error('x'.repeat(2000)); } } });
  calls[0].resolve(okResult()); await tick(); valid = true;
  const out = manager.collect(job.id);
  assert.equal(out.evidence.status, 'INCOMPLETE');
  assert.ok(out.evidence.reason.length <= 512);
  assert.equal(checks, 2);
  const later = manager.start('audit later', { evidence: { verify: () => { throw new Error('broken'); } } });
  calls[1].resolve(okResult()); await tick();
  assert.equal(manager.collect(later.id).evidence.status, 'INCOMPLETE');
});

test('an unprintable thrown evidence value cannot crash the manager', async () => {
  const { manager, calls } = harness();
  const job = manager.start('audit', { evidence: { verify: () => { throw Object.create(null); } } });
  calls[0].resolve(okResult()); await tick();
  assert.equal(manager.status(job.id).state, 'succeeded');
  assert.equal(manager.collect(job.id).evidence.status, 'INCOMPLETE');
});

test('a collect-time verification failure is retained on subsequent collections', async () => {
  const { manager, calls } = harness(); let valid = true;
  const job = manager.start('audit', { evidence: { verify: () => { if (!valid) throw new Error('changed'); } } });
  calls[0].resolve(okResult()); await tick(); valid = false;
  assert.deepEqual(manager.collect(job.id).evidence, { status: 'INCOMPLETE', reason: 'changed' });
  valid = true;
  assert.deepEqual(manager.collect(job.id).evidence, { status: 'INCOMPLETE', reason: 'changed' });
});

test('status is metadata only: it never returns text or usage and never consumes a result', async () => {
  const { manager, calls } = harness();
  const job = manager.start('Explore');
  calls[0].resolve(okResult('SECRET-RESULT', 99));
  await tick();
  const status = manager.status(job.id);
  assert.equal(JSON.stringify(status).includes('SECRET-RESULT'), false);
  assert.equal(status.usage, undefined);
  assert.equal(manager.collect(job.id).usageReported, true, 'status must not have consumed the usage');
  assert.deepEqual(manager.status().map(item => item.id), [job.id]);
});

test('a failed job reports its error and unknown usage, not zero', async () => {
  const { manager, calls } = harness();
  const job = manager.start('Explore');
  calls[0].reject(new Error('Unexpected model other/x; expected pilot-gpt/luna'));
  await tick();
  const result = manager.collect(job.id);
  assert.equal(result.state, 'failed');
  assert.match(result.error, /Unexpected model/);
  assert.equal(result.usage, null);
  assert.equal(result.usageUnknown, true);
  assert.equal(manager.collect(job.id).usageReported, false);
});

test('cancel aborts only that job; capacity is held until the runner settles', async () => {
  const { manager, calls } = harness();
  const a = manager.start('a');
  const b = manager.start('b');
  assert.equal(manager.cancel(a.id).state, 'cancelling');
  assert.equal(calls[0].aborted, true);
  assert.equal(calls[1].aborted, false);
  assert.throws(() => manager.start('c'), /active|capacity|limit/i, 'cancelling still counts as active');
  calls[0].reject(new Error('Agent dispatch aborted'));
  await tick();
  assert.equal(manager.status(a.id).state, 'cancelled');
  assert.equal(manager.status(b.id).state, 'running');
  assert.equal(manager.cancel(a.id).state, 'cancelled', 'cancel is idempotent');
  manager.start('c');
});

test('completion racing cancellation yields exactly one terminal state and keeps the result', async () => {
  const { manager, calls } = harness();
  const job = manager.start('race');
  manager.cancel(job.id);
  calls[0].resolve(okResult('finished anyway', 5));
  await tick();
  assert.equal(manager.status(job.id).state, 'succeeded');
  assert.equal(manager.collect(job.id).text, 'finished anyway');
  calls[0].reject(new Error('late rejection'));
  await tick();
  assert.equal(manager.status(job.id).state, 'succeeded', 'a late settle must not change the terminal state');
});

test('an unconfirmed-cleanup failure quarantines the slot instead of releasing capacity', async () => {
  const { manager, calls } = harness();
  const job = manager.start('stuck');
  manager.start('other');
  calls[0].reject(new Error('Pi explorer subagent timed out after 10 ms; cleanup unconfirmed: child did not close'));
  await tick();
  assert.equal(manager.status(job.id).state, 'failed');
  assert.equal(manager.status(job.id).quarantined, true);
  assert.throws(() => manager.start('blocked'), /active|capacity|limit|quarantine/i);
});

test('shutdown aborts every job, waits for them to settle, discards results and refuses new starts', async () => {
  const { manager, calls } = harness();
  const a = manager.start('a');
  manager.start('b');
  let done = false;
  const closing = manager.shutdown().then(() => { done = true; });
  await tick();
  assert.deepEqual(calls.map(call => call.aborted), [true, true]);
  assert.equal(done, false, 'must wait for runners to settle');
  calls[0].reject(new Error('Agent dispatch aborted'));
  calls[1].resolve(okResult());
  await closing;
  assert.throws(() => manager.status(a.id), /unknown|expired/i);
  assert.throws(() => manager.start('after'), /closed|shut/i);
  assert.equal(calls.length, 2);
});

test('discardAll cancels and clears jobs but reopens admission (tree navigation)', async () => {
  const { manager, calls } = harness();
  const a = manager.start('a');
  const pending = manager.discardAll();
  calls[0].reject(new Error('Agent dispatch aborted'));
  await pending;
  assert.throws(() => manager.collect(a.id), /unknown|expired/i);
  manager.start('after navigation');
  assert.equal(calls.length, 2);
});

test('validates task input before launching and bounds retained text', async () => {
  const { manager, calls } = harness();
  for (const bad of ['', '   ', 5, undefined, 'x'.repeat(4097), 'é'.repeat(2049)]) {
    assert.throws(() => manager.start(bad), /task/i);
  }
  assert.equal(calls.length, 0);
  assert.doesNotThrow(() => manager.start('é'.repeat(2048)));
  const job = manager.status()[0];
  calls[0].resolve(okResult('y'.repeat(70 * 1024)));
  await tick();
  const collected = manager.collect(job.id);
  assert.ok(Buffer.byteLength(collected.text) <= 64 * 1024 + 200);
  assert.equal(collected.truncated, true);
});

test('retained records are bounded: collected jobs are evicted oldest-first, uncollected ones block admission', async () => {
  const { manager, calls } = harness({ maxActive: 100, maxRetained: 3 });
  const ids = [];
  for (let i = 0; i < 3; i++) { ids.push(manager.start(`job ${i}`).id); calls[i].resolve(okResult(`r${i}`)); }
  await tick();
  assert.throws(() => manager.start('overflow'), /retained|uncollected|limit/i);
  manager.collect(ids[0]);
  manager.start('after eviction');
  assert.throws(() => manager.status(ids[0]), /unknown|expired/i, 'oldest collected job evicted');
  assert.equal(manager.collect(ids[1]).text, 'r1');
});

test('a job in flight during discardAll that fails with unconfirmed cleanup keeps its slot quarantined', async () => {
  const { manager, calls } = harness();
  const stuck = manager.start('stuck during tree navigation');
  manager.start('healthy');
  const pending = manager.discardAll();
  calls[0].reject(new Error('Agent dispatch aborted; cleanup unconfirmed: child did not close after forced termination'));
  calls[1].reject(new Error('Agent dispatch aborted'));
  await pending;
  assert.equal(manager.status(stuck.id).quarantined, true, 'quarantine must survive the discard');
  assert.equal(manager.status().length, 1, 'only the quarantined record remains');
  manager.start('uses the one free slot');
  assert.throws(() => manager.start('blocked'), /active|limit|quarantine/i);
});

test('eviction never removes a quarantined record, and a long runner error is bounded', async () => {
  const { manager, calls } = harness({ maxActive: 100, maxRetained: 2 });
  const stuck = manager.start('stuck');
  const normal = manager.start('normal');
  calls[0].reject(new Error(`cleanup unconfirmed ${'e'.repeat(10_000)}`));
  calls[1].resolve(okResult('fine'));
  await tick();
  assert.ok(manager.collect(stuck.id).error.length <= 2048 + 64, 'error text is bounded');
  manager.collect(normal.id);
  manager.start('evicts only the collected normal job');
  assert.equal(manager.status(stuck.id).quarantined, true);
  assert.throws(() => manager.status(normal.id), /unknown|expired/i);
});

test('the same admission key never launches twice', async () => {
  const { manager, calls } = harness();
  const first = manager.start('Explore', { key: 'tool-call-1' });
  const again = manager.start('Explore', { key: 'tool-call-1' });
  assert.equal(again.id, first.id);
  assert.equal(calls.length, 1);
});

test('role defaults to explorer and propagates through runner, status and all collect states', async () => {
  const calls = [];
  const budget = { reserve: () => ({}), settle: () => ({ usd: 0, overBudget: false }), snapshot: () => ({}) };
  const manager = createJobManager({ budget, gate: createExpensiveGate(), run: (task, options) => new Promise((resolve, reject) => {
    calls.push({ task, ...options, resolve, reject });
  }) });
  const explorer = manager.start('default', { context: { cwd: '/project' } });
  const strategist = manager.start('plan', { role: 'strategist', context: { cwd: '/other' } });
  assert.equal(explorer.role, 'explorer');
  assert.equal(strategist.role, 'strategist');
  assert.equal(calls[0].role, 'explorer');
  assert.equal(calls[1].role, 'strategist');
  assert.deepEqual(calls[1].context, { cwd: '/other' });
  assert.equal(manager.status(strategist.id).role, 'strategist');
  assert.equal(manager.status().find(job => job.id === explorer.id).role, 'explorer');
  assert.equal(manager.collect(strategist.id).role, 'strategist');
  calls[0].reject(new Error('failed'));
  calls[1].resolve(okResult());
  await tick();
  assert.equal(manager.collect(explorer.id).role, 'explorer');
  assert.equal(manager.collect(strategist.id).role, 'strategist');
  assert.equal(manager.collect(strategist.id).role, 'strategist');
});

test('unknown or foreign ids are rejected', () => {
  const { manager } = harness();
  for (const call of [() => manager.collect('job-nope'), () => manager.cancel('job-nope'),
    () => manager.status('job-nope'), () => manager.collect(undefined)]) {
    assert.throws(call, /unknown|expired|id/i);
  }
});

test('a runner that throws synchronously fails the job without leaking capacity', async () => {
  const manager = createJobManager({ run: () => { throw new Error('policy missing'); } });
  const job = manager.start('Explore');
  await tick();
  assert.equal(manager.status(job.id).state, 'failed');
  manager.start('again');
  manager.start('third');
});

test('expensive jobs require budget before launching; explorer remains exempt', () => {
  const { manager, calls } = harness({ budget: undefined });
  assert.throws(() => manager.start('plan', { role: 'strategist' }), /job budget is not configured/);
  assert.equal(calls.length, 0);
  manager.start('explore');
  assert.equal(calls.length, 1);
});

async function controlled() {
  const { createJobBudget } = await import('../pi/lib/job-budget.mjs');
  const { createExpensiveGate } = await import('../pi/lib/expensive-gate.mjs');
  const gate = createExpensiveGate();
  const budget = createJobBudget({ perJobUsd: 1, perSessionUsd: 4,
    rates: { model: { inputPerMTok: 2, outputPerMTok: 4 } }, modelOf: () => 'model' });
  return { ...harness({ gate, budget }), gate, budget };
}

test('an expensive start without a gate is denied before launching (fail closed), explorer is unaffected', async () => {
  const { manager, calls } = harness({ gate: undefined });
  assert.throws(() => manager.start('plan', { role: 'strategist' }), /gate/i);
  assert.equal(calls.length, 0);
  manager.start('explore');
  assert.equal(calls.length, 1);
});

test('gate excludes expensive jobs, explorer shares only two active slots, then gate releases', async () => {
  const { manager, calls, gate } = await controlled();
  const first = manager.start('plan', { role: 'strategist', key: 'one' });
  assert.equal(manager.lookup('one').id, first.id);
  assert.equal(manager.lookup('absent'), undefined);
  assert.equal(manager.start('', { key: 'one', role: 'auditor' }).id, first.id);
  assert.throws(() => manager.start('audit', { role: 'auditor' }), /Another expensive operation is active/);
  assert.equal(calls.length, 1);
  manager.start('explore');
  assert.throws(() => manager.start('third'), /Active job limit/);
  assert.equal(calls.length, 2);
  calls[0].resolve({ ...okResult(), usage: { input: 100000, output: 0 } }); await tick();
  assert.equal(gate.active(), undefined);
  assert.deepEqual(manager.collect(first.id).cost, { usd: 0.2, overBudget: false });
  assert.equal(manager.budgetSnapshot().spentUsd, 0.2);
  manager.start('audit', { role: 'auditor' });
  assert.equal(calls.length, 3);
});

test('failed and cancelled expensive work remains reserved; discard does not reset spend', async () => {
  const { manager, calls } = await controlled();
  const first = manager.start('plan', { role: 'strategist' });
  calls[0].resolve({ ...okResult(), usage: { input: 100000, output: 0 } }); await tick();
  const failed = manager.start('audit', { role: 'auditor' });
  calls[1].reject(new Error('failure')); await tick();
  assert.deepEqual(manager.collect(failed.id).cost, { unknown: true });
  const cancelled = manager.start('plan again', { role: 'strategist' });
  manager.cancel(cancelled.id); calls[2].reject(new Error('aborted')); await tick();
  assert.equal(manager.status(cancelled.id).state, 'cancelled');
  assert.deepEqual(manager.collect(cancelled.id).cost, { unknown: true });
  await manager.discardAll();
  assert.equal(manager.budgetSnapshot().spentUsd, 0.2);
  assert.equal(manager.budgetSnapshot().reservedUsd, 2);
  assert.throws(() => manager.status(first.id), /Unknown/);
});

test('discarded successful job is charged; quarantine holds the gate through discard', async () => {
  const { manager, calls, gate } = await controlled();
  manager.start('plan', { role: 'strategist' });
  const pending = manager.discardAll();
  calls[0].resolve({ ...okResult(), usage: { input: 100000, output: 0 } }); await pending;
  assert.equal(manager.budgetSnapshot().spentUsd, 0.2);
  manager.start('audit', { role: 'auditor' });
  const discard = manager.discardAll();
  calls[1].reject(new Error('cleanup unconfirmed')); await discard;
  assert.equal(gate.active(), 'background auditor job');
  assert.equal(manager.budgetSnapshot().reservedUsd, 1);
  assert.throws(() => manager.start('plan', { role: 'strategist' }), /Another expensive operation is active/);
  assert.equal(calls.length, 2);
});

test('failed budget reservation releases gate without launching', async () => {
  const { createExpensiveGate } = await import('../pi/lib/expensive-gate.mjs');
  const gate = createExpensiveGate();
  const { manager, calls } = harness({ gate, budget: { reserve() { throw new Error('denied'); } } });
  assert.throws(() => manager.start('plan', { role: 'strategist' }), /denied/);
  assert.equal(gate.active(), undefined);
  assert.equal(calls.length, 0);
});

const MARKER_ALLOWANCE = Buffer.byteLength('\n[truncated: 99999999 bytes omitted]');

test('error text is bounded in bytes: 2048 plus at most the truncation marker, multibyte safe', async () => {
  const { manager, calls } = harness();
  const job = manager.start('multibyte failure');
  calls[0].reject(new Error('é'.repeat(5000)));
  await tick();
  const { error } = manager.collect(job.id);
  assert.ok(Buffer.byteLength(error) <= 2048 + MARKER_ALLOWANCE, `got ${Buffer.byteLength(error)} bytes`);
  assert.match(error, /\[truncated: \d+ bytes omitted\]$/);
  assert.ok(!error.includes('\uFFFD'), 'no split multibyte character');
});

test('a discarded job failing with unconfirmed cleanup stores a bounded error', async () => {
  const { manager, calls } = harness();
  const stuck = manager.start('stuck during discard');
  const pending = manager.discardAll();
  calls[0].reject(new Error(`cleanup unconfirmed ${'x'.repeat(10_000)}`));
  await pending;
  const { error, quarantined } = manager.collect(stuck.id);
  assert.equal(quarantined, true);
  assert.ok(Buffer.byteLength(error) <= 2048 + MARKER_ALLOWANCE, `got ${Buffer.byteLength(error)} bytes`);
});

test('the runner cleanup-unconfirmed message is the one the manager quarantines on', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../pi/lib/role-runner.mjs', import.meta.url), 'utf8');
  const phrase = source.match(/[;,]\s*(cleanup unconfirmed[^`'"$]*)/i);
  assert.ok(phrase, 'role-runner.mjs must still emit a "cleanup unconfirmed" message');
  const { manager, calls } = harness();
  const job = manager.start('probe');
  calls[0].reject(new Error(`Agent dispatch aborted; ${phrase[1]}`));
  await tick();
  assert.equal(manager.status(job.id).quarantined, true);
  manager.start('control');
  calls[1].reject(new Error('Agent dispatch aborted; cleanup finished'));
  await tick();
  assert.equal(manager.status().filter((j) => j.quarantined).length, 1, 'a reworded message does not quarantine');
});
