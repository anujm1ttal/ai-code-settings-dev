import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadRolePolicy, buildAgentArgs } from '../pi/lib/role-policy.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyFile = path.join(repo, 'tests', 'fixtures', 'pi-role-policy.json');

test('optional jobBudget is validated without changing the role keys', () => {
  const original = loadRolePolicy(policyFile);
  assert.equal(original.jobBudget, undefined);
  const model = original.allowedModels[0];
  const rate = { inputPerMTok: 2, outputPerMTok: 4, cacheReadPerMTok: 0, cacheWritePerMTok: 1 };
  const valid = { perJobUsd: 1, perSessionUsd: 3, rates: { [model]: rate } };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-job-budget-policy-'));
  try {
    const file = path.join(dir, 'policy.json');
    const load = (jobBudget) => { writeFileSync(file, JSON.stringify({ ...original, jobBudget })); return loadRolePolicy(file); };
    assert.deepEqual(load(valid).jobBudget, valid);
    for (const edge of [{ ...valid, perJobUsd: 10, perSessionUsd: 50 }, { ...valid, perJobUsd: 3, perSessionUsd: 3 }]) {
      assert.deepEqual(load(edge).jobBudget, edge, 'upper bounds and perSession == perJob are valid');
    }
    const invalid = [null, [], {},
      ...[0, -1, 11, '1', null].map(perJobUsd => ({ ...valid, perJobUsd })),
      ...[0, 0.5, 51, '3', null].map(perSessionUsd => ({ ...valid, perSessionUsd })),
      ...[null, [], 'x', { 'unknown/model': rate }].map(rates => ({ ...valid, rates })),
      ...['inputPerMTok', 'outputPerMTok'].flatMap(key => [0, -1, null, '2'].map(value => ({ ...valid, rates: { [model]: { ...rate, [key]: value } } }))),
      ...['cacheReadPerMTok', 'cacheWritePerMTok'].flatMap(key => [-1, null, '2'].map(value => ({ ...valid, rates: { [model]: { ...rate, [key]: value } } }))),
      { ...valid, rates: { [model]: null } }, { ...valid, rates: { [model]: [] } }];
    for (const item of invalid) assert.throws(() => load(item), /Invalid jobBudget/, JSON.stringify(item));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('real provider bindings are not stored in the public Pi source tree', () => {
  assert.equal(existsSync(path.join(repo, 'pi', 'role-policy.json')), false);
});

test('loads a read-only strategist and a coder with shell and write tools', () => {
  const original = loadRolePolicy(policyFile);
  const tools = ['read', 'grep', 'find', 'ls'];
  const coderTools = [...tools, 'bash', 'edit', 'write'];
  const configured = { ...original, roles: { ...original.roles,
    strategist: { ...original.roles.strategist, tools },
    coder: { ...original.roles.coder, tools: coderTools } } };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-strategist-policy-'));
  try {
    const file = path.join(dir, 'policy.json');
    writeFileSync(file, JSON.stringify(configured));
    const loaded = loadRolePolicy(file);
    assert.deepEqual(loaded.roles.strategist.tools, tools);
    assert.deepEqual(loaded.roles.coder.tools, coderTools);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('read-only strategist argv contains exactly the four tools and no extension', () => {
  const original = loadRolePolicy(policyFile);
  const configured = { ...original, roles: { ...original.roles,
    strategist: { ...original.roles.strategist, tools: ['read', 'grep', 'find', 'ls'] } } };
  const args = buildAgentArgs(configured, 'strategist', '/tmp/role.md', 'Plan');
  assert.deepEqual(args.slice(args.indexOf('--tools'), args.indexOf('--tools') + 2),
    ['--tools', 'read,grep,find,ls']);
  assert.equal(args.filter(arg => arg === '--tools').length, 1);
  assert.equal(args.includes('--extension'), false);
});

test('loaded strategist policy rejects an MCP tool', () => {
  const original = loadRolePolicy(policyFile);
  const unsafe = { ...original, roles: { ...original.roles,
    strategist: { ...original.roles.strategist, tools: ['read', 'grep', 'find', 'ls', 'mcp__x'] } } };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-strategist-mcp-'));
  try {
    const file = path.join(dir, 'policy.json');
    writeFileSync(file, JSON.stringify(unsafe));
    assert.throws(() => loadRolePolicy(file), /Invalid role configuration for strategist/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

for (const tool of ['bash', 'powershell']) {
  test(`rejects strategist ${tool} in a loaded policy`, () => {
    const original = loadRolePolicy(policyFile);
    const unsafe = { ...original, roles: { ...original.roles,
      strategist: { ...original.roles.strategist, tools: ['read', tool] } } };
    const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-strategist-unsafe-'));
    try {
      const file = path.join(dir, 'policy.json');
      writeFileSync(file, JSON.stringify(unsafe));
      assert.throws(() => loadRolePolicy(file), /Invalid role configuration for strategist/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test(`rejects strategist ${tool} during argv construction`, () => {
    const original = loadRolePolicy(policyFile);
    const unsafe = { ...original, roles: { ...original.roles,
      strategist: { ...original.roles.strategist, tools: ['read', tool] } } };
    assert.throws(() => buildAgentArgs(unsafe, 'strategist', '/tmp/role.md', 'Plan'), /Strategist tools/);
  });
}

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

test('scribe cannot receive shell tools, including after policy load', () => {
  const original = loadRolePolicy(policyFile);
  for (const tool of ['bash', 'powershell']) {
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

test('accepts the four role sets with optional read-only scribe and explorer', () => {
  const original = loadRolePolicy(policyFile);
  const binding = { model: 'pilot-gpt/luna', thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-explorer-policy-'));
  try {
    const file = path.join(dir, 'policy.json');
    for (const optional of [[], ['scribe'], ['explorer'], ['scribe', 'explorer']]) {
      const roles = { ...original.roles };
      for (const name of optional) roles[name] = binding;
      writeFileSync(file, JSON.stringify({ ...original, roles }));
      const loaded = loadRolePolicy(file);
      assert.deepEqual(Object.keys(loaded.roles).sort(), Object.keys(roles).sort());
      assert.equal(loaded.allowedModels.length, 5);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('rejects concierge and unknown role keys with a migration message', () => {
  const original = loadRolePolicy(policyFile);
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-role-keys-'));
  try {
    const file = path.join(dir, 'policy.json');
    for (const name of ['concierge', 'unknown']) {
      for (const withScribe of [false, true]) {
        const roles = { ...original.roles, [name]: original.roles.auditor };
        if (withScribe) roles.scribe = original.roles.auditor;
        writeFileSync(file, JSON.stringify({ ...original, roles }));
        assert.throws(() => loadRolePolicy(file), (error) =>
          /concierge/i.test(error.message) && /explorer/i.test(error.message));
      }
    }
    writeFileSync(file, JSON.stringify({ ...original,
      roles: { 'auditor,coder,strategist': original.roles.auditor } }));
    assert.throws(() => loadRolePolicy(file), (error) =>
      /concierge/i.test(error.message) && /explorer/i.test(error.message));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('buildAgentArgs rejects a mutated concierge role with shell and write tools', () => {
  const original = loadRolePolicy(policyFile);
  const mutated = { ...original, roles: { ...original.roles,
    concierge: { ...original.roles.coder, tools: ['bash', 'edit', 'write'] } } };
  assert.throws(() => buildAgentArgs(mutated, 'concierge', '/tmp/role.md', 'Explore'),
    /concierge.*explorer/i);
});

test('duplicate explorer tools of the correct length are rejected at load and argv construction', () => {
  const original = loadRolePolicy(policyFile);
  const mutated = { ...original, roles: { ...original.roles,
    explorer: { ...original.roles.auditor, tools: ['read', 'read', 'grep', 'find'] } } };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-explorer-duplicate-'));
  try {
    const file = path.join(dir, 'policy.json');
    writeFileSync(file, JSON.stringify(mutated));
    assert.throws(() => loadRolePolicy(file), /explorer/i);
    assert.throws(() => buildAgentArgs(mutated, 'explorer', '/tmp/role.md', 'Explore'), /explorer/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('explorer requires each read tool exactly once at load and after mutation', () => {
  const original = loadRolePolicy(policyFile);
  const tools = ['read', 'grep', 'find', 'ls'];
  const expanded = { ...original, roles: { ...original.roles,
    explorer: { model: 'pilot-gpt/luna', thinking: 'low', tools } } };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-explorer-tools-'));
  try {
    const file = path.join(dir, 'policy.json');
    writeFileSync(file, JSON.stringify(expanded));
    const loaded = loadRolePolicy(file);
    const invalid = [
      ...tools.map((missing) => tools.filter((tool) => tool !== missing)),
      [...tools, 'read'],
      ...['powershell', 'bash', 'edit', 'write', 'unknown'].map((extra) => [...tools, extra]),
      null,
    ];
    for (const candidate of invalid) {
      loaded.roles.explorer.tools = candidate;
      writeFileSync(file, JSON.stringify(loaded));
      assert.throws(() => loadRolePolicy(file), /explorer/i, `load: ${candidate}`);
      assert.throws(() => buildAgentArgs(loaded, 'explorer', '/tmp/role.md', 'Explore'),
        /explorer/i, `args: ${candidate}`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('valid explorer builds exact read-only argv even when tools are reordered', () => {
  const original = loadRolePolicy(policyFile);
  const expanded = { ...original, roles: { ...original.roles,
    explorer: { model: 'pilot-gpt/luna', thinking: 'low', tools: ['ls', 'find', 'grep', 'read'] } } };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-explorer-argv-'));
  try {
    const file = path.join(dir, 'policy.json');
    writeFileSync(file, JSON.stringify(expanded));
    const args = buildAgentArgs(loadRolePolicy(file), 'explorer', '/tmp/role.md', 'Explore');
    assert.deepEqual(args, ['--mode', 'json', '--print', '--no-session', '--no-extensions', '--no-mcp',
      '--model', 'pilot-gpt/luna', '--thinking', 'low', '--tools', 'read,grep,find,ls',
      '--exclude-tools', 'mcp__*', '--append-system-prompt', '/tmp/role.md', 'Task: Explore']);
    assert.equal(args.includes('--extension'), false);
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
    const writer = policy.roles[name].tools.some(t => ['edit', 'write'].includes(t));
    const shell = policy.roles[name].tools.includes('bash');
    assert.deepEqual(extensions, [...(writer ? [path.join(repo, 'pi', 'extensions', 'role-guard.ts')] : []),
      ...(writer || shell ? [path.join(repo, 'pi', 'extensions', 'guard.ts')] : [])]);
  }
});

test('role maxima, duplicate and unknown tools are enforced at load and argv', () => {
  const base = loadRolePolicy(policyFile);
  const R = ['read', 'grep', 'find', 'ls'];
  const roles = { ...base.roles, strategist: { ...base.roles.strategist, tools: [...R, 'edit', 'write'] },
    coder: { ...base.roles.coder, tools: [...R, 'bash', 'edit', 'write'] },
    scribe: { ...base.roles.strategist, tools: [...R, 'edit', 'write'] },
    explorer: { ...base.roles.strategist, tools: R } };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-maxima-'));
  try {
    const file = path.join(dir, 'policy.json');
    const load = value => { writeFileSync(file, JSON.stringify(value)); return loadRolePolicy(file); };
    const full = { ...base, roles }; assert.deepEqual(load(full).roles, roles);
    for (const [role, tools] of [['auditor', [...R, 'edit']], ['scribe', [...R, 'bash']],
      ['explorer', [...R, 'write']], ['coder', [...R, 'powershell']], ['coder', [...R, 'read']],
      ['strategist', [...R, 'unknown']]]) {
      const bad = { ...full, roles: { ...roles, [role]: { ...roles[role], tools } } };
      assert.throws(() => load(bad), /role|tools/i, `${role}: ${tools}`);
      assert.throws(() => buildAgentArgs(bad, role, '/prompt', 'task'), /role|tools/i);
    }
    for (const role of ['strategist', 'auditor', 'scribe']) roles[role] = { ...roles[role], tools: R };
    assert.deepEqual(load({ ...base, roles }).roles, roles);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('writer argv order and enforced read-only profiles for every eligible role', () => {
  const base = loadRolePolicy(policyFile); const R = ['read', 'grep', 'find', 'ls'];
  const roles = { ...base.roles, strategist: { ...base.roles.strategist, tools: [...R, 'edit', 'write'] },
    scribe: { ...base.roles.strategist, tools: [...R, 'edit', 'write'] } };
  for (const role of ['strategist', 'coder', 'auditor', 'scribe']) {
    const args = buildAgentArgs({ ...base, roles }, role, '/prompt', 'task');
    assert.equal(args[args.indexOf('--tools') + 1], roles[role].tools.join(','));
    const extensions = args.flatMap((arg, i) => arg === '--extension' ? [path.basename(args[i + 1])] : []);
    assert.deepEqual(extensions, role === 'auditor' ? [] : ['role-guard.ts', 'guard.ts']);
    const read = buildAgentArgs({ ...base, roles }, role, '/prompt', 'task', { profile: 'read-only' });
    assert.equal(read[read.indexOf('--tools') + 1], R.join(',')); assert.ok(!read.includes('--extension'));
  }
  const shell = { ...base, roles: { ...roles, coder: { ...roles.coder, tools: ['bash'] } } };
  assert.deepEqual(buildAgentArgs(shell, 'coder', '/prompt', 'task').flatMap((x, i, a) => x === '--extension' ? [path.basename(a[i+1])] : []), ['guard.ts']);
});

test('unlisted model or role rejects before a child can start', () => {
  const policy = loadRolePolicy(policyFile);
  assert.throws(() => buildAgentArgs(policy, 'unknown', '/tmp/role.md', 'x'), /Unknown role/);
  assert.throws(() => buildAgentArgs({ ...policy, roles: { ...policy.roles, coder: {
    ...policy.roles.coder, model: 'unlisted/foreign-model',
  } } }, 'coder', '/tmp/role.md', 'x'), /not in the explicit model allowlist/);
});

test('jobBudget accepts tiered and labelled rates and still rejects malformed ones', () => {
  const original = loadRolePolicy(policyFile);
  const model = original.allowedModels[0];
  const tiered = { status: 'verified', source: 'test', cacheWriteRetention: '5m', tiers: [
    { upToPromptTokens: 100000, inputPerMTok: 0.1, outputPerMTok: 0.5, cacheReadPerMTok: 0.01, cacheWritePerMTok: 0.125 },
    { inputPerMTok: 0.5, outputPerMTok: 2.5, cacheReadPerMTok: 0.05, cacheWritePerMTok: 0.625 }] };
  const labelled = { status: 'provisional', inputPerMTok: 1, outputPerMTok: 5 };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'pi-tier-policy-'));
  try {
    const file = path.join(dir, 'policy.json');
    const load = (rate) => { writeFileSync(file, JSON.stringify({ ...original, jobBudget: { perJobUsd: 1, perSessionUsd: 3, rates: { [model]: rate } } })); return loadRolePolicy(file); };
    assert.deepEqual(load(tiered).jobBudget.rates[model], tiered);
    assert.deepEqual(load(labelled).jobBudget.rates[model], labelled);
    for (const bad of [{ ...tiered, status: 'guess' }, { tiers: [] }, { ...tiered, cacheWriteRetention: '7d' },
      { tiers: [{ inputPerMTok: 0, outputPerMTok: 1 }] }, { inputPerMTok: 1 }]) {
      assert.throws(() => load(bad), /Invalid jobBudget/, JSON.stringify(bad));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

