import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { runRole } from '../pi/lib/role-runner.mjs';
import { createJobManager } from '../pi/lib/job-manager.mjs';
import { createJobBudget } from '../pi/lib/job-budget.mjs';
import { loadRolePolicy } from '../pi/lib/role-policy.mjs';

const policy = loadRolePolicy(new URL('./fixtures/pi-role-policy.json', import.meta.url));

function fakeSpawn(events, exitCode = 0) {
  const calls = [];
  const spawnImpl = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {};
    queueMicrotask(() => {
      for (const event of events) child.stdout.write(`${JSON.stringify(event)}\n`);
      child.stdout.end();
      child.stderr.end();
      child.emit('close', exitCode);
    });
    return child;
  };
  return { calls, spawnImpl };
}

const runtimeProof = { type: 'pi_child_runtime', retryEnabled: false, retryMaxRetries: 0,
  providerMaxRetries: 0, compactionEnabled: false };

const assistant = (provider, model, thinkingLevel, text) => ({ type: 'message_end', message: {
  role: 'assistant', provider, model, thinkingLevel, stopReason: 'stop',
  content: [{ type: 'text', text }], usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0,
    totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
} });

test('result store persists received text before returning a bounded envelope', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-result-runner-'));
  try {
    const fake = fakeSpawn([runtimeProof, assistant('pilot-gpt', 'sol', 'medium', 'Café 🚀')]);
    const result = await runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
      { spawnImpl: fake.spawnImpl, resultStore: { dir, dispatchId: 'red' } });
    assert.ok(result.persisted, 'a persisted result must precede the envelope');
    assert.ok(fs.existsSync(result.persisted.ref));
    assert.match(result.envelope, /full result persisted at/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('result store summarizes the final assistant turn, not earlier narration', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-result-final-'));
  try {
    const early = assistant('pilot-gpt', 'sol', 'medium', 'early narration '.repeat(400));
    early.message.stopReason = 'toolUse';
    const final = assistant('pilot-gpt', 'sol', 'medium', 'Verdict: PASS final turn');
    const fake = fakeSpawn([runtimeProof, early, final]);
    const result = await runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
      { spawnImpl: fake.spawnImpl, resultStore: { dir, dispatchId: 'final' } });
    assert.match(result.envelope, /^Summary: Verdict: PASS final turn$/m);
    const stored = fs.readFileSync(result.persisted.ref, 'utf8');
    assert.ok(stored.includes(early.message.content[0].text));
    assert.ok(stored.includes(final.message.content[0].text));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('final verdict survives lengthy final narration and earlier severe findings', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-result-verdict-'));
  try {
    const early = assistant('pilot-gpt', 'sol', 'medium', Array(20).fill('FAIL: earlier observation ' + 'x'.repeat(90)).join('\n'));
    early.message.stopReason = 'toolUse';
    const final = assistant('pilot-gpt', 'sol', 'medium', `${'final narration '.repeat(300)}\nVerdict: PASS final decision`);
    const fake = fakeSpawn([runtimeProof, early, final]);
    const result = await runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
      { spawnImpl: fake.spawnImpl, resultStore: { dir, dispatchId: 'verdict' } });
    assert.match(result.envelope, /Verdict: PASS final decision/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('runner preserves a persisted receipt when its long reference cannot fit', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-result-long-'));
  try {
    let longDir = dir;
    while (longDir.length < 2150) {
      longDir = path.join(longDir, 'r'.repeat(60));
      fs.mkdirSync(longDir);
    }
    const fake = fakeSpawn([runtimeProof, assistant('pilot-gpt', 'sol', 'medium', 'retained result')]);
    await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
      { spawnImpl: fake.spawnImpl, resultStore: { dir: longDir, dispatchId: 'x'.repeat(80) } }), error => {
      assert.equal(error.partialText, 'retained result');
      assert.equal(error.persisted.completeness, 'complete');
      assert.ok(fs.existsSync(error.persisted.ref));
      assert.match(error.envelope, /^Status: INCOMPLETE/m);
      assert.match(error.envelope, /Persisted reference cannot be represented/);
      assert.doesNotMatch(error.envelope, /no full-text copy exists/);
      assert.ok(Buffer.byteLength(error.envelope) <= 2048);
      return true;
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('without resultStore success and failure retain old shapes and write no files', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-result-absent-'));
  try {
    const good = fakeSpawn([runtimeProof, assistant('pilot-gpt', 'sol', 'medium', 'done')]);
    const result = await runRole(policy, 'coder', 'Implement', dir, '/tmp/role.md', { spawnImpl: good.spawnImpl });
    for (const key of ['persisted', 'envelope', 'partialText']) assert.equal(Object.hasOwn(result, key), false);
    const bad = fakeSpawn([assistant('pilot-gpt', 'sol', 'medium', 'unfinished')], 1);
    await assert.rejects(runRole(policy, 'coder', 'Implement', dir, '/tmp/role.md', { spawnImpl: bad.spawnImpl }), error => {
      for (const key of ['persisted', 'envelope', 'partialText']) assert.equal(Object.hasOwn(error, key), false);
      return true;
    });
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('result store retains streamed assistant deltas on abort before message_end', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-result-partial-'));
  const controller = new AbortController();
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = () => { setImmediate(() => child.emit('close', null)); return true; };
  try {
    const result = runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
      { spawnImpl: () => child, signal: controller.signal, resultStore: { dir, dispatchId: 'delta' } });
    child.stdout.write(`${JSON.stringify({ type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'partial café' } })}\n`);
    controller.abort();
    await assert.rejects(result, error => {
      assert.equal(error.partialText, 'partial café');
      assert.equal(error.persisted.completeness, 'partial');
      assert.match(error.envelope, /Status: INCOMPLETE/);
      return true;
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('result store retains deltas when an error message ends without text content', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-result-delta-end-'));
  try {
    const ended = assistant('pilot-gpt', 'sol', 'medium', '');
    ended.message.content = []; ended.message.stopReason = 'error';
    const fake = fakeSpawn([{ type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'already received' } }, ended]);
    await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
      { spawnImpl: fake.spawnImpl, resultStore: { dir, dispatchId: 'empty-end' } }), error => {
      assert.equal(error.partialText, 'already received');
      assert.equal(error.persisted.completeness, 'partial');
      return true;
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('result store preserves complete events preceding overflow within the same chunk', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-result-overflow-'));
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = () => { setImmediate(() => child.emit('close', null)); return true; };
  try {
    const result = runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
      { spawnImpl: () => child, resultStore: { dir, dispatchId: 'overflow' } });
    const event = Buffer.from(`${JSON.stringify(assistant('pilot-gpt', 'sol', 'medium', 'before overflow'))}\n`);
    child.stdout.write(Buffer.concat([event, Buffer.alloc(8 * 1024 * 1024)]));
    await assert.rejects(result, error => {
      assert.match(error.message, /exceeded 8 MiB/);
      assert.equal(error.partialText, 'before overflow');
      assert.equal(error.persisted.completeness, 'partial');
      assert.match(error.envelope, /Status: INCOMPLETE/);
      return true;
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('result store preserves all message text parts and verifies the persisted bytes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-result-all-'));
  try {
    const first = assistant('pilot-gpt', 'sol', 'medium', 'working'); first.message.stopReason = 'toolUse';
    const last = assistant('pilot-gpt', 'sol', 'medium', 'done café');
    last.message.content.push({ type: 'text', text: 'extra 🚀' });
    const fake = fakeSpawn([runtimeProof, first, last]);
    const result = await runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
      { spawnImpl: fake.spawnImpl, resultStore: { dir, dispatchId: 'all' } });
    const bytes = fs.readFileSync(result.persisted.ref);
    assert.equal(bytes.subarray(bytes.indexOf(10) + 1).toString(), 'working\ndone café\nextra 🚀');
    assert.equal(result.persisted.sha256, (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex'));
    assert.equal(result.persisted.completeness, 'complete');
    assert.ok(Buffer.byteLength(result.envelope) <= 2048);
    assert.ok(result.envelope.includes(result.persisted.ref));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('persistence failures retain received material and return an incomplete envelope', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-result-failure-'));
  try {
    for (const [id, events, exit] of [['invalid/id', [runtimeProof, assistant('pilot-gpt', 'sol', 'medium', 'received')], 0],
      ['also/invalid', [assistant('pilot-gpt', 'sol', 'medium', 'partial')], 1]]) {
      const fake = fakeSpawn(events, exit);
      await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
        { spawnImpl: fake.spawnImpl, resultStore: { dir, dispatchId: id } }), error => {
        assert.ok(['received', 'partial'].includes(error.partialText));
        assert.match(error.envelope, /Status: INCOMPLETE/);
        assert.match(error.envelope, /Persistence failed; no full-text copy exists/);
        assert.equal(error.persisted, undefined);
        return true;
      });
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('nonzero exit, failed model response and timeout preserve partial work', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-result-interrupted-'));
  try {
    const failed = assistant('pilot-gpt', 'sol', 'medium', 'failed work');
    failed.message.stopReason = 'error'; failed.message.errorMessage = 'context overflow';
    for (const [id, events, code, expected] of [
      ['exit', [assistant('pilot-gpt', 'sol', 'medium', 'exit work')], 1, 'exit work'],
      ['model', [failed], 0, 'failed work']]) {
      const fake = fakeSpawn(events, code);
      await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
        { spawnImpl: fake.spawnImpl, resultStore: { dir, dispatchId: id } }), error => {
        assert.equal(error.partialText, expected);
        assert.equal(error.persisted.completeness, 'partial');
        assert.match(error.envelope, /Status: INCOMPLETE/);
        assert.ok(error.envelope.includes(error.persisted.sha256));
        return true;
      });
    }
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { setImmediate(() => child.emit('close', null)); return true; };
    const pending = runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
      { spawnImpl: () => child, timeoutMs: 10, killGraceMs: 100, resultStore: { dir, dispatchId: 'timeout' } });
    child.stdout.write(`${JSON.stringify(assistant('pilot-gpt', 'sol', 'medium', 'timeout work'))}\n`);
    await assert.rejects(pending, error => {
      assert.match(error.message, /timed out/); assert.equal(error.partialText, 'timeout work');
      assert.equal(error.persisted.completeness, 'partial'); assert.match(error.envelope, /Status: INCOMPLETE/);
      return true;
    });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('dispatches an isolated auditor and verifies observed model and thinking', async () => {
  const fake = fakeSpawn([assistant('pilot-claude', 'sonnet', 'high', 'FAIL: revise tests')]);
  const result = await runRole(policy, 'auditor', 'Review fixture', 'C:/fixture', 'C:/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } });
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].options.cwd, 'C:/fixture');
  assert.equal(fake.calls[0].options.shell, false);
  assert.ok(fake.calls[0].args.includes('--no-session'));
  assert.deepEqual(result, { role: 'auditor', model: 'pilot-claude/sonnet',
    thinking: 'high', text: 'FAIL: revise tests', usage: { input: 1, output: 1,
      cacheRead: 0, cacheWrite: 0, totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    usageCalls: [{ stopReason: 'stop', completeness: 'known', usage: assistant('pilot-claude', 'sonnet', 'high', '').message.usage }],
    runtimeVerified: false, toolCounts: {}, successfulReads: 0 });
});

test('explorer dispatches without project state and reports bounded tool metadata', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-explorer-dispatch-'));
  const expanded = { ...policy, roles: { ...policy.roles,
    explorer: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] } } };
  const fake = fakeSpawn([
    runtimeProof,
    { type: 'tool_execution_start', toolCallId: '1', toolName: 'read', args: { path: 'secret-argument' } },
    { type: 'tool_execution_end', toolCallId: '1', toolName: 'read', isError: false, result: 'secret-content' },
    { type: 'tool_execution_start', toolCallId: '2', toolName: 'read', args: { path: 'missing' } },
    { type: 'tool_execution_end', toolCallId: '2', toolName: 'read', isError: true },
    { type: 'tool_execution_end', toolCallId: '3', toolName: 'read' },
    ...['grep', 'find', 'ls'].map(toolName => ({ type: 'tool_execution_start', toolName })),
    assistant('pilot-gpt', 'luna', 'low', 'Source: file:1'),
  ]);
  const previousRole = process.env.PI_ROLE;
  const previousRoot = process.env.PI_CONCIERGE_ROOT;
  process.env.PI_ROLE = 'concierge';
  process.env.PI_CONCIERGE_ROOT = 'inherited';
  try {
    const result = await runRole(expanded, 'explorer', 'Find callers', root, '/tmp/explorer.md',
      { spawnImpl: fake.spawnImpl });
    assert.deepEqual(result.toolCounts, { read: 2, grep: 1, find: 1, ls: 1 });
    assert.equal(result.successfulReads, 1);
    assert.doesNotMatch(JSON.stringify(result), /secret-argument|secret-content/);
    const { args, options } = fake.calls[0];
    assert.equal(args[args.indexOf('--tools') + 1], 'read,grep,find,ls');
    assert.ok(args.includes('--no-mcp'));
    assert.equal(args.includes('--extension'), false);
    assert.equal(options.env.PI_ROLE, undefined);
    assert.equal(options.env.PI_CONCIERGE_ROOT, undefined);
    assert.equal(fs.existsSync(path.join(root, 'Artifacts')), false);
  } finally {
    if (previousRole === undefined) delete process.env.PI_ROLE; else process.env.PI_ROLE = previousRole;
    if (previousRoot === undefined) delete process.env.PI_CONCIERGE_ROOT; else process.env.PI_CONCIERGE_ROOT = previousRoot;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('explorer rejects every observed non-read tool and mismatched model or thinking', async () => {
  const expanded = { ...policy, roles: { ...policy.roles,
    explorer: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] } } };
  for (const toolName of ['bash', 'edit', 'write', 'unknown']) {
    const fake = fakeSpawn([{ type: 'tool_execution_start', toolName, args: {} },
      assistant('pilot-gpt', 'luna', 'low', 'Result')]);
    await assert.rejects(runRole(expanded, 'explorer', 'Explore', '.', '/tmp/explorer.md',
      { spawnImpl: fake.spawnImpl }), new RegExp(`Explorer attempted ${toolName} tool`));
  }
  for (const [provider, model, thinking, expected] of [
    ['pilot-gpt', 'sol', 'low', /Unexpected model/],
    ['pilot-gpt', 'luna', 'high', /Unexpected thinking/],
  ]) {
    const fake = fakeSpawn([assistant(provider, model, thinking, 'Result')]);
    await assert.rejects(runRole(expanded, 'explorer', 'Explore', '.', '/tmp/explorer.md',
      { spawnImpl: fake.spawnImpl }), expected);
  }
});

test('concierge policy is rejected during load, before a child can spawn', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-legacy-role-'));
  const file = path.join(root, 'policy.json');
  const legacy = { ...policy, roles: { ...policy.roles,
    scribe: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] },
    concierge: { model: 'pilot-claude/haiku', thinking: 'low', tools: ['read', 'grep', 'find', 'ls', 'edit', 'write'] } } };
  try {
    fs.writeFileSync(file, JSON.stringify(legacy));
    assert.throws(() => loadRolePolicy(file),
      (error) => /concierge/i.test(error.message) && /explorer/i.test(error.message));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('read-only council coder denies observed write events despite normal writable coder policy', async () => {
  const allowed = fakeSpawn([runtimeProof, assistant('pilot-gpt', 'sol', 'medium', 'Perspective')]);
  const result = await runRole(policy, 'coder', 'Critique', '.', '/tmp/council.md',
    { spawnImpl: allowed.spawnImpl, profile: 'council-read-only' });
  assert.equal(result.text, 'Perspective');
  assert.equal(allowed.calls[0].args[allowed.calls[0].args.indexOf('--tools') + 1], 'read,grep,find,ls');
  assert.equal(allowed.calls[0].args.includes('--extension'), false);
  for (const toolName of ['bash', 'powershell', 'edit', 'write', 'mcp__write']) {
    const denied = fakeSpawn([{ type: 'tool_execution_start', toolName, args: { path: 'src/file.md' } },
      assistant('pilot-gpt', 'sol', 'medium', 'Done')]);
    await assert.rejects(runRole(policy, 'coder', 'Critique', '.', '/tmp/council.md',
      { spawnImpl: denied.spawnImpl, profile: 'council-read-only' }), /Council.*attempted/);
  }
});

test('council profile requires an observed read of its exact immutable evidence file', async () => {
  const file = path.resolve('C:/synthetic/case.txt');
  const missing = fakeSpawn([assistant('pilot-gpt', 'sol', 'high', 'Opinion without data')]);
  await assert.rejects(runRole(policy, 'strategist', 'Review', '.', '/tmp/council.md',
    { spawnImpl: missing.spawnImpl, profile: 'council-read-only', requiredReadPath: file }), /evidence|read/i);
  const failedRead = fakeSpawn([{ type: 'tool_execution_start', toolCallId: 'e1', toolName: 'read', args: { path: file } },
    { type: 'tool_execution_end', toolCallId: 'e1', toolName: 'read', isError: true },
    assistant('pilot-gpt', 'sol', 'high', 'Pretended read')]);
  await assert.rejects(runRole(policy, 'strategist', 'Review', '.', '/tmp/council.md',
    { spawnImpl: failedRead.spawnImpl, profile: 'council-read-only', requiredReadPath: file }), /evidence|read/i);
  const read = fakeSpawn([runtimeProof, { type: 'tool_execution_start', toolCallId: 'e2', toolName: 'read', args: { path: file } },
    { type: 'tool_execution_end', toolCallId: 'e2', toolName: 'read', isError: false },
    assistant('pilot-gpt', 'sol', 'high', 'Evidence-backed opinion')]);
  const result = await runRole(policy, 'strategist', 'Review', '.', '/tmp/council.md',
    { spawnImpl: read.spawnImpl, profile: 'council-read-only', requiredReadPath: file });
  assert.equal(result.text, 'Evidence-backed opinion');
});

test('parses a UTF-8 character split across stdout chunks', async () => {
  const event = Buffer.from(`${JSON.stringify(assistant('pilot-gpt', 'sol', 'high', 'Café'))}\n`);
  const split = event.indexOf(Buffer.from('é')[0]) + 1;
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    queueMicrotask(() => {
      child.stdout.write(event.subarray(0, split));
      child.stdout.write(event.subarray(split));
      child.stdout.end();
      child.stderr.end();
      child.emit('close', 0);
    });
    return child;
  };
  const result = await runRole(policy, 'strategist', 'Plan', '.', '/tmp/role.md',
    { spawnImpl, invocation: { command: 'pi', args: [] } });
  assert.equal(result.text, 'Café');
});

test('adds usage from every assistant turn, not only the last response', async () => {
  const first = assistant('pilot-gpt', 'sol', 'medium', 'Working');
  first.message.stopReason = 'toolUse';
  first.message.usage = { input: 10, output: 20, cacheRead: 1, cacheWrite: 2,
    totalTokens: 33, cost: { input: 0.1, output: 0.2, cacheRead: 0.01, cacheWrite: 0.02, total: 0.33 } };
  const second = assistant('pilot-gpt', 'sol', 'medium', 'Finished');
  second.message.usage = { input: 7, output: 8, cacheRead: 0, cacheWrite: 0,
    totalTokens: 15, cost: { input: 0.07, output: 0.08, cacheRead: 0, cacheWrite: 0, total: 0.15 } };
  const fake = fakeSpawn([first, second]);
  const result = await runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } });
  assert.equal(result.text, 'Finished');
  assert.deepEqual(result.usage, { input: 17, output: 28, cacheRead: 1, cacheWrite: 2,
    totalTokens: 48, cost: { input: 0.17, output: 0.28, cacheRead: 0.01, cacheWrite: 0.02, total: 0.48 } });
});

test('retains separate usage readings for each assistant call', async () => {
  const first = assistant('pilot-gpt', 'sol', 'medium', 'Working');
  first.message.stopReason = 'toolUse';
  const second = assistant('pilot-gpt', 'sol', 'medium', 'Finished');
  second.message.usage.input = 7;
  second.message.usage.totalTokens = 8;
  const fake = fakeSpawn([first, second]);
  const result = await runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } });
  assert.ok(Array.isArray(result.usageCalls), 'usageCalls must retain one reading per assistant call');
  assert.equal(result.usageCalls.length, 2);
  assert.deepEqual(result.usageCalls.map((call) => call.usage.input), [1, 7]);
});

test('reasoning and cacheWrite1h remain subsets and undefined cost retains current aggregate behavior', async () => {
  const first = assistant('pilot-gpt', 'sol', 'medium', 'Working');
  first.message.stopReason = 'toolUse';
  first.message.usage = { input: 10, output: 20, cacheRead: 3, cacheWrite: 8,
    totalTokens: 41, reasoning: 7, cacheWrite1h: 5 };
  const second = assistant('pilot-gpt', 'sol', 'medium', 'Done');
  second.message.usage = { input: 2, output: 4, cacheRead: 1, cacheWrite: 2,
    totalTokens: 9, reasoning: 2, cacheWrite1h: 1 };
  const fake = fakeSpawn([runtimeProof, first, second]);
  const result = await runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md', { spawnImpl: fake.spawnImpl });
  assert.deepEqual(result.usageCalls.map(call => call.completeness), ['known', 'known']);
  assert.equal(result.usageCalls[0].usage.cost, undefined);
  assert.deepEqual(result.usage, { input: 12, output: 24, cacheRead: 4, cacheWrite: 10, totalTokens: 50,
    reasoning: 9, cacheWrite1h: 6, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } });
});

test('null usage through a budgeted job remains unknown and holds its reservation', async () => {
  const budget = createJobBudget({ perJobUsd: 1, perSessionUsd: 3,
    rates: { 'pilot-gpt/sol': { inputPerMTok: 2, outputPerMTok: 10 } }, modelOf: () => 'pilot-gpt/sol' });
  let released = 0;
  const jobs = createJobManager({ budget, gate: { tryAcquire: () => () => { released++; } },
    run: async () => ({ text: 'done', usage: null, usageCalls: [{ completeness: 'unknown', usage: null }] }) });
  const job = jobs.start('fixture', { role: 'strategist' });
  assert.equal(budget.snapshot().reservedUsd, 1);
  await new Promise(resolve => setImmediate(resolve));
  const result = jobs.collect(job.id);
  assert.equal(result.usage, null);
  assert.equal(result.usageUnknown, true);
  assert.deepEqual(result.cost, { unknown: true });
  assert.equal(budget.snapshot().reservedUsd, 1);
  assert.equal(budget.snapshot().spentUsd, 0);
  assert.equal(released, 1);
  await jobs.shutdown();
});

test('extension tool results omit unknown usage for synchronous and council calls', async () => {
  const source = fs.readFileSync(new URL('../pi/extensions/role-agent.ts', import.meta.url), 'utf8');
  const js = stripTypeScriptTypes(source).replace(/^import .*;\s*$/gm, '')
    .replace("const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');", "const sourceRoot = '/fixture';")
    .replace(/export default function \(pi\s*\)/, 'function register(pi)') + '\nregister';
  const tools = new Map();
  const known = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2 };
  const single = { role: 'coder', model: 'fixture', thinking: 'medium', text: 'done', usage: null, usageCalls: [] };
  const council = { verdict: 'ADVISORY', evidenceSha256: 'fixture',
    perspectives: [{ perspective: 'coder', text: 'done', usage: null, usageCalls: [] }],
    synthesis: { text: 'done', usage: known, usageCalls: [] } };
  const sandbox = { path, process: { env: { PI_ROLE_POLICY_PATH: path.resolve('fixture-policy.json') } },
    Type: { Object: () => ({}), String: () => ({}), Union: () => ({}), Literal: () => ({}), Optional: () => ({}) },
    loadRolePolicy: () => policy, runRole: async () => single, runCouncilPerspective: async () => single,
    runCouncilSession: async () => council, registerExplorerJobs: () => {}, createExpensiveGate: () => ({}),
    withExpensiveGate: async (_gate, _label, run) => run() };
  const register = runInNewContext(js, sandbox);
  register({ registerTool: tool => tools.set(tool.name, tool), registerCommand: () => {} });
  const roleResult = await tools.get('pi_role_agent').execute('id', { role: 'coder', task: 'fixture' }, undefined, undefined, { cwd: '.' });
  const councilResult = await tools.get('pi_council').execute('id', { question: 'fixture' }, undefined, undefined, { cwd: '.' });
  for (const result of [roleResult, councilResult]) {
    assert.equal(Object.hasOwn(result, 'usage'), false);
    assert.equal(result.details.usageComplete, false);
  }
  single.usage = known; council.perspectives[0].usage = known;
  const roleKnown = await tools.get('pi_role_agent').execute('id', { role: 'coder', task: 'fixture' }, undefined, undefined, { cwd: '.' });
  const councilKnown = await tools.get('pi_council').execute('id', { question: 'fixture' }, undefined, undefined, { cwd: '.' });
  assert.equal(roleKnown.usage.input, 1);
  assert.equal(councilKnown.usage.input, 2);
  assert.equal(councilKnown.details.usageComplete, true);
});

test('extension does not bypass the scoped runtime for synchronous, council or background dispatch', () => {
  const source = fs.readFileSync(new URL('../pi/extensions/role-agent.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /invocation:\s*invocation\(\)/);
  assert.match(source, /usageCalls/);
});

test('default dispatch uses the scoped runtime without changing coder argv', async () => {
  const proof = { type: 'pi_child_runtime', retryEnabled: false, retryMaxRetries: 0,
    providerMaxRetries: 0, compactionEnabled: false };
  const fake = fakeSpawn([proof, assistant('pilot-gpt', 'sol', 'medium', 'Done')]);
  const result = await runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md', { spawnImpl: fake.spawnImpl });
  assert.equal(result.runtimeVerified, true);
  assert.equal(fake.calls[0].command, process.execPath);
  assert.match(fake.calls[0].args[0], /child-runtime\.mjs$/);
  assert.equal(fake.calls[0].args[fake.calls[0].args.indexOf('--tools') + 1], policy.roles.coder.tools.join(','));
  assert.equal(fake.calls[0].args[fake.calls[0].args.indexOf('--model') + 1], policy.roles.coder.model);
  assert.ok(fake.calls[0].args.includes('--extension'));
});

test('default dispatch rejects missing or invalid runtime proof; injected invocation remains unverified', async () => {
  for (const proof of [null, { type: 'pi_child_runtime', retryEnabled: true, retryMaxRetries: 0,
    providerMaxRetries: 0, compactionEnabled: false }]) {
    const events = [...(proof ? [proof] : []), assistant('pilot-gpt', 'sol', 'medium', 'Done')];
    const fake = fakeSpawn(events);
    await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md', { spawnImpl: fake.spawnImpl }),
      error => error.partial === true && error.runtimeVerified === false && /runtime.*verif/i.test(error.message));
    const injected = fakeSpawn(events);
    const result = await runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
      { spawnImpl: injected.spawnImpl, invocation: { command: 'fixture', args: [] } });
    assert.equal(result.runtimeVerified, false);
  }
});

test('missing, zero-only and nonfinite call readings remain unknown even beside known usage', async () => {
  for (const reading of [undefined, { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 },
    { input: Infinity, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 1 },
    { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: { total: Infinity } },
    { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
    { input: 1, output: 1 }]) {
    const first = assistant('pilot-gpt', 'sol', 'medium', 'Working');
    first.message.stopReason = 'toolUse'; first.message.usage = reading;
    const fake = fakeSpawn([runtimeProof, first, assistant('pilot-gpt', 'sol', 'medium', 'Done')]);
    const result = await runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md', { spawnImpl: fake.spawnImpl });
    assert.deepEqual(result.usageCalls.map(call => call.completeness), ['unknown', 'known']);
    assert.equal(result.usage, null, 'incomplete aggregate must not settle as a free or partial charge');
  }
});

test('background jobs retain known and partial per-call usage on collection', async () => {
  const calls = [{ stopReason: 'error', completeness: 'unknown', usage: null }];
  for (const failed of [false, true]) {
    const jobs = createJobManager({ run: async () => {
      if (failed) { const error = new Error('context overflow'); error.usageCalls = calls; throw error; }
      return { text: 'Done', usage: null, usageCalls: calls };
    } });
    const job = jobs.start('fixture');
    await new Promise(resolve => setImmediate(resolve));
    const result = jobs.collect(job.id);
    assert.deepEqual(result.usageCalls, calls);
    assert.equal(result.usageUnknown, true);
    await jobs.shutdown();
  }
});

test('context overflow is partial and preserves the failed call usage', async () => {
  const event = assistant('pilot-gpt', 'sol', 'medium', '');
  event.message.stopReason = 'error'; event.message.errorMessage = 'context overflow';
  const fake = fakeSpawn([event]);
  await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md', { spawnImpl: fake.spawnImpl }), error => {
    assert.match(error.message, /partial.*context overflow/i);
    assert.equal(error.partial, true);
    assert.equal(error.usageCalls.length, 1);
    assert.equal(error.usageCalls[0].completeness, 'known');
    return true;
  });
  assert.equal(fake.calls.length, 1);
});

test('zero-usage overflow rejects as partial with unknown call and null usage', async () => {
  const event = assistant('pilot-gpt', 'sol', 'medium', '');
  event.message.stopReason = 'error'; event.message.errorMessage = 'context overflow';
  event.message.usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0 };
  const fake = fakeSpawn([runtimeProof, event]);
  await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md', { spawnImpl: fake.spawnImpl }), error => {
    assert.match(error.message, /partial.*context overflow/i);
    assert.equal(error.usageCalls[0].completeness, 'unknown');
    assert.equal(error.usage, null);
    return true;
  });
  assert.equal(fake.calls.length, 1);
});

test('rejects incorrect observed model even with exit zero', async () => {
  const fake = fakeSpawn([assistant('google', 'gemini-2.5-pro', 'high', 'Not permitted')]);
  await assert.rejects(runRole(policy, 'auditor', 'Review', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }), /Unexpected model/);
});

test('rejects incorrect observed thinking even with exit zero', async () => {
  const fake = fakeSpawn([assistant('pilot-gpt', 'sol', 'low', 'Plan')]);
  await assert.rejects(runRole(policy, 'strategist', 'Plan', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }), /Unexpected thinking/);
});

