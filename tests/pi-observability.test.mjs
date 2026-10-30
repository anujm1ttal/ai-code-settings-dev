import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import { test } from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const extensionPath = path.join(root, 'pi/extensions/session-observability.ts');

async function handlers() {
  assert.ok(fs.existsSync(extensionPath), 'Pi session/audit extension must exist');
  const { default: register } = await import(pathToFileURL(extensionPath).href);
  const events = new Map();
  register({ on(type, handler) { events.set(type, handler); } });
  return events;
}

test('audit sanitizes a short pre-existing log rather than preserving legacy command text', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t15-short-legacy-'));
  try {
    const agent = path.join(project, 'Artifacts/.agent');
    fs.mkdirSync(agent, { recursive: true });
    const file = path.join(agent, 'pi-audit.jsonl');
    const secret = 'PI_T15_OLD_COMMAND_SECRET';
    fs.writeFileSync(file, JSON.stringify({ ts: '2026-10-28T10:00:00.000Z', tool: 'bash',
      outcome: 'ok', command: `echo ${secret}` }) + '\n');
    await (await handlers()).get('tool_result')({ toolName: 'read', input: {}, isError: false }, { cwd: project });
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), new RegExp(secret));
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test('retention rejects legacy rows with secret-bearing timestamp fields', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t15-legacy-'));
  try {
    const agent = path.join(project, 'Artifacts/.agent');
    fs.mkdirSync(agent, { recursive: true });
    const file = path.join(agent, 'pi-audit.jsonl');
    const old = JSON.stringify({ ts: '2026-10-28T10:00:00.000Z', tool: 'read', outcome: 'ok' }) + '\n';
    const secret = 'PI_T15_LEGACY_SECRET';
    fs.writeFileSync(file, old.repeat(2000) + JSON.stringify({
      ts: `2026-10-28T10:00:00.000Z-${secret}`, tool: 'bash', outcome: 'ok', command: secret,
    }) + '\n');
    await (await handlers()).get('tool_result')({ toolName: 'read', input: {}, isError: false }, { cwd: project });
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), new RegExp(secret));
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test('audit metadata has a strict 64 KiB retention cap and does not scaffold foreign projects', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t15-cap-'));
  const foreign = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t15-foreign-'));
  try {
    const agent = path.join(project, 'Artifacts/.agent');
    fs.mkdirSync(agent, { recursive: true });
    const file = path.join(agent, 'pi-audit.jsonl');
    const old = JSON.stringify({ ts: '2026-10-28T10:00:00.000Z', tool: 'read', outcome: 'ok' }) + '\n';
    const recent = JSON.stringify({ ts: '2026-10-28T10:00:01.000Z', tool: 'write', outcome: 'ok' }) + '\n';
    fs.writeFileSync(file, old.repeat(4000) + recent.repeat(20));
    const result = (await handlers()).get('tool_result');
    await result({ toolName: 'read', input: { path: 'src/a' }, isError: true }, { cwd: project });
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(Buffer.byteLength(text) <= 65536);
    const rows = text.trim().split('\n').map(JSON.parse);
    assert.equal(rows.at(-1).outcome, 'error');
    assert.ok(rows.some(row => row.tool === 'write'), 'retain recent validated rows');
    assert.equal(rows.some(row => row.ts === 'old'), false);
    await result({ toolName: 'bash', input: { command: 'echo secret' }, isError: false }, { cwd: foreign });
    assert.equal(fs.existsSync(path.join(foreign, 'Artifacts')), false);
  } finally { fs.rmSync(project, { recursive: true, force: true }); fs.rmSync(foreign, { recursive: true, force: true }); }
});

