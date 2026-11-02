import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { buildAgentArgs, loadRolePolicy } from '../pi/lib/role-policy.mjs';
import { runRole } from '../pi/lib/role-runner.mjs';

const policy = loadRolePolicy(new URL('./fixtures/pi-role-policy.json', import.meta.url));
const expanded = { ...policy, roles: { ...policy.roles,
  explorer: { model: policy.roles.coder.model, thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] },
  scribe: { model: policy.roles.coder.model, thinking: 'low', tools: ['read'] } } };
const prompt = '/role.md';
const guard = fileURLToPath(new URL('../pi/extensions/guard.ts', import.meta.url));

for (const role of ['strategist', 'coder', 'auditor']) {
  test(`packet-only argv for ${role} has exactly the isolated flags`, () => {
    assert.deepEqual(buildAgentArgs(policy, role, prompt, 'Review', { profile: 'packet-only-review' }), [
      '--mode', 'json', '--print', '--no-session', '--no-extensions', '--no-tools', '--no-context-files',
      '--no-skills', '--no-prompt-templates', '--no-mcp', '--model', policy.roles[role].model,
      '--thinking', policy.roles[role].thinking, '--exclude-tools', 'mcp__*', '--system-prompt', prompt, 'Task: Review',
    ]);
  });
}
test('packet-only rejects non-review roles, unknown profiles and disallowed models', () => {
  for (const role of ['explorer', 'scribe']) assert.throws(() => buildAgentArgs(expanded, role, prompt, 'Review', { profile: 'packet-only-review' }));
  assert.throws(() => buildAgentArgs(policy, 'coder', prompt, 'Review', { profile: 'unknown' }));
  assert.throws(() => buildAgentArgs({ ...policy, allowedModels: [] }, 'coder', prompt, 'Review', { profile: 'packet-only-review' }), /allowlist/);
});
test('existing council and normal coder argv stay unchanged', () => {
  const common = ['--mode', 'json', '--print', '--no-session', '--no-extensions'];
  const tail = ['--model', policy.roles.coder.model, '--thinking', policy.roles.coder.thinking];
  const end = ['--exclude-tools', 'mcp__*', '--append-system-prompt', prompt, 'Task: Review'];
  assert.deepEqual(buildAgentArgs(policy, 'coder', prompt, 'Review', { profile: 'council-read-only' }),
    [...common, ...tail, '--tools', 'read,grep,find,ls', ...end]);
  assert.deepEqual(buildAgentArgs(policy, 'coder', prompt, 'Review'),
    [...common, '--extension', guard, ...tail, '--tools', policy.roles.coder.tools.join(','), ...end]);
});
function fakeSpawn(events) {
  let count = 0;
  return { get count() { return count; }, spawnImpl() {
    count++;
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => {};
    queueMicrotask(() => { for (const event of events) child.stdout.write(`${JSON.stringify(event)}\n`);
      child.stdout.end(); child.stderr.end(); child.emit('close', 0); });
    return child;
  } };
}
const [provider, model] = policy.roles.auditor.model.split('/');
const assistant = { type: 'message_end', message: { role: 'assistant', provider, model,
  thinkingLevel: policy.roles.auditor.thinking, stopReason: 'stop', content: [{ type: 'text', text: 'Done' }] } };
const opts = fake => ({ spawnImpl: fake.spawnImpl, invocation: { command: 'pi', args: [] }, profile: 'packet-only-review' });
test('packet-only runner rejects any observed tool, including read or missing name', async () => {
  for (const toolName of ['read', 'write', undefined]) {
    const fake = fakeSpawn([{ type: 'tool_execution_start', toolName }, assistant]);
    await assert.rejects(runRole(policy, 'auditor', 'Review', '.', prompt, opts(fake)), /Packet-only review profile observed a tool call/);
    assert.equal(fake.count, 1);
  }
});
test('packet-only runner succeeds without tool events', async () => {
  const fake = fakeSpawn([assistant]);
  assert.equal((await runRole(policy, 'auditor', 'Review', '.', prompt, opts(fake))).text, 'Done');
  assert.equal(fake.count, 1);
});
test('packet-only runner refuses a required read before spawning', async () => {
  const fake = fakeSpawn([assistant]);
  await assert.rejects(runRole(policy, 'auditor', 'Review', '.', prompt, { ...opts(fake), requiredReadPath: '/evidence' }), /requiredReadPath/);
  assert.equal(fake.count, 0);
});
test('packet-only profile REPLACES the default system prompt (--system-prompt) and never appends to it', () => {
  for (const role of ['strategist', 'coder', 'auditor']) {
    const argv = buildAgentArgs(policy, role, prompt, 'Review', { profile: 'packet-only-review' });
    assert.ok(argv.includes('--system-prompt')); assert.ok(!argv.includes('--append-system-prompt'));
    assert.equal(argv[argv.indexOf('--system-prompt') + 1], prompt);
  }
});