for (const toolName of ['bash', 'powershell', 'edit', 'write', 'mcp__mutate']) {
  test(`rejects observed strategist ${toolName} execution`, async () => {
    const fake = fakeSpawn([{ type: 'tool_execution_start', toolName, args: {} },
      assistant('pilot-gpt', 'sol', 'high', 'Plan')]);
    await assert.rejects(runRole(policy, 'strategist', 'Plan', '.', '/tmp/role.md',
      { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }),
    new RegExp(`Strategist attempted ${toolName} tool`));
  });
}

test('rejects auditor write-tool execution and subagent error responses', async () => {
  const fake = fakeSpawn([{ type: 'tool_execution_start', toolName: 'write', args: { path: 'src/a.py' } },
    assistant('pilot-claude', 'sonnet', 'high', 'Done')]);
  await assert.rejects(runRole(policy, 'auditor', 'Review', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }), /Auditor attempted/);
});

test('fails a shell-capable role if Pi reports its explicit guard failed to load', async () => {
  const fake = fakeSpawn([{ type: 'extension_error', extensionPath: 'C:/source/pi/extensions/guard.ts', error: 'failed to import' },
    assistant('pilot-gpt', 'sol', 'medium', 'Work done')]);
  await assert.rejects(runRole(policy, 'coder', 'Review', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }), /guard.*failed to import/i);
});