test('completed-tool audit logs metadata but never command, path or result secrets', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t15-audit-'));
  const secret = 'PI_T15_SYNTHETIC_SECRET_8d4b';
  try {
    fs.mkdirSync(path.join(project, 'Artifacts/.agent'), { recursive: true });
    const events = await handlers();
    await events.get('tool_result')({ toolName: 'bash', toolCallId: 'opaque-1', isError: false,
      input: { command: `echo ${secret}`, path: `src/${secret}.py` },
      content: [{ type: 'text', text: secret }] }, { cwd: project });
    const log = fs.readFileSync(path.join(project, 'Artifacts/.agent/pi-audit.jsonl'), 'utf8');
    const row = JSON.parse(log.trim());
    assert.equal(row.tool, 'bash');
    assert.equal(row.outcome, 'ok');
    assert.ok(row.ts);
    assert.doesNotMatch(log, new RegExp(secret));
    assert.doesNotMatch(log, /echo|src\/|opaque-1/);
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test('state truncation never splits a UTF-8 code point', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t15-utf8-'));
  try {
    const agent = path.join(project, 'Artifacts/.agent');
    fs.mkdirSync(agent, { recursive: true });
    fs.writeFileSync(path.join(agent, 'current_task.md'), 'A'.repeat(1899) + 'é' + 'B'.repeat(600));
    const events = await handlers();
    await events.get('session_start')({ reason: 'startup' }, { cwd: project });
    const content = (await events.get('before_agent_start')({ messageType: 'user', prompt: 'test' }, { cwd: project }))?.message?.content;
    assert.ok(content?.includes('[truncated; read'));
    assert.ok(Buffer.byteLength(content) <= 2000);
    assert.equal(content.includes('\uFFFD'), false);
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test('Pi session recovery supplies a bounded task brief once per session', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t15-brief-'));
  try {
    const agent = path.join(project, 'Artifacts/.agent');
    fs.mkdirSync(agent, { recursive: true });
    fs.writeFileSync(path.join(agent, 'current_task.md'), '# Current Task\n' + 'A'.repeat(2400));
    const events = await handlers();
    const context = { cwd: project };
    await events.get('session_start')({ reason: 'startup' }, context);
    assert.equal(await events.get('before_agent_start')({ messageType: 'custom', message: {} }, context), undefined);
    const first = await events.get('before_agent_start')({ messageType: 'user', prompt: 'next' }, context);
    assert.match(first?.message?.content ?? '', /Current Task/);
    assert.ok(Buffer.byteLength(first.message.content, 'utf8') <= 2000);
    assert.equal(await events.get('before_agent_start')({ messageType: 'user', prompt: 'again' }, context), undefined);
    await events.get('session_start')({ reason: 'new' }, context);
    assert.ok((await events.get('before_agent_start')({ messageType: 'user', prompt: 'new' }, context))?.message);
    await events.get('session_start')({ reason: 'new' }, { cwd: root });
    assert.equal(await events.get('before_agent_start')({ messageType: 'user', prompt: 'foreign' },
      { cwd: path.join(project, 'unrelated') }), undefined);
  } finally { fs.rmSync(project, { recursive: true, force: true }); }
});

test('disable-retains-results-and-preview-stages-helper', async (t) => {
  const project = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t5-disable-')));
  const sandbox = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t5-preview-')));
  t.after(() => { fs.rmSync(project, { recursive: true, force: true }); fs.rmSync(sandbox, { recursive: true, force: true }); });
  fs.writeFileSync(path.join(sandbox, '.pi-pilot-sandbox'), 'pi-t16-isolated\n');
  const { stagePreview, rollbackPreview } = await import('../pi/lib/release-preview.mjs');
  const staged = stagePreview({ sourceRoot: root, sandboxRoot: sandbox });
  assert.ok(fs.existsSync(path.join(staged.destination, 'pi/lib/role-runner.mjs')), 'existing staged dependency presence control');
  const resultDir = path.join(project, 'Artifacts/.agent/pi-results'); fs.mkdirSync(resultDir, { recursive: true });
  const resultFile = path.join(resultDir, 'retained.result'); fs.writeFileSync(resultFile, 'retained result control');
  const resultBefore = fs.readFileSync(resultFile);
  const { createTaskUsage } = await import('../pi/lib/task-usage.mjs');
  const book = createTaskUsage({ cwd: project, rates: {}, clock: () => 123456789 });
  book.bind({ taskId: 'task', sessionId: 'session', actor: 'parent' });
  book.record({ type: 'parent', sessionId: 'session', callOrdinal: 0, kind: 'normal', model: 'model',
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2 } });
  const checkpoint = book.checkpoint(); const checkpointBefore = fs.readFileSync(checkpoint.path);
  assert.ok(checkpointBefore.length > 0);
  book.disable();
  assert.deepEqual(fs.readFileSync(checkpoint.path), checkpointBefore);
  assert.deepEqual(fs.readFileSync(resultFile), resultBefore);
  assert.ok(fs.existsSync(path.join(staged.destination, 'pi/lib/task-usage.mjs')), 'preview must stage accounting helper');
  assert.deepEqual(fs.readFileSync(path.join(staged.destination, 'pi/lib/task-usage.mjs')),
    fs.readFileSync(path.join(root, 'pi/lib/task-usage.mjs')));
  rollbackPreview(staged);
});

test('minimal Pi observability registers session, context and completed-tool hooks', async () => {
  const events = await handlers();
  for (const name of ['session_start', 'before_agent_start', 'tool_result']) {
    assert.equal(typeof events.get(name), 'function', name);
  }
  assert.equal(events.has('agent_before_settle'), false, 'no automatic completion nag');
});

// The command fixture models branch-local Pi custom entries, not a provider or live TUI.
async function taskCommandFixture(cwd, { child = false } = {}) {
  const { default: register } = await import(pathToFileURL(extensionPath).href);
  const events = new Map(); const commands = new Map(); const messages = []; const entries = [];
  const ctx = { cwd, hasUI: true, ui: { notify(text) { messages.push(text); } },
    sessionManager: { getSessionId: () => 'session-control', getSessionFile: () => child ? undefined : 'session.jsonl',
      getHeader: () => ({ id: 'session-control' }), getLeafId: () => entries.at(-1)?.id ?? null,
      getBranch: () => [...entries] } };
  register({ on(name, handler) { events.set(name, handler); },
    registerCommand(name, spec) { commands.set(name, spec.handler); },
    appendEntry(customType, data) { entries.push({ type: 'custom', id: `entry-${entries.length + 1}`, customType, data }); } });
  const run = async args => {
    assert.equal(typeof commands.get('pi-task'), 'function', '/pi-task must be registered');
    await commands.get('pi-task')(args, ctx);
    return messages.at(-1) ?? '';
  };
  return { ctx, entries, events, messages, run };
}

const TASK_BIND_ARGS = 'bind synthetic-task synthetic-model 1 2 0.1 0.2';

test('pi-task bind persists and reload reconstructs only the active branch', async t => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-task-bind-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, 'Artifacts'));
  const first = await taskCommandFixture(project);
  await first.run(TASK_BIND_ARGS);
  const { getActiveTaskUsage } = await import('../pi/lib/task-usage.mjs');
  const ledger = getActiveTaskUsage(project, 'session-control');
  assert.ok(ledger, 'binding activates ledger');
  const uid = ledger.status().rows;
  assert.ok(Array.isArray(uid));
  assert.ok(first.entries.length, 'session entry identifies binding boundary');
  const accounting = path.join(project, 'Artifacts/.agent/pi-accounting');
  const files = fs.readdirSync(accounting, { recursive: true }).filter(name => name.endsWith('.json'));
  const persisted = files.map(name => fs.readFileSync(path.join(accounting, name), 'utf8')).join('\n') + JSON.stringify(first.entries);
  assert.doesNotMatch(persisted, /synthetic-task|synthetic-model|bind synthetic/);
  await first.events.get('session_shutdown')?.({}, first.ctx);
  const second = await taskCommandFixture(project);
  second.entries.push(...first.entries);
  await second.events.get('session_start')({}, second.ctx);
  assert.ok(getActiveTaskUsage(project, 'session-control'), 'reloaded binding is active');
  assert.match(await second.run('status'), /INCOMPLETE/);
  second.entries.length = 0;
  await second.events.get('session_tree')({}, second.ctx);
  assert.equal(getActiveTaskUsage(project, 'session-control'), undefined, 'abandoned branch is unassigned');
  assert.match(await second.run('status'), /unassigned|INCOMPLETE/i);
});

