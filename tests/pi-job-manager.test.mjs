import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJobManager } from '../pi/lib/job-manager.mjs';
import { createExpensiveGate } from '../pi/lib/expensive-gate.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { persistFullResult, buildEnvelope } from '../pi/lib/result-contract.mjs';

const usage = (total) => ({ input: total, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: total,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } });
const okResult = (text = 'Source: a.mjs:1', total = 10) => ({ role: 'explorer', model: 'pilot-gpt/luna',
  thinking: 'medium', text, usage: usage(total), toolCounts: { read: 1 }, successfulReads: 1 });

// A controllable fake runner: each call returns a handle the test settles explicitly.
function harness(options = {}) {
  const calls = [];
  const run = (task, options) => new Promise((resolve, reject) => {
    const { signal } = options;
    const call = { task, ...options, resolve, reject, aborted: false };
    signal.addEventListener('abort', () => { call.aborted = true; }, { once: true });
    calls.push(call);
  });
  const budget = { reserve: () => ({}), settle: () => ({ usd: 0, overBudget: false }), snapshot: () => ({}) };
  return { calls, manager: createJobManager({ run, budget, gate: createExpensiveGate(), ...options }) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

function resultFixture(t) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t4-manager-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'Artifacts', '.agent', 'pi-results');
  fs.mkdirSync(dir, { recursive: true });
  return { root, dir };
}
function issued(dir, id, role = 'explorer', text = 'real retained work', completeness = 'complete') {
  const persisted = persistFullResult({ dir, dispatchId: id, role, completeness, text });
  const envelope = buildEnvelope({ status: completeness === 'complete' ? 'COMPLETE' : 'INCOMPLETE',
    persisted, identity: { dispatchId: id, role }, summarySource: text });
  return { persisted, envelope };
}
function completed(value) { return { ...okResult(value.envelope), ...value }; }

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

