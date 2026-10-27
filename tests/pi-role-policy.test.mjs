import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadRolePolicy, buildAgentArgs } from '../pi/lib/role-policy.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyFile = path.join(repo, 'tests', 'fixtures', 'pi-role-policy.json');

test('real provider bindings are not stored in the public Pi source tree', () => {
  assert.equal(existsSync(path.join(repo, 'pi', 'role-policy.json')), false);
});

test('only five explicitly configured private-policy models are allowed', () => {
  const policy = loadRolePolicy(policyFile);
  assert.deepEqual(policy.allowedModels, [
    'pilot-gpt/sol',
    'pilot-gpt/luna',
    'pilot-claude/opus',
    'pilot-claude/sonnet',
    'pilot-claude/haiku',
  ]);
  assert.deepEqual(Object.keys(policy.roles).sort(), ['auditor', 'coder', 'strategist']);
});

test('each pilot role gets an exact model and explicit thinking level', () => {
  const policy = loadRolePolicy(policyFile);
  for (const [roleName, model, thinking] of [
    ['strategist', 'pilot-gpt/sol', 'high'],
    ['coder', 'pilot-gpt/sol', 'medium'],
    ['auditor', 'pilot-claude/sonnet', 'high'],
  ]) {
    const args = buildAgentArgs(policy, roleName, '/tmp/role.md', 'Review a fixture');
    assert.deepEqual(args.slice(args.indexOf('--model'), args.indexOf('--model') + 2), ['--model', model]);
    assert.deepEqual(args.slice(args.indexOf('--thinking'), args.indexOf('--thinking') + 2), ['--thinking', thinking]);
  }
});

test('auditor has no shell, edit/write, extension, or MCP tools', () => {
  const policy = loadRolePolicy(policyFile);
  const args = buildAgentArgs(policy, 'auditor', '/tmp/role.md', 'Review a fixture');
  assert.deepEqual(args.slice(args.indexOf('--tools'), args.indexOf('--tools') + 2),
    ['--tools', 'read,grep,find,ls']);
  assert.deepEqual(args.slice(args.indexOf('--exclude-tools'), args.indexOf('--exclude-tools') + 2),
    ['--exclude-tools', 'mcp__*']);
  assert.ok(args.includes('--no-extensions'));
  assert.ok(!args.includes('bash'));
  assert.ok(!args.includes('edit'));
  assert.ok(!args.includes('write'));
});

test('refuses a private policy that gives the auditor shell or write tools', () => {
  const policy = loadRolePolicy(policyFile);
  for (const tool of ['bash', 'powershell', 'edit', 'write']) {
    const unsafe = { ...policy, roles: { ...policy.roles,
      auditor: { ...policy.roles.auditor, tools: [...policy.roles.auditor.tools, tool] } } };
    assert.throws(() => buildAgentArgs(unsafe, 'auditor', '/tmp/role.md', 'Review'), /Auditor tools/);
  }
});

test('unlisted model or role rejects before a child can start', () => {
  const policy = loadRolePolicy(policyFile);
  assert.throws(() => buildAgentArgs(policy, 'concierge', '/tmp/role.md', 'x'), /Unknown role/);
  assert.throws(() => buildAgentArgs({ ...policy, roles: { ...policy.roles, coder: {
    ...policy.roles.coder, model: 'unlisted/foreign-model',
  } } }, 'coder', '/tmp/role.md', 'x'), /not in the explicit model allowlist/);
});