test('pi-task invalid bind arguments are rejected without writes or echoes', async t => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-task-invalid-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, 'Artifacts'));
  const f = await taskCommandFixture(project);
  for (const args of ['bind task model prose 2 3 4', 'bind task model NaN 2 3 4',
    'bind task model -1 2 3 4', 'bind task model 1e999 2 3 4',
    'bind task model 999999999999999999999 2 3 4', 'bind task model 1 2 3 4 extra']) {
    assert.match(await f.run(args), /invalid|usage|error/i);
  }
  assert.deepEqual(fs.readdirSync(path.join(project, 'Artifacts')), []);
  assert.deepEqual(f.entries, []);
  assert.doesNotMatch(f.messages.join('\n'), /prose|999999999999999999999/);
});

test('pi-task does not scaffold a project without Artifacts', async t => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-task-foreign-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  const f = await taskCommandFixture(project);
  for (const args of [TASK_BIND_ARGS, 'checkpoint', 'close', 'status']) await f.run(args);
  assert.equal(fs.existsSync(path.join(project, 'Artifacts')), false);
  assert.deepEqual(f.entries, []);
});

test('pi-task commands are no-ops in a child session', async t => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-task-child-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, 'Artifacts'));
  const f = await taskCommandFixture(project, { child: true });
  for (const args of [TASK_BIND_ARGS, 'checkpoint', 'close', 'status']) await f.run(args);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.entries, []);
  assert.deepEqual(fs.readdirSync(path.join(project, 'Artifacts')), []);
});