test('receipt handoff never parses envelope labels', async (t) => {
  const { root, dir } = resultFixture(t);
  const { manager, calls } = harness({ maxActive: 10 });
  const start = () => manager.start('identity', { context: { cwd: root } });
  const good = start(); const real = issued(dir, good.id);
  const fakeRef = path.join(dir, 'counterfeit.result');
  calls[0].resolve({ ...completed(real), text: `full result persisted at ${fakeRef} sha256 ${'a'.repeat(64)}` });
  await tick();
  const valid = manager.collect(good.id); const failures = [];
  try {
    assert.ok(valid.text.includes(real.persisted.ref) && valid.text.includes(real.persisted.sha256), 'verified receipt descriptor must win over inline labels');
    assert.ok(!valid.text.includes(fakeRef), 'counterfeit descriptor must not be trusted');
  } catch (error) { failures.push(error.message); }
  for (const kind of ['clone', 'json', 'role', 'dispatch']) {
    const job = start();
    const correct = issued(dir, job.id, kind === 'role' ? 'auditor' : 'explorer');
    const foreign = kind === 'dispatch' ? issued(dir, `${job.id}-foreign`) : correct;
    const receipt = kind === 'clone' ? { ...correct.persisted } : kind === 'json'
      ? JSON.parse(JSON.stringify(correct.persisted)) : foreign.persisted;
    calls.at(-1).resolve({ ...completed(correct), persisted: receipt }); await tick();
    const out = manager.collect(job.id);
    try {
      assert.match(JSON.stringify(out), /INCOMPLETE/, `${kind} receipt must be rejected`);
      assert.ok(!String(out.text ?? '').includes(receipt.sha256), `${kind} receipt must not be accepted as descriptor`);
    } catch (error) { failures.push(error.message); }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('terminal settlement accounts once without collection', async (t) => {
  const { root, dir } = resultFixture(t); const failures = [];
  for (const role of ['explorer', 'strategist', 'auditor']) for (const state of ['succeeded', 'failed', 'cancelled']) {
    try {
    let charges = 0; const events = [];
    const budget = { reserve: () => ({}), settle: () => { charges++; return { usd: 0.1 }; }, snapshot: () => ({}) };
    const { manager, calls } = harness({ budget, onTerminal: event => events.push({ ...event,
      settlementPresent: fs.existsSync(path.join(dir, `${event.id}.settlement.json`)), charges }) });
    const job = manager.start('work', { role, context: { cwd: root } });
    const witness = issued(dir, job.id, role, `work ${role} ${state}`, state === 'succeeded' ? 'complete' : 'partial');
    if (state === 'cancelled') manager.cancel(job.id);
    if (state === 'succeeded') calls[0].resolve(completed(witness));
    else { const error = Object.assign(new Error('interrupted'), witness, { partialText: 'work' }); calls[0].reject(error); }
    await tick();
    const file = path.join(dir, `${job.id}.settlement.json`);
    assert.equal(events.length, 1, `${role}/${state}: one terminal notification`);
    assert.equal(charges, role === 'explorer' ? 0 : 1, `${role}/${state}: exactly one budget settlement`);
    assert.ok(fs.existsSync(file), `${role}/${state}: settlement must exist before collect`);
    assert.equal(events[0].settlementPresent, true, 'notification follows settlement publication');
    assert.equal(events[0].charges, role === 'explorer' ? 0 : 1, 'notification follows budget settlement');
    const bytes = fs.readFileSync(file); assert.ok(bytes.length > 0, 'settlement presence control');
    assert.ok(bytes.toString().includes(witness.persisted.sha256), 'settlement binds the receipt');
    manager.status(job.id); manager.collect(job.id); manager.collect(job.id); manager.cancel(job.id); await tick();
    assert.deepEqual(fs.readFileSync(file), bytes, 'settlement cannot be replaced on repeated actions');
    assert.equal(events.length, 1); assert.equal(charges, role === 'explorer' ? 0 : 1);
    } catch (error) { failures.push(`${role}/${state}: ${error.message}`); }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('drain and eviction retain execution evidence', async (t) => {
  const { root, dir } = resultFixture(t); const failures = [];
  for (const method of ['discardAll', 'shutdown']) for (const outcome of ['success', 'failure', 'cancel']) {
    try {
    const events = []; const { manager, calls } = harness({ maxRetained: 2, onTerminal: e => events.push(e) });
    const done = manager.start('completed', { context: { cwd: root } });
    const doneReceipt = issued(dir, done.id); calls[0].resolve(completed(doneReceipt)); await tick();
    assert.equal(events.length, 1, 'completed notification presence control');
    manager.collect(done.id);
    const uncollected = manager.start('uncollected completion', { context: { cwd: root } });
    const uncollectedReceipt = issued(dir, uncollected.id); calls[1].resolve(completed(uncollectedReceipt)); await tick();
    const running = manager.start('racing drain', { context: { cwd: root } });
    assert.throws(() => manager.status(done.id), /unknown|expired/i, 'collected job was evicted');
    const racing = issued(dir, running.id, 'explorer', 'race work', outcome === 'success' ? 'complete' : 'partial');
    if (outcome === 'cancel') manager.cancel(running.id);
    const before = events.length; const drain = manager[method]();
    if (outcome === 'success') calls[2].resolve(completed(racing));
    else calls[2].reject(Object.assign(new Error(outcome === 'cancel' ? 'aborted' : 'runner failed'), racing, { partialText: 'race work' }));
    await drain;
    assert.equal(events.length, before, 'discarded race must not notify');
    const fresh = method === 'shutdown' ? harness({ onTerminal: e => events.push(e) }) : { manager, calls };
    const control = fresh.manager.start('fresh', { context: { cwd: root } });
    const witness = issued(dir, control.id); fresh.calls.at(-1).resolve(completed(witness)); await tick();
    assert.equal(events.at(-1).id, control.id, 'fresh notification presence control');
    for (const [job, receipt] of [[done, doneReceipt], [uncollected, uncollectedReceipt], [running, racing]]) {
      assert.ok(fs.existsSync(receipt.persisted.ref), `${method}: retained result ${job.id}`);
      assert.ok(fs.existsSync(path.join(dir, `${job.id}.settlement.json`)), `${method}: retained settlement ${job.id}`);
    }
    } catch (error) { failures.push(`${method}/${outcome}: ${error.message}`); }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('collection detects result mutation independently of evidence', async (t) => {
  const { root, dir } = resultFixture(t); let charges = 0; let checks = 0; const failures = [];
  const budget = { reserve: () => ({}), settle: () => { charges++; return { usd: 0 }; }, snapshot: () => ({}) };
  const { manager, calls } = harness({ budget });
  for (const mutation of ['unchanged', 'append', 'delete']) {
    const job = manager.start('audit', { role: 'auditor', context: { cwd: root }, evidence: { verify: () => { checks++; } } });
    const witness = issued(dir, job.id, 'auditor', `witness ${mutation}`);
    calls.at(-1).resolve(completed(witness)); await tick();
    if (mutation === 'append') fs.appendFileSync(witness.persisted.ref, 'tampered');
    if (mutation === 'delete') fs.unlinkSync(witness.persisted.ref);
    const before = charges; const out = manager.collect(job.id); manager.collect(job.id);
    assert.equal(charges, before, 'collection must not charge again');
    assert.ok(checks > 0, 'independent evidence check presence control');
    try {
      if (mutation === 'unchanged') assert.ok(String(out.text).includes(witness.persisted.sha256), 'unchanged result accepted');
      else assert.match(JSON.stringify(out), /INCOMPLETE/, `${mutation} must invalidate the result`);
    } catch (error) { failures.push(error.message); }
  }
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('retention failure cannot silently discard partial work', async (t) => {
  const { root, dir } = resultFixture(t);
  const { manager, calls } = harness({ maxRetained: 1 });
  const job = manager.start('partial', { context: { cwd: root } });
  const text = 'café🚀'.repeat(100) + 'UNIQUE-PARTIAL-TAIL';
  const occupied = path.join(dir, `${job.id}.result`);
  fs.writeFileSync(occupied, 'pre-existing sentinel');
  let error;
  try { persistFullResult({ dir, dispatchId: job.id, role: 'explorer', completeness: 'partial', text }); }
  catch (cause) { error = cause; }
  assert.equal(error?.code, 'PERSIST_FAILED', 'exclusive write collision injects a real persistence failure');
  calls[0].reject(error); await tick();
  const first = manager.collect(job.id);

  const other = harness({ maxRetained: 1 });
  const settled = other.manager.start('settlement collision', { context: { cwd: root } });
  const witness = issued(dir, settled.id, 'explorer', 'settlement recovery');
  const settlement = path.join(dir, `${settled.id}.settlement.json`);
  fs.writeFileSync(settlement, 'pre-existing settlement');
  other.calls[0].resolve(completed(witness)); await tick();
  const collision = other.manager.collect(settled.id);
  await other.manager.discardAll();
  let collisionAfterDrain;
  try { collisionAfterDrain = other.manager.collect(settled.id); } catch (cause) { collisionAfterDrain = { error: cause.message }; }
  assert.match(JSON.stringify(first), /INCOMPLETE/, 'persistence failure must remain incomplete');
  assert.ok(JSON.stringify(first).includes('UNIQUE-PARTIAL-TAIL'), 'partial work must remain recoverable');
  assert.throws(() => manager.start('cannot evict recovery', { context: { cwd: root } }), /retained|recovery|limit/i);
  await manager.discardAll();
  const again = manager.collect(job.id);
  assert.match(JSON.stringify(again), /INCOMPLETE/);
  assert.ok(JSON.stringify(again).includes('UNIQUE-PARTIAL-TAIL'));
  assert.equal(fs.readFileSync(occupied, 'utf8'), 'pre-existing sentinel', 'failed write must not overwrite the existing file');
  assert.match(JSON.stringify(collision), /INCOMPLETE/, 'settlement write failure must be incomplete');
  assert.match(JSON.stringify(collisionAfterDrain), /INCOMPLETE/, 'settlement recovery survives drain');
  assert.equal(fs.readFileSync(settlement, 'utf8'), 'pre-existing settlement', 'exclusive settlement must not overwrite');
  assert.ok(fs.existsSync(witness.persisted.ref), 'settlement failure retains the full result witness');
});

// Characterization coverage: these five tests already passed before the step 3 changes.
test('step3 receipt mutation stays incomplete after restore without another charge', async (t) => {
  const { root, dir } = resultFixture(t); let charges = 0;
  const budget = { reserve: () => ({}), settle: () => { charges++; return { usd: 0.1 }; } };
  const { manager, calls } = harness({ budget });
  const job = manager.start('review', { role: 'auditor', context: { cwd: root } });
  const witness = issued(dir, job.id, 'auditor', 'Verdict: PASS original');
  calls[0].resolve(completed(witness)); await tick();
  const original = fs.readFileSync(witness.persisted.ref);
  assert.match(manager.collect(job.id).text, /Status: COMPLETE/);
  fs.appendFileSync(witness.persisted.ref, 'changed');
  assert.match(manager.collect(job.id).text, /Status: INCOMPLETE/);
  fs.writeFileSync(witness.persisted.ref, original);
  assert.match(manager.collect(job.id).text, /Status: INCOMPLETE/);
  assert.equal(charges, 1);
});

test('step3 recovery offset pages reconstruct multibyte partial work', async (t) => {
  const { root } = resultFixture(t); const { manager, calls } = harness();
  const job = manager.start('partial', { context: { cwd: root } });
  const partialText = 'café🚀漢'.repeat(700) + 'tail';
  calls[0].reject(Object.assign(new Error('failed'), { code: 'PERSIST_FAILED', partialText })); await tick();
  let offset = 0, text = '', pages = 0;
  do {
    const page = manager.collect(job.id, { recoveryOffset: offset });
    assert.ok(Buffer.byteLength(page.text) <= 2048);
    text += page.text.slice(page.text.indexOf('\n') + 1);
    offset = page.nextRecoveryOffset; pages++;
  } while (offset !== null);
  assert.ok(pages > 1);
  assert.equal(text, partialText);
});

test('step3 existing equal settlement is accepted and different bytes require recovery', async (t) => {
  const { root, dir } = resultFixture(t);
  for (const equal of [true, false]) {
    const { manager, calls } = harness();
    const job = manager.start('settlement', { context: { cwd: root } });
    const witness = issued(dir, job.id, 'explorer', 'settlement witness');
    const file = path.join(dir, `${job.id}.settlement.json`);
    const link = fs.linkSync;
    fs.linkSync = (src, dest) => {
      if (dest === file) fs.writeFileSync(file, equal ? fs.readFileSync(src) : 'different sentinel', { flag: 'wx' });
      return link(src, dest);
    };
    try { calls[0].resolve(completed(witness)); await tick(); }
    finally { fs.linkSync = link; }
    const bytes = fs.readFileSync(file);
    const out = manager.collect(job.id);
    assert.match(out.text, equal ? /Status: COMPLETE/ : /Status: INCOMPLETE/);
    if (!equal) {
      assert.equal(bytes.toString(), 'different sentinel');
      await manager.discardAll();
      assert.match(manager.collect(job.id).text, /Status: INCOMPLETE/);
    }
    assert.deepEqual(fs.readFileSync(file), bytes);
  }
});

test('step3 missing cwd makes expensive job collection incomplete', async () => {
  const { manager, calls } = harness();
  const job = manager.start('plan', { role: 'strategist' });
  calls[0].resolve(okResult('Verdict: PASS')); await tick();
  const out = manager.collect(job.id);
  assert.match(out.text, /Status: INCOMPLETE/);
  assert.match(out.text, /Project result store unavailable/);
  assert.ok(Buffer.byteLength(out.text) <= 2048);
});

test('step3 long result reference falls back to bounded incomplete collection', async (t) => {
  const { root, dir } = resultFixture(t); let longRoot = root;
  while (longRoot.length < 2150) { longRoot = path.join(longRoot, 'r'.repeat(60)); fs.mkdirSync(longRoot); }
  const { manager, calls } = harness();
  const job = manager.start('long reference', { context: { cwd: longRoot } });
  const longDir = path.join(longRoot, 'Artifacts', '.agent', 'pi-results');
  const persisted = persistFullResult({ dir: longDir, dispatchId: job.id, role: 'explorer',
    completeness: 'complete', text: 'result control' });
  const witness = { persisted };
  calls[0].resolve({ ...okResult('result control'), persisted }); await tick();
  const out = manager.collect(job.id);
  assert.match(out.text, /^Status: INCOMPLETE/m);
  assert.match(out.text, /Persisted reference cannot be represented/);
  assert.ok(Buffer.byteLength(out.text) <= 2048);
  assert.ok(fs.existsSync(witness.persisted.ref));
});

test('step3 collected result exposes summary and findings alongside verified descriptor', async (t) => {
  const { root, dir } = resultFixture(t); const { manager, calls } = harness();
  const job = manager.start('review', { role: 'auditor', context: { cwd: root } });
  const text = 'Verdict: FAIL distinct finding';
  const witness = issued(dir, job.id, 'auditor', text);
  calls[0].resolve({ ...completed(witness), text }); await tick();
  const out = manager.collect(job.id);
  assert.match(out.text, /^Summary: Verdict: FAIL distinct finding$/m);
  assert.match(out.text, /^Findings: Verdict: FAIL distinct finding$/m);
  assert.ok(out.text.includes(witness.persisted.ref));
  assert.ok(out.text.includes(witness.persisted.sha256));
  assert.ok(Buffer.byteLength(out.text) <= 2048);
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