test('rejects observed scribe shell or write execution even after an unsafe runtime bypass', async () => {
  const expanded = { ...policy, roles: { ...policy.roles,
    scribe: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] } } };
  for (const toolName of ['bash', 'powershell', 'edit', 'write']) {
    const fake = fakeSpawn([{ type: 'tool_execution_start', toolName, args: { path: 'a.md' } },
      assistant('pilot-gpt', 'luna', 'low', 'Explanation')]);
    await assert.rejects(runRole(expanded, 'scribe', 'Explain', '.', '/tmp/role.md',
      { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }), /Scribe attempted/);
  }
});

test('read-only scribe rejects an unexpected custom tool event, not only shell names', async () => {
  const expanded = { ...policy, roles: { ...policy.roles,
    scribe: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] } } };
  const fake = fakeSpawn([{ type: 'tool_execution_start', toolName: 'mcp__mutate', args: {} },
    assistant('pilot-gpt', 'luna', 'low', 'Done')]);
  await assert.rejects(runRole(expanded, 'scribe', 'Explain', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }), /Scribe attempted mcp__mutate/);
});

test('rejects any observed auditor bash execution even if policy tools were bypassed', async () => {
  const fake = fakeSpawn([{ type: 'tool_execution_start', toolName: 'bash', args: { command: 'echo should-not-run' } },
    assistant('pilot-claude', 'sonnet', 'high', 'Done')]);
  await assert.rejects(runRole(policy, 'auditor', 'Review', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }), /Auditor attempted bash/);
});