test('pi-task checkpoint and close report outstanding dispatches without acceptance', async t => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-task-close-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, 'Artifacts'));
  const f = await taskCommandFixture(project);
  await f.run(TASK_BIND_ARGS);
  const { getActiveTaskUsage } = await import('../pi/lib/task-usage.mjs');
  const ledger = getActiveTaskUsage(project, 'session-control');
  const { dispatchKey } = ledger.admit({ dispatchId: 'dispatch-control', toolCallId: 'tool-control' });
  await f.run('checkpoint');
  assert.ok(fs.existsSync(path.join(project, 'Artifacts/.agent/pi-audit.jsonl')));
  const close = await f.run('close');
  assert.match(close, /outstanding/i);
  assert.ok(close.includes(dispatchKey));
  assert.match(close, /INCOMPLETE/);
  assert.match(close, /not.*accept|accept.*not/i);
});

test('pi-task status is bounded numeric metadata, not raw ledger rows', async t => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-task-status-'));
  t.after(() => fs.rmSync(project, { recursive: true, force: true }));
  fs.mkdirSync(path.join(project, 'Artifacts'));
  const f = await taskCommandFixture(project);
  await f.run(TASK_BIND_ARGS);
  const { getActiveTaskUsage } = await import('../pi/lib/task-usage.mjs');
  const ledger = getActiveTaskUsage(project, 'session-control');
  for (let i = 0; i < 50; i++) ledger.admit({ dispatchId: `private-dispatch-${i}`, toolCallId: `private-tool-${i}` });
  const status = await f.run('status');
  assert.ok(Buffer.byteLength(status) <= 2048);
  assert.match(status, /INCOMPLETE/);
  assert.match(status, /50/);
  assert.doesNotMatch(status, /private-dispatch|private-tool|synthetic-task|synthetic-model/);
});

// PI-5 T5 2C-2: append-only integration tests against the Pi event boundary.
const usage2c2 = { input: 10, output: 4, cacheRead: 2, cacheWrite: 1, totalTokens: 17, cost: { total: 0.01 } };
async function fixture2c2(t) {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-2c2-'));
  fs.mkdirSync(path.join(project, 'Artifacts'));
  const f = await taskCommandFixture(project);
  f.ctx.sessionManager.getEntries = () => [...f.entries];
  await f.run(TASK_BIND_ARGS);
  const { getActiveTaskUsage } = await import('../pi/lib/task-usage.mjs');
  t.after(async () => { await f.events.get('session_shutdown')?.({}, f.ctx); fs.rmSync(project, { recursive: true, force: true }); });
  return { ...f, project, book: () => getActiveTaskUsage(project, 'session-control') };
}
const assistant2c2 = id => ({ type: 'message', id, message: { role: 'assistant', model: 'synthetic-model', usage: usage2c2 } });

