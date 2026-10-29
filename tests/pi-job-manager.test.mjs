import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createJobManager } from '../pi/lib/job-manager.mjs';

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
  return { calls, manager: createJobManager({ run, ...options }) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

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
  const manager = createJobManager({ run: (task, options) => new Promise((resolve, reject) => {
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