for (const role of ['explorer', 'strategist', 'auditor']) {
  test(`${role}: default deadline is ten minutes, not before, with a pending fake child`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const expanded = { ...policy, roles: { ...policy.roles,
      explorer: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] } } };
    const signals = [];
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = signal => { signals.push(signal); return true; };
    let settled = false;
    const pending = runRole(expanded, role, 'fixture', '.', '/tmp/role.md', {
      spawnImpl: () => child, killerImpl: () => { throw new Error('no real killer'); },
    }).then(() => { settled = true; return null; }, error => { settled = true; return error; });
    t.mock.timers.tick(599999);
    await Promise.resolve();
    assert.equal(settled, false);
    assert.deepEqual(signals, [], 'the child is still pending just before the deadline');
    t.mock.timers.tick(1);
    assert.deepEqual(signals, ['SIGTERM']);
    assert.equal(settled, false, 'timeout must wait for cleanup');
    child.emit('close', null);
    const error = await pending;
    assert.match(error?.message ?? '', new RegExp(`Pi ${role} subagent timed out after 600000 ms`));
  });
}

test('returns a bounded timeout error when a child ignores termination', async () => {
  const signals = [];
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = (signal = 'SIGTERM') => { signals.push(signal); return true; };
    return child;
  };
  await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
    { spawnImpl, invocation: { command: 'pi', args: [] }, timeoutMs: 10, killGraceMs: 10 }),
  /timed out.*cleanup unconfirmed/);
  assert.ok(signals.includes('SIGTERM'));
  assert.ok(signals.includes('SIGKILL'));
});