test('2c2 harvests session entries once across checkpoint and reload', async t => {
  const f = await fixture2c2(t);
  f.entries.push(assistant2c2('m-1'));
  await f.events.get('tool_execution_end')?.({ toolCallId: 'call-1', result: { content: [] } }, f.ctx);
  await f.run('checkpoint'); await f.run('checkpoint');
  assert.equal(f.book().status().totals.totalTokens, 17);
  await f.events.get('session_shutdown')({}, f.ctx);
  await f.events.get('session_start')({}, f.ctx);
  await f.run('checkpoint');
  assert.equal(f.book().status().totals.totalTokens, 17);
});

test('2c2 harvests auxiliary and unknown usage before branch navigation without collection mirrors', async t => {
  const f = await fixture2c2(t);
  f.entries.push(assistant2c2('m-1'), { type: 'compaction', id: 'c-1', usage: usage2c2 },
    { type: 'branch_summary', id: 'b-1', usage: usage2c2 },
    { type: 'usage', id: 'u-1', kind: 'mystery', model: 'synthetic-model', usage: usage2c2 },
    { type: 'message', id: 'mirror', message: { role: 'toolResult', toolName: 'pi_explorer_job', usage: usage2c2 } });
  await f.events.get('session_before_tree')?.({}, f.ctx);
  const book = f.book();
  assert.equal(book.status().totals.totalTokens, 68);
  assert.deepEqual(book.status().rows.filter(r => r.type === 'parent').map(r => r.kind),
    ['normal', 'compaction', 'branch_summary', 'other']);
  f.entries.splice(1);
  await f.events.get('session_tree')({}, f.ctx);
  assert.equal(f.book().status().totals.totalTokens, 68);
});

test('2c2 idle poll harvests and stops on shutdown with unref timer', async t => {
  const oldSet = globalThis.setInterval, oldClear = globalThis.clearInterval;
  let callback, cleared = false, unref = false;
  globalThis.setInterval = fn => { callback = fn; return { unref() { unref = true; } }; };
  globalThis.clearInterval = () => { cleared = true; };
  t.after(() => { globalThis.setInterval = oldSet; globalThis.clearInterval = oldClear; });
  const f = await fixture2c2(t);
  assert.equal(typeof callback, 'function'); assert.equal(unref, true);
  f.entries.push(assistant2c2('idle-1')); callback();
  assert.equal(f.book().status().totals.totalTokens, 17);
  await f.events.get('session_shutdown')({}, f.ctx);
  assert.equal(cleared, true);
});

test('2c2 measures only final transformed tool delivery in exact utf8 bytes', async t => {
  const f = await fixture2c2(t);
  const base = { toolCallId: 'call-1', toolName: 'read', content: [{ type: 'text', text: 'old' }], isError: false };
  await f.events.get('tool_result')(base, f.ctx);
  await f.events.get('tool_execution_update')?.({ toolCallId: 'call-1', partialResult: { content: [{ type: 'text', text: 'old' }] } }, f.ctx);
  const event = { toolCallId: 'call-1', toolName: 'read', result: { content: [{ type: 'text', text: 'obsolete' }] } };
  await f.events.get('tool_execution_end')?.(event, f.ctx);
  await f.events.get('tool_execution_end')?.(event, f.ctx);
  f.entries.push({ type: 'message', id: 'result-1', message: { role: 'toolResult', toolCallId: 'call-1',
    content: [{ type: 'text', text: 'café 🚀' }] } });
  await f.events.get('tool_execution_end')?.({ ...event, toolCallId: 'call-1/1', parentToolCallId: 'call-1',
    result: { content: [{ type: 'text', text: 'café 🚀' }] } }, f.ctx);
  const totals = f.book().status().totals.deliveredBytes;
  assert.equal(totals['parent-model'], 10); assert.equal(totals['calling-tool'], 10);
});

