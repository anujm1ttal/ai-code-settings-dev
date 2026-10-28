import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { runRole } from '../pi/lib/role-runner.mjs';
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

const assistant = (provider, model, thinkingLevel, text) => ({ type: 'message_end', message: {
  role: 'assistant', provider, model, thinkingLevel, stopReason: 'stop',
  content: [{ type: 'text', text }], usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0,
    totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
} });

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
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } });
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

test('rejects any observed auditor bash execution even if policy tools were bypassed', async () => {
  const fake = fakeSpawn([{ type: 'tool_execution_start', toolName: 'bash', args: { command: 'echo should-not-run' } },
    assistant('pilot-claude', 'sonnet', 'high', 'Done')]);
  await assert.rejects(runRole(policy, 'auditor', 'Review', '.', '/tmp/role.md',
    { spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] } }), /Auditor attempted bash/);
});

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
    { spawnImpl, invocation: { command: 'pi', args: [] }, timeoutMs: 10, killGraceMs: 10 }), /timed out/);
  assert.ok(signals.includes('SIGTERM'));
  assert.ok(signals.includes('SIGKILL'));
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
    queueMicrotask(() => child.emit('error', Object.assign(new Error('missing executable'), { code: 'ENOENT' })));
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
