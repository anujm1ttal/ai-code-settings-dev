import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadRolePolicy, buildAgentArgs } from '../pi/lib/role-policy.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyFile = path.join(repo, 'tests', 'fixtures', 'pi-role-policy.json');

test('real provider bindings are not stored in the public Pi source tree', () => {
  assert.equal(existsSync(path.join(repo, 'pi', 'role-policy.json')), false);
});

test('accepts a fourth, read-only scribe binding without expanding the five-model allowlist', () => {
  const original = loadRolePolicy(policyFile);
  const expanded = { ...original, roles: { ...original.roles,
    scribe: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] } } };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-scribe-policy-'));
  try {
    const file = path.join(dir, 'policy.json');
    writeFileSync(file, JSON.stringify(expanded));
    const loaded = loadRolePolicy(file);
    assert.equal(loaded.roles.scribe.model, 'pilot-gpt/luna');
    assert.equal(loaded.allowedModels.length, 5);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('scribe argv has only four read tools and no discovered or explicit extensions', () => {
  const original = loadRolePolicy(policyFile);
  const expanded = { ...original, roles: { ...original.roles,
    scribe: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] } } };
  const args = buildAgentArgs(expanded, 'scribe', '/tmp/role.md', 'Explain');
  assert.deepEqual(args.slice(args.indexOf('--tools'), args.indexOf('--tools') + 2),
    ['--tools', 'read,grep,find,ls']);
  assert.ok(args.includes('--no-extensions'));
  assert.deepEqual(args.slice(args.indexOf('--exclude-tools'), args.indexOf('--exclude-tools') + 2),
    ['--exclude-tools', 'mcp__*']);
  assert.equal(args.includes('--extension'), false);
});

test('scribe cannot receive shell or write tools, including after policy load', () => {
  const original = loadRolePolicy(policyFile);
  for (const tool of ['bash', 'powershell', 'edit', 'write']) {
    const unsafe = { ...original, roles: { ...original.roles,
      scribe: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', tool] } } };
    const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-scribe-unsafe-'));
    try {
      const file = path.join(dir, 'policy.json');
      writeFileSync(file, JSON.stringify(unsafe));
      assert.throws(() => loadRolePolicy(file), /scribe.*tools|Invalid role configuration for scribe/i);
      assert.throws(() => buildAgentArgs(unsafe, 'scribe', '/tmp/role.md', 'Review'), /scribe.*tools/i);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('concierge policy is an exact no-shell two-write-tool binding and loads the vetted guard', () => {
  const original = loadRolePolicy(policyFile);
  const expanded = { ...original, roles: { ...original.roles,
    scribe: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] },
    concierge: { model: 'pilot-claude/haiku', thinking: 'low', tools: ['read', 'grep', 'find', 'ls', 'edit', 'write'] } } };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-concierge-policy-'));
  try {
    const file = path.join(dir, 'policy.json');
    writeFileSync(file, JSON.stringify(expanded));
    assert.equal(loadRolePolicy(file).roles.concierge.model, 'pilot-claude/haiku');
    const args = buildAgentArgs(expanded, 'concierge', '/tmp/role.md', 'Sync');
    assert.equal(args[args.indexOf('--tools') + 1], 'read,grep,find,ls,edit,write');
    assert.equal(args[args.indexOf('--extension') + 1], path.join(repo, 'pi/extensions/guard.ts'));
    assert.ok(args.includes('--no-extensions'));
    for (const tool of ['bash', 'powershell']) {
      const unsafe = { ...expanded, roles: { ...expanded.roles,
        concierge: { ...expanded.roles.concierge, tools: [...expanded.roles.concierge.tools, tool] } } };
      writeFileSync(file, JSON.stringify(unsafe));
      assert.throws(() => loadRolePolicy(file), /concierge/i);
      assert.throws(() => buildAgentArgs(unsafe, 'concierge', '/tmp/role.md', 'Sync'), /concierge/i);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('council coder profile overrides writable tools without changing normal coder binding', () => {
  const configured = loadRolePolicy(policyFile);
  const ordinary = buildAgentArgs(configured, 'coder', '/tmp/coder.md', 'Implement');
  assert.match(ordinary[ordinary.indexOf('--tools') + 1], /bash/);
  const council = buildAgentArgs(configured, 'coder', '/tmp/council.md', 'Critique', { profile: 'council-read-only' });
  assert.equal(council[council.indexOf('--tools') + 1], 'read,grep,find,ls');
  assert.equal(council.includes('--extension'), false);
  assert.ok(council.includes('--no-extensions'));
  assert.equal(council[council.indexOf('--model') + 1], configured.roles.coder.model);
  assert.equal(council[council.indexOf('--thinking') + 1], configured.roles.coder.thinking);
  const withScribe = { ...configured, roles: { ...configured.roles,
    scribe: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] } } };
  assert.throws(() => buildAgentArgs(withScribe, 'scribe', '/tmp/council.md', 'x', { profile: 'council-read-only' }), /council/i);
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

test('shell/write-capable children load only the vetted guard explicitly', () => {
  const policy = loadRolePolicy(policyFile);
  for (const name of ['coder', 'strategist', 'auditor']) {
    const args = buildAgentArgs(policy, name, '/tmp/role.md', 'Review');
    assert.ok(args.includes('--no-extensions'));
    const extensions = args.flatMap((arg, index) => arg === '--extension' ? [args[index + 1]] : []);
    assert.equal(extensions.length, policy.roles[name].tools.some(t => ['bash', 'powershell', 'edit', 'write'].includes(t)) ? 1 : 0);
    for (const extension of extensions) {
      assert.ok(path.isAbsolute(extension));
      assert.equal(extension, path.join(repo, 'pi', 'extensions', 'guard.ts'));
    }
  }
});

test('unlisted model or role rejects before a child can start', () => {
  const policy = loadRolePolicy(policyFile);
  assert.throws(() => buildAgentArgs(policy, 'concierge', '/tmp/role.md', 'x'), /Unknown role/);
  assert.throws(() => buildAgentArgs({ ...policy, roles: { ...policy.roles, coder: {
    ...policy.roles.coder, model: 'unlisted/foreign-model',
  } } }, 'coder', '/tmp/role.md', 'x'), /not in the explicit model allowlist/);
});