test('2c2 empty and unbound ledger statuses remain incomplete', async t => {
  const f = await fixture2c2(t);
  assert.match(await f.run('status'), /^INCOMPLETE/);
  assert.equal(f.book().status().status, 'INCOMPLETE');
  f.entries.length = 0; await f.events.get('session_tree')({}, f.ctx);
  assert.match(await f.run('status'), /INCOMPLETE.*unassigned/i);
});

test('2c2 accounting failure never rewrites tool content and marks status incomplete', async t => {
  const f = await fixture2c2(t); const book = f.book();
  f.entries.push(assistant2c2('m-1')); await f.run('checkpoint');
  assert.equal(book.status().status, 'COMPLETE', 'complete baseline before injected failure');
  const original = book.record; book.record = () => { throw new Error('synthetic failure'); };
  const event = { toolCallId: 'call-1', toolName: 'read', result: { content: [{ type: 'text', text: 'unchanged' }] } };
  assert.equal(await f.events.get('tool_execution_end')?.(event, f.ctx), undefined);
  assert.equal(event.result.content[0].text, 'unchanged');
  book.record = original;
  assert.match(await f.run('status'), /^INCOMPLETE/);
});

test('2c2 cache warm intents remain incomplete until a new usage entry resolves them', async t => {
  const f = await fixture2c2(t);
  f.entries.push(assistant2c2('base')); await f.run('checkpoint');
  assert.equal(f.book().status().status, 'COMPLETE');
  await f.events.get('cache_warming_decision')({ action: 'warm' }, f.ctx);
  await f.events.get('cache_warming_decision')({ action: 'warm' }, f.ctx);
  assert.equal(f.book().status().status, 'INCOMPLETE');
  f.entries.push({ type: 'usage', id: 'warm-1', kind: 'cache_warm', model: 'synthetic-model', usage: usage2c2 });
  await f.run('checkpoint'); await f.run('checkpoint');
  let s = f.book().status();
  assert.equal(s.totals.totalTokens, 34);
  assert.equal(s.rows.filter(row => row.type === 'warm-resolved').length, 1);
  assert.equal(s.status, 'INCOMPLETE');
  f.entries.push({ type: 'usage', id: 'warm-2', kind: 'cache_warm', model: 'synthetic-model', usage: usage2c2 });
  await f.run('checkpoint');
  s = f.book().status(); assert.equal(s.status, 'COMPLETE'); assert.equal(s.totals.totalTokens, 51);
});

test('2c2 navigation summary spend survives moving outside the binding branch', async t => {
  const f = await fixture2c2(t); const book = f.book();
  f.entries.push(assistant2c2('before-tree'));
  await f.events.get('session_before_tree')({}, f.ctx);
  const summaryEntry = { type: 'branch_summary', id: 'outside-summary', usage: usage2c2 };
  f.entries.length = 0; f.entries.push(summaryEntry);
  await f.events.get('session_tree')({ summaryEntry }, f.ctx);
  assert.equal(book.status().totals.totalTokens, 34);
  assert.equal(f.book(), undefined);
});

test('2c2 collection mirror is not a tool delivery and final result is counted once', async t => {
  const f = await fixture2c2(t);
  f.book().record({ type: 'output', destination: 'calling-tool',
    deliveryId: JSON.stringify(['job-12345678-1234-1234-1234-123456789012', 'call-1']), text: 'internal' });
  f.entries.push({ type: 'message', id: 'collected', message: { role: 'toolResult', toolCallId: 'call-1',
    content: [{ type: 'text', text: 'café 🚀' }] } });
  await f.run('checkpoint');
  const bytes = f.book().status().totals.deliveredBytes;
  assert.equal(bytes['calling-tool'], 0); assert.equal(bytes['parent-model'], 10);
});

test('2c2 warm decisions record possible spend even when another handler can override stop', async t => {
  const f = await fixture2c2(t);
  f.entries.push(assistant2c2('base')); await f.run('checkpoint');
  assert.equal(f.book().status().status, 'COMPLETE');
  await f.events.get('cache_warming_decision')({ action: 'stop' }, f.ctx);
  assert.equal(f.book().status().status, 'INCOMPLETE');
});

