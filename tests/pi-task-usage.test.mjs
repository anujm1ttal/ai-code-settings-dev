/*
 * PI-5 T5 proposed injectable, synchronous accounting API (all paths project-local):
 * createTaskUsage({ cwd, clock: () => milliseconds, rates, fault?: (phase) => void })
 * returns { bind({ taskId, sessionId, actor: 'parent' }), admit({ dispatchId, toolCallId }),
 *   record({ type, ...fields }), reconcile({ dispatchId, bytes, sha256 }),
 *   checkpoint(), status({ taskUid? }), close(), disable() }.
 * bind returns { taskUid }; admit freezes the current task and returns { dispatchKey }.
 * record types: parent { sessionId, callOrdinal, usage, kind }; child { dispatchKey,
 * callOrdinal, usage, stopReason }; output { destination, deliveryId, text }; warm-intent
 * { id }; warm-result { id, usage }. Duplicate dispatchKey/callOrdinal is idempotent.
 * status returns { status, totals: { promptInput, output, totalTokens, rateUsdLowerBound,
 * providerUsdLowerBound, deliveredBytes: { 'parent-model', 'calling-tool', 'child-model' } },
 * completeness: { tokens, rateCost, providerDollars, execution }, rows }.
 * rows are versioned allowlisted records with hashed identities and per-field missing flags;
 * the first row of each later segment has previousHash (SHA-256 of prior segment bytes).
 * status({ taskUid }) addresses a prior binding. checkpoint returns { path }; fault phases:
 * before-flush, after-flush, before-publish, after-publish, before-rotate, after-rotate.
 * Each test imports the not-yet-existing module dynamically. Extension integration must use
 * the same durable accounting boundary, not an in-memory result-only adapter.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto, { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { runRole } from '../pi/lib/role-runner.mjs';
import { loadRolePolicy } from '../pi/lib/role-policy.mjs';
import { createJobManager } from '../pi/lib/job-manager.mjs';
import { createJobBudget } from '../pi/lib/job-budget.mjs';
import { createExpensiveGate } from '../pi/lib/expensive-gate.mjs';
import * as resultContract from '../pi/lib/result-contract.mjs';
import { persistFullResult } from '../pi/lib/result-contract.mjs';

const rates = { model: { inputPerMTok: 2, outputPerMTok: 4, cacheReadPerMTok: 1, cacheWritePerMTok: 3 } };
const usage = { input: 10, output: 20, cacheRead: 3, cacheWrite: 8, totalTokens: 41 };
const usd = (10 * 2 + 20 * 4 + 3 + 8 * 3) / 1e6;
const tick = () => new Promise(resolve => setImmediate(resolve));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const cwd = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t5-')));
  fs.mkdirSync(path.join(cwd, 'Artifacts/.agent'), { recursive: true });
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}
const open = async cwd => (await import('../pi/lib/task-usage.mjs')).createTaskUsage({ cwd, rates, clock: () => 123456789 });
const bind = book => book.bind({ taskId: 'task-A', sessionId: 'session-1', actor: 'parent' });
const recordParent = (book, reading = usage, extra = {}) => book.record({ type: 'parent', sessionId: 'session-1',
  callOrdinal: 0, model: 'model', kind: 'normal', usage: reading, ...extra });
function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
function fakeSpawn(events) {
  return () => {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kill = () => true;
    queueMicrotask(() => { for (const event of events) child.stdout.write(JSON.stringify(event) + '\n');
      child.stdout.end(); child.stderr.end(); child.emit('close', 0); });
    return child;
  };
}
const policy = loadRolePolicy(new URL('./fixtures/pi-role-policy.json', import.meta.url));
function assistant(reading, stopReason) {
  return { type: 'message_end', message: { role: 'assistant', provider: 'pilot-gpt', model: 'sol',
    thinkingLevel: 'medium', stopReason, errorMessage: 'synthetic failure', content: [{ type: 'text', text: 'witness' }], usage: reading } };
}

test('failed admission precedes reservation and hides filesystem details', async () => {
  const budget = createJobBudget({ perJobUsd: 1, perSessionUsd: 1, rates, modelOf: () => 'model' });
  let fail = true, started = 0, reserves = 0;
  const reserve = budget.reserve;
  budget.reserve = (...args) => { reserves++; return reserve(...args); };
  const manager = createJobManager({ budget, gate: createExpensiveGate(),
    ledger: { admit() { if (fail) throw new Error('EACCES SECRET_PATH'); return { dispatchKey: 'control' }; } },
    run: async () => { started++; return { text: 'control', usage }; } });
  assert.throws(() => manager.start('work', { role: 'strategist' }), error => {
    assert.match(error.message, /INCOMPLETE/);
    assert.doesNotMatch(error.message, /EACCES|SECRET_PATH/);
    return true;
  });
  assert.equal(reserves, 0); assert.equal(started, 0); assert.equal(budget.snapshot().reservedUsd, 0);
  fail = false;
  const control = manager.start('work', { role: 'strategist' });
  assert.equal(control.state, 'running'); assert.equal(reserves, 1); assert.equal(started, 1);
  await tick();
});

test('task-origin-survives-rebind-and-reload', async t => {
  const cwd = fixture(t); assert.ok(fs.existsSync(path.join(cwd, 'Artifacts/.agent')));
  let book = await open(cwd); const a = bind(book);
  const dispatch = book.admit({ dispatchId: 'job-A', toolCallId: 'tool-A' });
  const b = book.bind({ taskId: 'task-B', sessionId: 'session-1', actor: 'parent' });
  assert.notEqual(a.taskUid, b.taskUid);
  book.record({ type: 'child', ...dispatch, callOrdinal: 0, model: 'model', usage, stopReason: 'stop' });
  book.record({ type: 'output', destination: 'parent-model', deliveryId: 'collect-1', text: 'café' });
  book.checkpoint(); book = await open(cwd);
  assert.equal(book.status({ taskUid: a.taskUid }).totals.rateUsdLowerBound, usd);
  assert.equal(book.status({ taskUid: b.taskUid }).totals.rateUsdLowerBound, 0);
  assert.equal(book.status({ taskUid: b.taskUid }).totals.deliveredBytes['parent-model'], Buffer.byteLength('café'));
  assert.equal(book.status({ taskUid: a.taskUid }).totals.deliveredBytes['parent-model'], 0);
  assert.throws(() => book.bind({ taskId: 'child-attempt', sessionId: 'child', actor: 'child' }), /parent/i);
});

test('per-call-unknown-is-not-free', async t => {
  const cwd = fixture(t); assert.equal(Object.keys(usage).length, 5);
  const book = await open(cwd); bind(book); recordParent(book);
  const unknowns = [null, { ...usage, input: -1 }, { ...usage, output: Infinity },
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }, { ...usage, cacheRead: undefined }];
  for (const [i, reading] of unknowns.entries()) recordParent(book, reading, { callOrdinal: i + 1 });
  const s = book.status({});
  assert.equal(s.totals.rateUsdLowerBound, usd); assert.equal(s.completeness.tokens, 'INCOMPLETE');
  assert.equal(s.completeness.rateCost, 'INCOMPLETE');
  assert.equal(s.rows.filter(row => row.type === 'parent').length, 6);
  const absent = s.rows.find(row => row.callOrdinal === 5);
  assert.equal(absent.missing.cacheRead, true); assert.equal(absent.missing.input, false);
  assert.equal(s.rows.find(row => row.callOrdinal === 0).missing.cacheRead, false);
  for (const field of ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens', 'reasoning', 'cacheWrite1h'])
    assert.equal(typeof absent.missing[field], 'boolean', `missing flag for ${field}`);
});

test('provider-cost-absence-does-not-zero-estimate', async t => {
  const cwd = fixture(t); assert.ok(usd > 0);
  const book = await open(cwd); bind(book); recordParent(book);
  let s = book.status({}); assert.equal(s.totals.rateUsdLowerBound, usd);
  assert.equal(s.completeness.rateCost, 'COMPLETE'); assert.equal(s.completeness.providerDollars, 'INCOMPLETE');
  recordParent(book, { ...usage, cost: { total: 0.123 } }, { callOrdinal: 1 });
  s = book.status({}); assert.equal(s.totals.rateUsdLowerBound, 2 * usd);
  assert.equal(s.totals.providerUsdLowerBound, 0.123); assert.equal(s.completeness.providerDollars, 'INCOMPLETE');
});

test('reasoning-and-cacheWrite1h-are-subsets', async t => {
  const cwd = fixture(t); assert.equal(usage.input + usage.cacheRead + usage.cacheWrite, 21);
  const book = await open(cwd); bind(book);
  recordParent(book, { ...usage, reasoning: 7, cacheWrite1h: 5 });
  let s = book.status({}); assert.equal(s.totals.promptInput, 21); assert.equal(s.totals.output, 20);
  assert.equal(s.totals.totalTokens, 41); assert.equal(s.totals.rateUsdLowerBound, usd);
  recordParent(book, usage, { callOrdinal: 1 });
  s = book.status({}); assert.equal(s.rows.find(r => r.callOrdinal === 1).missing.reasoning, true);
  assert.equal(s.rows.find(r => r.callOrdinal === 1).missing.cacheWrite1h, true);
  recordParent(book, { ...usage, reasoning: 0, cacheWrite1h: 0 }, { callOrdinal: 2 });
  s = book.status({}); assert.equal(s.rows.find(r => r.callOrdinal === 2).missing.reasoning, false);
  assert.equal(s.rows.find(r => r.callOrdinal === 2).missing.cacheWrite1h, false);
  recordParent(book, { ...usage, reasoning: 0, cacheWrite1h: 9 }, { callOrdinal: 3 });
  recordParent(book, { ...usage, reasoning: 21, cacheWrite1h: 0 }, { callOrdinal: 4 });
  s = book.status({}); assert.equal(s.totals.rateUsdLowerBound, 3 * usd);
  assert.equal(s.completeness.tokens, 'INCOMPLETE');
});

test('failed-sync-and-council-retain-earlier-calls', async t => {
  const cwd = fixture(t);
  const events = [assistant(usage, 'toolUse'), assistant({ ...usage, input: 4 }, 'error')];
  let failure;
  try { await runRole(policy, 'coder', 'fixture', cwd, '/prompt', { spawnImpl: fakeSpawn(events),
    invocation: { command: 'fixture', args: [] } }); } catch (error) { failure = error; }
  assert.ok(failure); assert.deepEqual(failure.usageCalls.map(c => c.usage.input), [10, 4]);
  const accounting = await import('../pi/lib/task-usage.mjs');
  const book = accounting.createTaskUsage({ cwd, rates, clock: () => 123456789 }); bind(book);
  const source = fs.readFileSync(new URL('../pi/extensions/role-agent.ts', import.meta.url), 'utf8');
  const js = stripTypeScriptTypes(source).replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;[ \t]*$/gm, '')
    .replace("const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');", "const sourceRoot = '/fixture';")
    .replace(/export default function \(pi\s*\)/, 'function register(pi)') + '\nregister';
  const tools = new Map();
  const fakeRole = async () => { throw Object.assign(new Error('sync failed'), {
    partial: true, usageCalls: failure.usageCalls, partialText: 'sync witness' }); };
  const fakeCouncil = async () => { throw Object.assign(new Error('council failed'), {
    perspectives: [{ perspective: 'strategist', usageCalls: failure.usageCalls }],
    usageCalls: failure.usageCalls, partialText: 'council witness' }); };
  const sandbox = { ...fs, ...path, ...crypto, ...resultContract, ...accounting, fs, path, crypto, Buffer,
    process: { env: { PI_ROLE_POLICY_PATH: path.resolve('fixture-policy.json') } },
    Type: { Object: () => ({}), String: () => ({}), Union: () => ({}), Literal: () => ({}), Optional: () => ({}) },
    loadRolePolicy: () => policy, runRole: fakeRole, runCouncilPerspective: fakeRole,
    runCouncilSession: fakeCouncil, registerExplorerJobs: () => {}, createExpensiveGate: () => ({}),
    withExpensiveGate: async (_gate, _label, run) => run() };
  runInNewContext(js, sandbox)({ registerTool: tool => tools.set(tool.name, tool), registerCommand: () => {}, on: () => {} });
  await assert.rejects(tools.get('pi_role_agent').execute('sync-call', { role: 'coder', task: 'work' }, undefined, undefined, { cwd }));
  await assert.rejects(tools.get('pi_council').execute('council-call', { question: 'work' }, undefined, undefined, { cwd }));
  const journal = files(path.join(cwd, 'Artifacts/.agent/pi-accounting')).filter(f => /events-.*\.jsonl$/.test(f));
  assert.ok(journal.length, 'calls are durable before any collection or checkpoint');
  const childRows = journal.flatMap(f => fs.readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse))
    .filter(row => row.type === 'child');
  assert.ok(childRows.length >= 4, 'failed sync and council calls must both be journaled');
  assert.ok(childRows.some(row => row.usage?.input === 4), 'failed call numeric presence control');
  assert.equal(book.status({}).completeness.execution, 'INCOMPLETE');
});

test('settlement-collection-replay-charge-once', async t => {
  const cwd = fixture(t); const dir = path.join(cwd, 'Artifacts/.agent/pi-results');
  const budget = createJobBudget({ perJobUsd: 1, perSessionUsd: 3, rates, modelOf: () => 'model' });
  let settlements = 0; const actualSettle = budget.settle;
  budget.settle = (...args) => { settlements++; return actualSettle(...args); };
  let resolve, reject;
  const manager = createJobManager({ budget, gate: createExpensiveGate(), run: () => new Promise((a, b) => { resolve = a; reject = b; }) });
  const good = manager.start('work', { role: 'strategist', context: { cwd } });
  const receipt = persistFullResult({ dir, dispatchId: good.id, role: 'strategist', completeness: 'complete', text: 'answer' });
  resolve({ text: 'answer', usage, usageCalls: [{ usage, completeness: 'known' }], persisted: receipt }); await tick();
  const file = path.join(dir, `${good.id}.settlement.json`); const bytes = fs.readFileSync(file);
  assert.ok(bytes.length > 0); assert.equal(settlements, 1); assert.equal(manager.status(good.id).collected, undefined);
  let book = await open(cwd); const task = bind(book);
  const d = book.admit({ dispatchId: good.id, toolCallId: 'good' });
  book.record({ type: 'child', ...d, callOrdinal: 0, model: 'model', usage, stopReason: 'stop' });
  book.reconcile({ dispatchId: good.id, bytes, sha256: sha(bytes) });
  const bad = manager.start('failure', { role: 'strategist', context: { cwd } });
  const badReceipt = persistFullResult({ dir, dispatchId: bad.id, role: 'strategist', completeness: 'partial', text: 'partial' });
  reject(Object.assign(new Error('failed'), { persisted: badReceipt, usageCalls: [{ usage, completeness: 'known' }] })); await tick();
  assert.equal(budget.snapshot().reservedUsd, 1); assert.equal(settlements, 2);
  const failed = book.admit({ dispatchId: bad.id, toolCallId: 'bad' });
  book.record({ type: 'child', ...failed, callOrdinal: 0, model: 'model', usage, stopReason: 'error' });
  const failedBytes = fs.readFileSync(path.join(dir, `${bad.id}.settlement.json`));
  book.reconcile({ dispatchId: bad.id, bytes: failedBytes, sha256: sha(failedBytes) });
  for (let i = 0; i < 2; i++) {
    const out = manager.collect(good.id); book.reconcile({ dispatchId: good.id, bytes, sha256: sha(bytes) });
    book.record({ type: 'output', destination: 'parent-model', deliveryId: `collection-${i}`, text: out.text });
  }
  assert.equal(settlements, 2); assert.equal(book.status({}).totals.rateUsdLowerBound, 2 * usd);
  assert.ok(book.status({}).totals.deliveredBytes['parent-model'] > 2 * Buffer.byteLength('answer'));
  book.checkpoint(); book = await open(cwd);
  assert.equal(book.status({ taskUid: task.taskUid }).totals.rateUsdLowerBound, 2 * usd);
  const conflictCwd = path.join(cwd, 'conflict-control'); fs.mkdirSync(path.join(conflictCwd, 'Artifacts/.agent'), { recursive: true });
  let control = await open(conflictCwd); const controlTask = bind(control);
  const controlDispatch = control.admit({ dispatchId: good.id, toolCallId: 'control' });
  control.record({ type: 'child', ...controlDispatch, callOrdinal: 0, model: 'model', usage, stopReason: 'stop' });
  control.reconcile({ dispatchId: good.id, bytes, sha256: sha(bytes) });
  assert.equal(control.status({}).completeness.execution, 'COMPLETE', 'valid observation control');
  const conflicting = Buffer.from(bytes.toString().replace('succeeded', 'failed'));
  assert.notDeepEqual(conflicting, bytes);
  control.reconcile({ dispatchId: good.id, bytes: conflicting, sha256: sha(conflicting) });
  control.reconcile({ dispatchId: good.id, bytes, sha256: sha(bytes) });
  assert.equal(control.status({}).completeness.execution, 'INCOMPLETE');
  control.checkpoint(); control = await open(conflictCwd);
  assert.equal(control.status({ taskUid: controlTask.taskUid }).completeness.execution, 'INCOMPLETE');
  assert.deepEqual(fs.readFileSync(file), bytes); assert.equal(settlements, 2);
});

test('auxiliary-and-abandoned-branch-usage-count-once', async t => {
  const cwd = fixture(t); assert.equal(usage.totalTokens, 41);
  const book = await open(cwd); bind(book);
  for (const [i, kind] of ['normal', 'compaction', 'branch_summary', 'cache-warm', 'unrecognized'].entries())
    recordParent(book, usage, { callOrdinal: i, kind, branchId: i === 2 ? 'abandoned' : 'current' });
  recordParent(book, usage, { callOrdinal: 2, kind: 'branch_summary', branchId: 'abandoned' });
  book.record({ type: 'warm-intent', id: 'unresolved' });
  let s = book.status({}); assert.equal(s.totals.totalTokens, 5 * 41);
  assert.equal(s.rows.filter(r => r.type === 'parent' && r.kind === 'other').length, 1);
  assert.equal(s.completeness.execution, 'INCOMPLETE');
  book.record({ type: 'warm-result', id: 'unresolved', usage });
  s = book.status({}); assert.equal(s.totals.totalTokens, 6 * 41);
});

test('final-output-bytes-are-not-event-counts', async t => {
  const cwd = fixture(t); const text = 'café 🚀'; assert.equal(Buffer.byteLength(text), 10);
  const book = await open(cwd); bind(book);
  for (const event of ['update', 'result', 'end']) book.record({ type: 'output', destination: 'parent-model',
    deliveryId: 'same-delivery', event, text });
  book.record({ type: 'output', destination: 'calling-tool', deliveryId: 'nested-1', text });
  book.record({ type: 'output', destination: 'child-model', deliveryId: 'nested-2', text: 'é' });
  const out = book.status({}).totals.deliveredBytes;
  assert.equal(out['parent-model'], 10); assert.equal(out['calling-tool'], 10); assert.equal(out['child-model'], 2);
});

test('checkpoint-precedes-rotation-and-recovers-crashes', async t => {
  const cwd = fixture(t); const log = path.join(cwd, 'Artifacts/.agent/pi-audit.jsonl');
  const old = JSON.stringify({ ts: '2026-10-28T10:00:00.000Z', tool: 'read', outcome: 'ok' }) + '\n';
  fs.writeFileSync(log, old.repeat(1500)); const before = fs.readFileSync(log); assert.ok(before.length > 65536);
  const { createTaskUsage } = await import('../pi/lib/task-usage.mjs');
  for (const phase of ['before-flush', 'after-flush', 'before-publish', 'after-publish', 'before-rotate', 'after-rotate']) {
    const sub = path.join(cwd, phase); fs.mkdirSync(path.join(sub, 'Artifacts/.agent'), { recursive: true });
    const rolling = path.join(sub, 'Artifacts/.agent/pi-audit.jsonl'); fs.writeFileSync(rolling, before);
    let book = createTaskUsage({ cwd: sub, rates, clock: () => 123456789, fault: p => { if (p === phase) throw new Error(phase); } });
    const task = bind(book);
    for (let i = 0; i < 1000; i++) recordParent(book, usage, { callOrdinal: i });
    assert.throws(() => book.checkpoint(), new RegExp(phase));
    const checkpoints = files(path.join(sub, 'Artifacts/.agent/pi-accounting')).filter(f => /checkpoint-\d+\.json$/.test(f));
    if (['before-flush', 'after-flush', 'before-publish'].includes(phase)) {
      assert.deepEqual(fs.readFileSync(rolling), before); assert.equal(checkpoints.length, 0);
    } else {
      assert.ok(checkpoints.length > 0); assert.ok(fs.readFileSync(checkpoints.at(-1)).length > 0);
      if (phase === 'after-publish' || phase === 'before-rotate') assert.deepEqual(fs.readFileSync(rolling), before);
      if (phase === 'after-rotate') assert.ok(fs.statSync(rolling).size <= 65536);
    }
    book = createTaskUsage({ cwd: sub, rates, clock: () => 123456789 });
    const recovered = book.status({ taskUid: task.taskUid });
    assert.ok(recovered.totals.totalTokens <= 41000);
    if (recovered.totals.totalTokens !== 41000) assert.notEqual(recovered.status, 'COMPLETE');
    const segments = files(path.join(sub, 'Artifacts/.agent/pi-accounting')).filter(f => /events-.*\.jsonl$/.test(f))
      .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    assert.ok(segments.length > 1); for (const segment of segments) assert.ok(fs.statSync(segment).size <= 65536);
    const firstRows = segments.map(f => JSON.parse(fs.readFileSync(f, 'utf8').trim().split('\n')[0]));
    for (let i = 1; i < segments.length; i++) assert.equal(firstRows[i].previousHash, sha(fs.readFileSync(segments[i - 1])));
  }
});

test('secret-sentinels-never-enter-accounting', async t => {
  const cwd = fixture(t); const secret = 'PI_T5_SECRET_f84ab9'; const log = path.join(cwd, 'Artifacts/.agent/pi-audit.jsonl');
  fs.writeFileSync(log, JSON.stringify({ ts: `2026-10-28T10:00:00.000Z-${secret}`, tool: 'bash', outcome: 'ok', command: secret }) + '\n');
  assert.ok(fs.readFileSync(log, 'utf8').includes(secret), 'legacy contamination presence control');
  const book = await open(cwd); book.bind({ taskId: secret, sessionId: secret, actor: 'parent', prompt: secret, path: secret });
  const dispatch = book.admit({ dispatchId: secret, toolCallId: secret, prompt: secret });
  book.record({ type: 'child', ...dispatch, callOrdinal: 0, model: 'model', usage: { ...usage, extra: secret,
    provider: secret, cost: { total: 0.2, extra: secret } }, stopReason: 'error', error: secret, path: secret });
  book.record({ type: 'output', destination: 'parent-model', deliveryId: secret, text: secret });
  book.checkpoint();
  const targets = [...files(path.join(cwd, 'Artifacts/.agent/pi-accounting')), log];
  assert.ok(targets.some(f => /events-.*\.jsonl$/.test(f))); assert.ok(targets.some(f => /checkpoint-\d+\.json$/.test(f)));
  for (const file of targets) assert.equal(fs.readFileSync(file, 'utf8').includes(secret), false, file);
  assert.equal(book.status({}).totals.totalTokens, 41);
});

test('pre-start-rejections-settle-once-without-poisoning-execution', async t => {
  for (const reason of ['gate busy', 'budget exceeded']) {
    const cwd = fixture(t); let book = await open(cwd); const task = bind(book);
    recordParent(book, { ...usage, cost: { total: 0.1 } });
    const gate = createExpensiveGate(); const release = reason === 'gate busy' ? gate.tryAcquire('control') : undefined;
    const budget = createJobBudget({ perJobUsd: 1, perSessionUsd: reason === 'budget exceeded' ? 0 : 1, rates, modelOf: () => 'model' });
    let settlements = 0, started = 0; const settle = budget.settle;
    budget.settle = (...args) => { settlements++; return settle(...args); };
    const manager = createJobManager({ gate, budget, ledger: book, run: async () => { started++; } });
    assert.throws(() => manager.start('work', { role: 'strategist', context: { cwd } }), /active|budget/i, reason);
    assert.equal(started, 0); assert.equal(settlements, 0);
    assert.equal(budget.snapshot().spentUsd, 0); assert.equal(budget.snapshot().reservedUsd, 0);
    let status = book.status(); const admits = status.rows.filter(r => r.type === 'admit');
    assert.equal(admits.length, 1, 'admission presence control');
    let terminals = status.rows.filter(r => r.type === 'settlement');
    assert.equal(terminals.length, 1); assert.equal(terminals[0].state, 'not-started');
    assert.equal(terminals[0].dispatchKey, admits[0].dispatchKey);
    assert.equal(status.completeness.execution, 'COMPLETE');
    book.markNotStarted({ dispatchKey: admits[0].dispatchKey });
    book = await open(cwd); status = book.status({ taskUid: task.taskUid });
    terminals = status.rows.filter(r => r.type === 'settlement');
    assert.equal(terminals.length, 1, 'terminal is durable and exactly once');
    assert.equal(status.completeness.execution, 'COMPLETE'); release?.();
  }
  const cwd = fixture(t); const book = await open(cwd); bind(book);
  recordParent(book, { ...usage, cost: { total: 0.1 } });
  const budget = createJobBudget({ perJobUsd: 1, perSessionUsd: 1, rates, modelOf: () => 'model' });
  let settlements = 0; const settle = budget.settle; budget.settle = (...args) => { settlements++; return settle(...args); };
  const manager = createJobManager({ gate: createExpensiveGate(), budget, ledger: book, run: async (_task, options) => {
    book.record({ type: 'child', dispatchKey: options.dispatchKey, callOrdinal: 0, model: 'model', usage: { ...usage, cost: { total: 0.1 } }, stopReason: 'stop' });
    const persisted = persistFullResult({ dir: options.resultStore.dir, dispatchId: options.dispatchId, role: 'strategist', completeness: 'complete', text: 'answer' });
    return { text: 'answer', usage, persisted };
  } });
  const job = manager.start('work', { role: 'strategist', context: { cwd } }); await tick();
  assert.equal(manager.status(job.id).state, 'succeeded'); assert.equal(settlements, 1);
  const status = book.status(); assert.equal(status.completeness.execution, 'COMPLETE');
  assert.deepEqual(status.rows.filter(r => r.type === 'settlement').map(r => r.state), ['succeeded']);
  assert.ok(budget.snapshot().spentUsd > 0);
});

test('not-started-terminal-rejects-an-observed-child', async t => {
  const cwd = fixture(t); const book = await open(cwd); bind(book); recordParent(book);
  const { dispatchKey } = book.admit({ dispatchId: 'started-control', toolCallId: 'started-control' });
  book.record({ type: 'child', dispatchKey, callOrdinal: 0, model: 'model', usage, stopReason: 'stop' });
  assert.throws(() => book.markNotStarted({ dispatchKey }), /already started/i);
  const status = book.status();
  assert.equal(status.rows.filter(row => row.type === 'child').length, 1);
  assert.equal(status.rows.filter(row => row.type === 'settlement').length, 0);
  assert.equal(status.completeness.execution, 'INCOMPLETE');
});

test('rotation-preserves-valid-audit-rows-in-order', async t => {
  const cwd = fixture(t); const log = path.join(cwd, 'Artifacts/.agent/pi-audit.jsonl');
  const book = await open(cwd); bind(book); recordParent(book); book.checkpoint();
  const prior = JSON.parse(fs.readFileSync(log, 'utf8').trim());
  const row = i => ({ ts: new Date(Date.UTC(2026, 9, 28, 10, 0, i)).toISOString(), tool: i % 2 ? 'write' : 'read', outcome: 'ok' });
  const validRows = [row(1), prior, row(2)];
  const invalid = { ts: 'SECRET-invalid', tool: 'bash', outcome: 'ok', command: 'SECRET' };
  fs.writeFileSync(log, [...validRows, invalid].map(JSON.stringify).join('\n') + '\n');
  book.checkpoint();
  let bytes = fs.readFileSync(log); let rows = bytes.toString().trim().split('\n').map(JSON.parse);
  assert.deepEqual(rows.slice(0, -1), validRows);
  assert.equal(rows.at(-1).type, 'checkpoint'); assert.equal(rows.at(-1).sequence, 2);
  assert.ok(bytes.length <= 65536); assert.doesNotMatch(bytes.toString(), /SECRET/);
  const many = Array.from({ length: 1800 }, (_, i) => row(i));
  fs.writeFileSync(log, many.map(JSON.stringify).join('\n') + '\n');
  assert.ok(fs.statSync(log).size > 65536);
  book.checkpoint(); bytes = fs.readFileSync(log); rows = bytes.toString().trim().split('\n').map(JSON.parse);
  const retained = rows.slice(0, -1);
  assert.ok(retained.length > 0 && retained.length < many.length);
  assert.deepEqual(retained, many.slice(-retained.length));
  assert.equal(rows.at(-1).type, 'checkpoint'); assert.equal(rows.at(-1).sequence, 3);
  assert.ok(bytes.length <= 65536);
});

test('torn-events-tail-is-incomplete-and-append-throws', async t => {
  const cwd = fixture(t); let book = await open(cwd); const task = bind(book);
  recordParent(book, usage, { callOrdinal: 0 }); recordParent(book, usage, { callOrdinal: 1 });
  assert.equal(book.status().completeness.execution, 'COMPLETE', 'intact journal presence control');
  const journal = files(path.join(cwd, 'Artifacts/.agent/pi-accounting')).find(f => /events-0\.jsonl$/.test(f));
  const original = fs.readFileSync(journal); const firstEnd = original.indexOf(10) + 1;
  const torn = original.subarray(0, firstEnd + Math.floor((original.length - firstEnd) / 2));
  assert.ok(torn.length > firstEnd && torn.at(-1) !== 10); fs.writeFileSync(journal, torn);
  book = await open(cwd); const status = book.status({ taskUid: task.taskUid });
  assert.equal(status.status, 'INCOMPLETE'); assert.equal(status.completeness.execution, 'INCOMPLETE');
  assert.equal(status.rows.filter(r => r.type === 'parent').length, 1);
  assert.equal(status.totals.totalTokens, 41);
  book.restore({ taskUid: task.taskUid, sessionId: 'session-1' });
  assert.throws(() => recordParent(book, usage, { callOrdinal: 2 }), /incomplete/i);
  assert.deepEqual(fs.readFileSync(journal), torn);
});

test('zero-usage-call-alone-is-unknown-not-free', async t => {
  const cases = [
    { name: 'positive control', reading: usage, known: true },
    { name: 'all zero', reading: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 }, known: false },
    { name: 'zero without totalTokens', reading: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, known: false },
  ];
  for (const { name, reading, known } of cases) {
    const cwd = fixture(t); let book = await open(cwd); const task = bind(book);
    const dispatch = book.admit({ dispatchId: 'job', toolCallId: 'tool' });
    book.record({ type: 'child', ...dispatch, callOrdinal: 0, model: 'model', usage: reading, stopReason: 'stop' });
    const journal = files(path.join(cwd, 'Artifacts/.agent/pi-accounting')).filter(f => /events-.*\.jsonl$/.test(f));
    const persisted = journal.flatMap(f => fs.readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse))
      .filter(row => row.type === 'child');
    assert.equal(persisted.length, 1, `${name}: one persisted child call`);
    assert.equal(persisted[0].known, known, `${name}: persisted known`);
    assert.equal(persisted[0].rateKnown, known, `${name}: persisted rateKnown`);
    for (const phase of ['live', 'reload']) {
      if (phase === 'reload') book = await open(cwd);
      const s = book.status({ taskUid: task.taskUid });
      const children = s.rows.filter(row => row.type === 'child');
      assert.equal(children.length, 1, `${name} ${phase}: one child call`);
      assert.equal(children[0].known, known, `${name} ${phase}: known`);
      assert.equal(children[0].rateKnown, known, `${name} ${phase}: rateKnown`);
      assert.equal(children[0].missing.totalTokens, !Object.hasOwn(reading, 'totalTokens'), `${name} ${phase}: totalTokens presence`);
      assert.equal(s.completeness.tokens, known ? 'COMPLETE' : 'INCOMPLETE', `${name} ${phase}: tokens`);
      assert.equal(s.completeness.rateCost, known ? 'COMPLETE' : 'INCOMPLETE', `${name} ${phase}: rate cost`);
      assert.equal(s.totals.rateUsdLowerBound, known ? usd : 0, `${name} ${phase}: rate USD lower bound`);
      if (!known) {
        assert.equal(s.totals.providerUsdLowerBound, 0, `${name} ${phase}: provider USD lower bound`);
        assert.equal(s.totals.totalTokens, 0, `${name} ${phase}: known tokens`);
      }
    }
  }
});

test('tiered rates price each recorded request in its own tier, never from the task running total', async t => {
  const cwd = fixture(t);
  const tiered = { status: 'verified', cacheWriteRetention: '5m', tiers: [
    { upToPromptTokens: 100, inputPerMTok: 1, outputPerMTok: 2, cacheReadPerMTok: 0, cacheWritePerMTok: 1 },
    { inputPerMTok: 10, outputPerMTok: 20, cacheReadPerMTok: 0, cacheWritePerMTok: 10 }] };
  const book = (await import('../pi/lib/task-usage.mjs')).createTaskUsage({ cwd, rates: { model: tiered }, clock: () => 123456789 });
  bind(book);
  const small = { input: 60, output: 10, cacheRead: 0, cacheWrite: 0, totalTokens: 70 };
  recordParent(book, small, { callOrdinal: 0 });
  recordParent(book, small, { callOrdinal: 1 }); // 120 prompt tokens in total, but each request is 60
  recordParent(book, { input: 500, output: 10, cacheRead: 0, cacheWrite: 0, totalTokens: 510 }, { callOrdinal: 2 });
  const total = book.status({}).totals.rateUsdLowerBound;
  assert.ok(Math.abs(total - (2 * (60 * 1 + 10 * 2) + (500 * 10 + 10 * 20)) / 1e6) < 1e-12, String(total));
  assert.equal(book.status({}).completeness.rateCost, 'COMPLETE');
});

test('rate identity changes when cache-write retention prices change, and legacy flat rate identity is unchanged', async t => {
  const cwd = fixture(t);
  const { createTaskUsage } = await import('../pi/lib/task-usage.mjs');
  const keyFor = (rate, dir) => {
    const book = createTaskUsage({ cwd: path.join(cwd, dir), rates: { model: rate }, clock: () => 123456789 });
    bind(book); recordParent(book, usage);
    return book.status({}).rows.find(r => r.rateKey)?.rateKey;
  };
  for (const d of ['a', 'a2', 'b', 'c']) fs.mkdirSync(path.join(cwd, d, 'Artifacts/.agent'), { recursive: true });
  const flat = { inputPerMTok: 2, outputPerMTok: 4, cacheReadPerMTok: 1, cacheWritePerMTok: 3 };
  const base = keyFor(flat, 'a');
  assert.ok(base);
  assert.equal(keyFor({ ...flat }, 'a2'), base); // same legacy prices, same identity
  const withRetention = keyFor({ ...flat, cacheWriteRetention: '5m', cacheWriteByRetention: { '1h': 5 } }, 'b');
  const other = keyFor({ ...flat, cacheWriteRetention: '5m', cacheWriteByRetention: { '1h': 6 } }, 'c');
  assert.notEqual(withRetention, base); assert.notEqual(withRetention, other);
});

test('tiered rate identity depends on per-tier cache-write retention prices', async t => {
  const cwd = fixture(t);
  const { createTaskUsage } = await import('../pi/lib/task-usage.mjs');
  const mk = oneHour => ({ status: 'verified', cacheWriteRetention: '5m', tiers: [
    { upToPromptTokens: 100, inputPerMTok: 1, outputPerMTok: 2, cacheReadPerMTok: 0, cacheWritePerMTok: 1, cacheWriteByRetention: { '1h': oneHour } },
    { inputPerMTok: 10, outputPerMTok: 20, cacheReadPerMTok: 0, cacheWritePerMTok: 10 }] });
  const keyFor = (rate, dir) => {
    fs.mkdirSync(path.join(cwd, dir, 'Artifacts/.agent'), { recursive: true });
    const book = createTaskUsage({ cwd: path.join(cwd, dir), rates: { model: rate }, clock: () => 123456789 });
    bind(book); recordParent(book, usage);
    return book.status({}).rows.find(r => r.rateKey)?.rateKey;
  };
  const a = keyFor(mk(2), 'a'); const b = keyFor(mk(3), 'b'); const a2 = keyFor({ ...mk(2), source: 'other label' }, 'c');
  assert.ok(a); assert.notEqual(a, b); assert.equal(a, a2); // labels do not change identity, prices do
});

test('legacy flat rate identity is pinned to the original four-price hash', async t => {
  const cwd = fixture(t);
  const { createTaskUsage } = await import('../pi/lib/task-usage.mjs');
  const flat = { inputPerMTok: 2, outputPerMTok: 4, cacheReadPerMTok: 1, cacheWritePerMTok: 3 };
  const book = createTaskUsage({ cwd, rates: { model: flat }, clock: () => 123456789 });
  bind(book); recordParent(book, usage);
  const actual = book.status({}).rows.find(r => r.rateKey)?.rateKey;
  // The original identity: SHA-256 over JSON.stringify(['rate', JSON.stringify([input, output, cacheRead, cacheWrite])]).
  const expected = createHash('sha256').update(Buffer.from(JSON.stringify(['rate', JSON.stringify([2, 4, 1, 3])]))).digest('hex');
  assert.equal(actual, expected);
});

