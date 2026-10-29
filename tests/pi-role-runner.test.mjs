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
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    toolCounts: {}, successfulReads: 0 });
});

test('explorer dispatches without project state and reports bounded tool metadata', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-explorer-dispatch-'));
  const expanded = { ...policy, roles: { ...policy.roles,
    explorer: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] } } };
  const fake = fakeSpawn([
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
  const allowed = fakeSpawn([assistant('pilot-gpt', 'sol', 'medium', 'Perspective')]);
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
  const read = fakeSpawn([{ type: 'tool_execution_start', toolCallId: 'e2', toolName: 'read', args: { path: file } },
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