test('2c2 auxiliary entries remain stable when the active model changes before reload', async t => {
  const f = await fixture2c2(t);
  f.ctx.model = { id: 'model-before' };
  f.entries.push({ type: 'compaction', id: 'compaction-model', usage: usage2c2 });
  await f.run('checkpoint');
  f.ctx.model = { id: 'model-after' };
  await f.run('checkpoint');
  const snapshot = f.book().status();
  assert.equal(snapshot.totals.totalTokens, 17);
  assert.equal(snapshot.rows.some(row => row.type === 'conflict'), false);
});

test('2c2 checkpoint accounting errors remain visible on subsequent status', async t => {
  const f = await fixture2c2(t); const book = f.book();
  f.entries.push(assistant2c2('checkpoint-base')); await f.run('checkpoint');
  assert.equal(book.status().status, 'COMPLETE');
  const checkpoint = book.checkpoint; book.checkpoint = () => { throw new Error('synthetic checkpoint failure'); };
  assert.match(await f.run('checkpoint'), /^INCOMPLETE/);
  book.checkpoint = checkpoint;
  assert.match(await f.run('status'), /^INCOMPLETE/);
});

test('2c2 disabled ledger cannot report a complete task status', async t => {
  const f = await fixture2c2(t); f.entries.push(assistant2c2('disabled-base'));
  await f.run('checkpoint'); assert.match(await f.run('status'), /^COMPLETE/);
  f.book().disable();
  assert.match(await f.run('status'), /^INCOMPLETE.*unassigned/i);
});

test('reload-harvest-does-not-duplicate-persisted-parent-rows', async t => {
  const f = await fixture2c2(t); f.entries.push(assistant2c2('reload-row-control'));
  await f.run('checkpoint');
  assert.equal(f.book().status().rows.filter(row => row.type === 'parent').length, 1);
  await f.events.get('session_shutdown')({}, f.ctx);
  await f.events.get('session_start')({}, f.ctx);
  await f.run('checkpoint');
  assert.equal(f.book().status().rows.filter(row => row.type === 'parent').length, 1);
  assert.equal(f.book().status().totals.totalTokens, 17);
});

test('pre-start-rejection-does-not-block-pi-task-close', async t => {
  const { createJobManager } = await import('../pi/lib/job-manager.mjs');
  const { createJobBudget } = await import('../pi/lib/job-budget.mjs');
  const { createExpensiveGate } = await import('../pi/lib/expensive-gate.mjs');
  for (const reason of ['gate busy', 'budget exceeded']) {
    const f = await fixture2c2(t); f.entries.push(assistant2c2(`parent-${reason}`));
    const gate = createExpensiveGate(); const release = reason === 'gate busy' ? gate.tryAcquire('control') : undefined;
    const budget = createJobBudget({ perJobUsd: 1, perSessionUsd: reason === 'budget exceeded' ? 0 : 1,
      rates: { model: { inputPerMTok: 1, outputPerMTok: 1 } }, modelOf: () => 'model' });
    let started = 0;
    const manager = createJobManager({ gate, budget, ledger: f.book(), run: async () => { started++; } });
    assert.throws(() => manager.start('work', { role: 'strategist', context: { cwd: f.project } }), /active|budget/i);
    assert.equal(started, 0);
    assert.match(await f.run('status'), /outstanding 0/);
    assert.doesNotMatch(await f.run('close'), /outstanding/i);
    assert.ok(f.entries.some(e => e.customType === 'pi-task-binding-v1' && e.data.closed === true));
    release?.();
  }
});

test('2c2 disabling accounting clears its idle poll immediately', async t => {
  const oldSet = globalThis.setInterval, oldClear = globalThis.clearInterval;
  let cleared = 0;
  globalThis.setInterval = () => ({ unref() {} });
  globalThis.clearInterval = () => { cleared++; };
  t.after(() => { globalThis.setInterval = oldSet; globalThis.clearInterval = oldClear; });
  const f = await fixture2c2(t); f.book().disable();
  assert.equal(cleared, 1);
});