test('Windows cancellation terminates a disposable detached descendant without harming a sibling',
  { skip: process.platform !== 'win32', timeout: 30000 }, async (t) => {
    // Every fixture exits on command, socket loss, or its own deadline; never kill a numeric PID.
    const source = `
      const net = require('node:net');
      const { spawn } = require('node:child_process');
      const [port, kind] = process.argv.slice(1);
      const socket = net.createConnection({ host: '127.0.0.1', port: Number(port) });
      let childPid;
      if (kind === 'parent') {
        const child = spawn(process.execPath, ['-e', process.execArgv[1], port, 'descendant'],
          { stdio: 'ignore', windowsHide: true, detached: true, env: process.env });
        childPid = child.pid;
        child.on('error', () => process.exit(2));
        child.unref();
      }
      socket.on('connect', () => socket.write(JSON.stringify({ kind, pid: process.pid, childPid, token: process.env.FIXTURE_TOKEN }) + '\\n'));
      socket.on('data', () => process.exit(0));
      socket.on('error', () => process.exit(0));
      socket.on('close', () => process.exit(0));
      setTimeout(() => process.exit(0), 15000);
    `;
    const peers = new Map();
    const sockets = new Set();
    const token = randomBytes(32).toString('hex');
    const server = net.createServer(socket => {
      sockets.add(socket);
      socket.on('error', () => {});
      let data = '';
      socket.on('data', chunk => {
        data += chunk.toString();
        if (!data.includes('\n')) return;
        let hello;
        try { hello = JSON.parse(data.slice(0, data.indexOf('\n'))); }
        catch { socket.destroy(); return; }
        if (hello.token !== token || !['parent', 'descendant', 'sibling'].includes(hello.kind) ||
            !Number.isSafeInteger(hello.pid) || hello.pid <= 0 || peers.has(hello.kind)) {
          socket.destroy(); return;
        }
        peers.set(hello.kind, { ...hello, socket });
      });
    });
    const waitFor = async (predicate, label, ms = 5000) => {
      const deadline = Date.now() + ms;
      while (!predicate()) {
        if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`);
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    };
    const alive = pid => {
      try { process.kill(pid, 0); return true; }
      catch (error) { if (error.code === 'ESRCH') return false; throw error; }
    };
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const port = String(server.address().port);
    const env = { SystemRoot: process.env.SystemRoot, FIXTURE_TOKEN: token };
    const controller = new AbortController();
    let parent;
    let sibling;
    let result;
    try {
      sibling = spawn(process.execPath, ['-e', source, port, 'sibling'],
        { stdio: 'ignore', windowsHide: true, env });
      sibling.on('error', () => {});
      result = runRole(policy, 'coder', 'fixture', '.', '/tmp/role.md', {
        invocation: { command: process.execPath, args: ['-e', source, port, 'parent'] },
        spawnImpl: (command, args, options) => {
          parent = spawn(command, args, { ...options, windowsHide: true, env });
          return parent;
        },
        signal: controller.signal, timeoutMs: 10000, killGraceMs: 500,
      }).then(() => null, error => error);
      await waitFor(() => ['parent', 'descendant', 'sibling'].every(kind => peers.has(kind)), 'fixture handshakes');
      const tree = peers.get('parent');
      const descendant = peers.get('descendant');
      const control = peers.get('sibling');
      assert.equal(tree.pid, parent.pid);
      assert.equal(tree.childPid, descendant.pid);
      assert.equal(control.pid, sibling.pid);
      assert.equal(new Set([tree.pid, descendant.pid, control.pid]).size, 3);
      assert.ok([tree.pid, descendant.pid, control.pid].every(alive), 'all fixture PIDs must initially exist');
      await new Promise(resolve => setTimeout(resolve, 300));
      assert.ok([tree.pid, descendant.pid, control.pid].every(alive), 'all fixture PIDs must remain alive before cancellation');
      t.diagnostic(`before cancellation: ${JSON.stringify({ parentAlive: alive(tree.pid),
        descendantAlive: alive(descendant.pid), siblingAlive: alive(control.pid), childPidMatches: true })}`);
      controller.abort();
      const error = await result;
      assert.match(error?.message ?? '', /abort/i);
      await waitFor(() => !alive(tree.pid), 'parent exit');
      // Wait for the intended descendant exit, but retain the sibling presence control.
      const deadline = Date.now() + 1500;
      while (alive(descendant.pid) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      const state = { parentAlive: alive(tree.pid), descendantAlive: alive(descendant.pid),
        siblingAlive: alive(control.pid) };
      t.diagnostic(`after cancellation: ${JSON.stringify(state)}`);
      assert.equal(state.siblingAlive, true, 'unrelated fixture must survive cancellation');
      assert.equal(state.parentAlive, false, 'parent must exit');
      assert.equal(state.descendantAlive, false, 'descendant must exit');
    } finally {
      controller.abort();
      // Cooperative shutdown is addressed to authenticated fixture connections, not PID snapshots.
      for (const socket of sockets) if (!socket.destroyed) socket.end('stop');
      server.close();
      if (result) await result;
      const known = [...peers.values()].map(peer => peer.pid);
      if (peers.get('parent')?.childPid) known.push(peers.get('parent').childPid);
      if (parent?.pid && !peers.has('parent')) {
        // If the parent never reported its child, allow the fixture deadline to expire too.
        await new Promise(resolve => setTimeout(resolve, 16000));
      }
      if (parent?.pid) known.push(parent.pid);
      if (sibling?.pid) known.push(sibling.pid);
      await waitFor(() => known.every(pid => !alive(pid)), 'fixture teardown');
      t.diagnostic(`fixture teardown: ${JSON.stringify({ knownPidsAbsent: known.every(pid => !alive(pid)) })}`);
    }
  });

test('keeps cleanup active after child error and cancellation until close', async () => {
  const controller = new AbortController();
  const signals = [];
  let closed = false;
  let settled = false;
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = (signal = 'SIGTERM') => {
      signals.push(signal);
      if (signal === 'SIGKILL') setImmediate(() => { closed = true; child.emit('close', null); });
      return true;
    };
    queueMicrotask(() => { child.emit('error', new Error('fixture error')); controller.abort(); });
    return child;
  };
  const result = runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
    { spawnImpl, signal: controller.signal, timeoutMs: 500, killGraceMs: 30 })
    .then(() => { settled = true; }, error => { settled = true; return error; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, 'child error must not settle before close');
  const error = await result;
  assert.match(error?.message ?? '', /fixture error|aborted/);
  assert.equal(closed, true);
  assert.ok(signals.includes('SIGKILL'));
});

// Fake child with a pid; the stub killer guarantees no real taskkill can ever target that pid.
function treeFixture({ exitCode = null, signalCode = null, killerBehavior } = {}) {
  const killerCalls = [];
  const signals = [];
  const child = new EventEmitter();
  child.pid = 4242; child.exitCode = exitCode; child.signalCode = signalCode;
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = (signal = 'SIGTERM') => { signals.push(signal); return true; };
  const killerImpl = (command, args, options) => {
    killerCalls.push({ command, args, options });
    const killer = new EventEmitter();
    killer.unref = () => {};
    queueMicrotask(() => killerBehavior?.(killer));
    return killer;
  };
  return { child, killerCalls, signals, spawnImpl: () => child, killerImpl };
}

async function cancelTree(fixture, { settleBy = 'close' } = {}) {
  const controller = new AbortController();
  const result = runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
    { spawnImpl: fixture.spawnImpl, killerImpl: fixture.killerImpl, signal: controller.signal,
      timeoutMs: 5000, killGraceMs: 40 }).then(() => null, error => error);
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await new Promise(resolve => setTimeout(resolve, 15));
  const before = { killerCalls: fixture.killerCalls.length, signals: [...fixture.signals] };
  if (settleBy === 'close') fixture.child.emit('close', null);
  return { error: await result, before };
}

test('Windows tree kill targets only a live direct child through the absolute System32 taskkill',
  { skip: process.platform !== 'win32' }, async () => {
    const fixture = treeFixture();
    const { error, before } = await cancelTree(fixture);
    assert.match(error?.message ?? '', /aborted/i);
    assert.equal(before.killerCalls, 1);
    const [call] = fixture.killerCalls;
    assert.match(call.command, /System32[\\/]taskkill\.exe$/i);
    assert.deepEqual(call.args, ['/PID', '4242', '/T', '/F']);
    assert.equal(call.options.shell, false);
  });

test('Windows tree kill is skipped once the direct child has exited, since its PID may be reused',
  { skip: process.platform !== 'win32' }, async () => {
    for (const state of [{ exitCode: 0 }, { signalCode: 'SIGTERM' }]) {
      const fixture = treeFixture(state);
      const { error, before } = await cancelTree(fixture);
      assert.match(error?.message ?? '', /aborted/i);
      assert.equal(fixture.killerCalls.length, 0, `taskkill must not run for ${JSON.stringify(state)}`);
      // A fake kill only records the request; a real exited handle makes this a no-op (documented residual).
      assert.deepEqual(before.signals, ['SIGTERM'], 'requests a direct kill instead of taskkill');
    }
  });

test('Windows tree kill falls back to a direct kill when taskkill errors or exits non-zero',
  { skip: process.platform !== 'win32' }, async () => {
    for (const behavior of [killer => killer.emit('error', new Error('no taskkill')),
      killer => killer.emit('exit', 1, null)]) {
      const fixture = treeFixture({ killerBehavior: behavior });
      const { before } = await cancelTree(fixture);
      assert.equal(before.killerCalls, 1);
      assert.ok(before.signals.includes('SIGKILL'), `no direct fallback: ${before.signals}`);
    }
    const clean = treeFixture({ killerBehavior: killer => killer.emit('exit', 0, null) });
    const { before } = await cancelTree(clean);
    assert.equal(before.signals.includes('SIGKILL'), false, 'successful taskkill needs no fallback');
  });

// Characterization test: this overflow path already behaved this way before the cleanup change,
// so it passes immediately. It pins the behavior; the escalation test below covers the new part.
test('stream overflow starts cleanup and rejects only after the child closes (characterization)', async () => {
  const signals = [];
  let settled = false;
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = (signal = 'SIGTERM') => { signals.push(signal); return true; };
  const result = runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
    { spawnImpl: () => child, timeoutMs: 5000, killGraceMs: 40 })
    .then(() => { settled = true; return null; }, error => { settled = true; return error; });
  await new Promise(resolve => setImmediate(resolve));
  child.stdout.write(Buffer.alloc(8 * 1024 * 1024 + 1));
  await new Promise(resolve => setTimeout(resolve, 15));
  assert.deepEqual(signals, ['SIGTERM']);
  assert.equal(settled, false, 'must not settle before close');
  child.emit('close', null);
  assert.match((await result)?.message ?? '', /exceeded 8 MiB/);
});

test('stream overflow escalates to SIGKILL and reports unconfirmed cleanup when the child ignores termination', async () => {
  const signals = [];
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.kill = (signal = 'SIGTERM') => { signals.push(signal); return true; };
  const result = runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
    { spawnImpl: () => child, timeoutMs: 5000, killGraceMs: 20 }).then(() => null, error => error);
  await new Promise(resolve => setImmediate(resolve));
  child.stdout.write(Buffer.alloc(8 * 1024 * 1024 + 1));
  const error = await result;
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.match(error?.message ?? '', /exceeded 8 MiB.*cleanup unconfirmed/);
});

test('rejects an error assistant response instead of treating it as a completed task', async () => {
  const error = assistant('pilot-gpt', 'sol', 'medium', 'Failed');
  error.message.stopReason = 'error';
  error.message.errorMessage = 'fixture failure';
  const fake = fakeSpawn([error]);
  await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }), /fixture failure/);
});

test('rejects malformed Pi JSON events', async () => {
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    queueMicrotask(() => { child.stdout.end('not-json\n'); child.stderr.end(); child.emit('close', 0); });
    return child;
  };
  await assert.rejects(runRole(policy, 'strategist', 'Plan', '.', '/tmp/role.md',
    { spawnImpl, invocation: { command: 'pi', args: [] } }), /Malformed Pi JSON event/);
});

test('refuses dispatch when the caller signal is already aborted', async () => {
  await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
    { signal: AbortSignal.abort(), spawnImpl: () => { throw Error('should not spawn'); } }), /aborted/);
});

test('reports child process spawn errors', async () => {
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough(); child.stderr = new PassThrough();
    queueMicrotask(() => {
      child.emit('error', Object.assign(new Error('missing executable'), { code: 'ENOENT' }));
      child.emit('close', -1);
    });
    return child;
  };
  await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
    { spawnImpl, invocation: { command: 'pi', args: [] } }), /missing executable/);
});

test('rejects a completed response containing no text', async () => {
  const fake = fakeSpawn([assistant('pilot-gpt', 'sol', 'high', '')]);
  await assert.rejects(runRole(policy, 'strategist', 'Plan', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }), /no final text/);
});

test('fails if child exits without a final assistant response', async () => {
  const fake = fakeSpawn([], 1);
  await assert.rejects(runRole(policy, 'coder', 'Implement', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }), /exited with code 1/);
});
