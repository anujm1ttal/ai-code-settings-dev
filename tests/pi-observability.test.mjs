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

test('minimal Pi observability registers session, context and completed-tool hooks', async () => {
  const events = await handlers();
  for (const name of ['session_start', 'before_agent_start', 'tool_result']) {
    assert.equal(typeof events.get(name), 'function', name);
  }
  assert.equal(events.has('agent_before_settle'), false, 'no automatic completion nag');
});
