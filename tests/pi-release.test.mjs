import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulePath = path.join(sourceRoot, 'pi/lib/release-preview.mjs');

async function release() {
  assert.ok(fs.existsSync(modulePath), 'Pi isolated preview module must exist');
  return import(pathToFileURL(modulePath).href);
}

function sandbox() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t16-'));
  fs.writeFileSync(path.join(root, '.pi-pilot-sandbox'), 'pi-t16-isolated\n');
  return root;
}

function snapshot(root) {
  const rows = [];
  function visit(dir, relative = '') {
    for (const name of fs.readdirSync(dir).sort()) {
      const entry = path.join(dir, name);
      const rel = path.join(relative, name);
      if (fs.statSync(entry).isDirectory()) { rows.push([rel, 'directory']); visit(entry, rel); }
      else rows.push([rel, fs.readFileSync(entry)]);
    }
  }
  visit(root);
  return rows;
}

test('preview stages the scoped runtime at the default dispatch path', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const runner = await import(pathToFileURL(path.join(staged.destination, 'pi/lib/role-runner.mjs')).href);
    const { loadRolePolicy } = await import(pathToFileURL(path.join(staged.destination, 'pi/lib/role-policy.mjs')).href);
    const { EventEmitter } = await import('node:events');
    const { PassThrough } = await import('node:stream');
    const policy = loadRolePolicy(path.join(sourceRoot, 'tests/fixtures/pi-role-policy.json'));
    let dispatched;
    const spawnImpl = (command, args) => {
      dispatched = { command, launcher: args[0] };
      const child = new EventEmitter();
      child.stdout = new PassThrough(); child.stderr = new PassThrough();
      queueMicrotask(() => {
        for (const event of [
          { type: 'pi_child_runtime', retryEnabled: false, retryMaxRetries: 0, providerMaxRetries: 0, compactionEnabled: false },
          { type: 'message_end', message: { role: 'assistant', provider: 'pilot-gpt', model: 'sol', thinkingLevel: 'medium',
            stopReason: 'stop', content: [{ type: 'text', text: 'done' }],
            usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2 } } },
        ]) child.stdout.write(JSON.stringify(event) + '\n');
        child.stdout.end(); child.stderr.end(); child.emit('close', 0);
      });
      return child;
    };
    const result = await runner.runRole(policy, 'coder', 'fixture', root, '/role.md', { spawnImpl });
    assert.equal(result.runtimeVerified, true);
    assert.equal(dispatched.command, process.execPath);
    assert.equal(dispatched.launcher, path.join(staged.destination, 'pi/lib/child-runtime.mjs'));
    assert.equal(fs.readFileSync(dispatched.launcher, 'utf8'), fs.readFileSync(path.join(sourceRoot, 'pi/lib/child-runtime.mjs'), 'utf8'));
    rollbackPreview(staged);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('preview stages the complete role guard closure byte-for-byte', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const closure = ['pi/extensions/role-guard.ts', 'pi/lib/role-guard-core.mjs',
      'pi/lib/role-ownership.mjs', 'pi/lib/todo-ownership.mjs', 'pi/lib/verdict.mjs'];
    for (const relative of closure) {
      const target = path.join(staged.destination, relative);
      assert.ok(fs.existsSync(target), `${relative} must be staged`);
      assert.deepEqual(fs.readFileSync(target), fs.readFileSync(path.join(sourceRoot, relative)), relative);
    }
    // Follow literal static and dynamic relative imports from the staged guard transitively.
    const visited = new Set(), pending = [closure[0]];
    while (pending.length) {
      const relative = pending.pop();
      if (visited.has(relative)) continue;
      visited.add(relative);
      const text = fs.readFileSync(path.join(staged.destination, relative), 'utf8');
      const imports = [...text.matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)]
        .map(match => match[1] ?? match[2]);
      if (relative === closure[0] || relative === closure[1]) {
        assert.ok(imports.length, `${relative} must have a relative import to check`);
      }
      for (const specifier of imports) {
        const target = path.resolve(staged.destination, path.dirname(relative), specifier);
        const next = path.relative(staged.destination, target);
        assert.ok(next && next !== '..' && !next.startsWith(`..${path.sep}`) && !path.isAbsolute(next),
          `${relative} import ${specifier} must stay inside the staged tree`);
        assert.ok(fs.existsSync(target), `${relative} import ${specifier} must resolve in the staged tree`);
        assert.deepEqual(fs.readFileSync(target), fs.readFileSync(path.join(sourceRoot, next)), next);
        pending.push(next.split(path.sep).join('/'));
      }
    }
    assert.ok(closure.every(relative => visited.has(relative)), 'all known guard dependencies were traversed');
    rollbackPreview(staged);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('preview stages child recorder and its complete import closure without parent activation', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const start = 'pi/extensions/auditor-recorder.ts';
    const settings = JSON.parse(fs.readFileSync(path.join(staged.destination, 'settings.json'), 'utf8'));
    assert.ok(!settings.extensions.includes(start));
    const visited = new Set(), pending = [start];
    while (pending.length) {
      const rel = pending.pop(); if (visited.has(rel)) continue; visited.add(rel);
      const target = path.join(staged.destination, rel);
      assert.ok(fs.existsSync(target), `${rel} must be staged`);
      const bytes = fs.readFileSync(target);
      assert.deepEqual(bytes, fs.readFileSync(path.join(sourceRoot, rel)), rel);
      for (const match of bytes.toString('utf8').matchAll(/\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
        const next = path.relative(staged.destination, path.resolve(path.dirname(target), match[1] ?? match[2]));
        assert.ok(next && next !== '..' && !next.startsWith(`..${path.sep}`) && !path.isAbsolute(next));
        pending.push(next.split(path.sep).join('/'));
      }
    }
    for (const rel of ['pi/lib/auditor-recorder.mjs', 'pi/lib/role-ownership.mjs', 'pi/lib/todo-ownership.mjs', 'pi/lib/verdict.mjs']) assert.ok(visited.has(rel), `${rel} traversed`);
    rollbackPreview(staged);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('isolated preview stages the concierge guard dependency used by the selected guard extension', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const handle = stagePreview({ sourceRoot, sandboxRoot: root });
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/concierge-guard.mjs')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/agents/council-perspectives.md')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/council-evidence.mjs')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/council-perspective.mjs')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/council-session.mjs')));
    for (const lib of ['pi/lib/job-manager.mjs', 'pi/lib/explorer-jobs.mjs', 'pi/lib/audit-evidence.mjs']) {
      assert.ok(fs.existsSync(path.join(handle.destination, lib)), `${lib} must be staged: role-agent.ts imports it`);
    }
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/job-budget.mjs')), 'job budget module must be staged');
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/expensive-gate.mjs')), 'expensive gate module must be staged');
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/agents/council-synthesis.md')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/prompts/council.md')));
    for (const lib of ['read-intercept', 'bulk-admission', 'role-policy', 'pricing', 'verdict']) {
      assert.ok(fs.existsSync(path.join(handle.destination, `pi/lib/${lib}.mjs`)), `${lib} must be staged: guard.ts imports it`);
    }
    // The staged guard must actually load from the staged tree (a missing dependency would throw here).
    const stagedGuard = await import(pathToFileURL(path.join(handle.destination, 'pi/extensions/guard.ts')).href);
    const events = new Map(); stagedGuard.default({ on: (name, fn) => events.set(name, fn) });
    assert.equal(typeof events.get('tool_call'), 'function');
    rollbackPreview(handle);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('PI-4 preview stages exact job dependencies and loads the budget-denying job tool', async (t) => {
  const sdkPath = process.env.PI_CODING_AGENT_SDK_PATH;
  if (!sdkPath) return t.skip('Set PI_CODING_AGENT_SDK_PATH for Pi runtime discovery');
  const root = sandbox();
  const previous = process.env.PI_ROLE_POLICY_PATH;
  let staged;
  try {
    const agent = path.join(root, 'agent');
    fs.mkdirSync(agent);
    fs.writeFileSync(path.join(agent, 'prior.txt'), 'pre-existing sandbox state');
    const before = snapshot(agent);
    const { stagePreview, rollbackPreview } = await release();
    staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    for (const relative of ['pi/extensions/role-agent.ts', 'pi/lib/job-manager.mjs', 'pi/lib/explorer-jobs.mjs',
      'pi/lib/audit-evidence.mjs', 'pi/lib/job-budget.mjs', 'pi/lib/expensive-gate.mjs',
      'pi/lib/role-policy.mjs', 'pi/lib/role-runner.mjs', 'pi/lib/council-evidence.mjs',
      'pi/lib/council-perspective.mjs', 'pi/lib/council-session.mjs',
      'pi/agents/explorer.md', 'pi/agents/strategist.md', 'pi/agents/auditor.md']) {
      assert.equal(hash(path.join(staged.destination, relative)), hash(path.join(sourceRoot, relative)), relative);
    }
    const policyPath = path.join(root, 'policy.json');
    fs.copyFileSync(path.join(sourceRoot, 'tests/fixtures/pi-role-policy.json'), policyPath);
    process.env.PI_ROLE_POLICY_PATH = policyPath;
    const { DefaultResourceLoader } = await import(pathToFileURL(sdkPath).href);
    const loader = new DefaultResourceLoader({ cwd: root, agentDir: staged.destination, noExtensions: true,
      additionalExtensionPaths: [path.join(staged.destination, 'pi/extensions/role-agent.ts')] });
    await loader.reload();
    const loaded = loader.getExtensions();
    assert.deepEqual(loaded.errors, []);
    const extension = loaded.extensions[0];
    assert.ok(extension.tools.has('pi_role_agent'));
    assert.ok(extension.tools.has('pi_council'));
    const tool = extension.tools.get('pi_explorer_job')?.definition;
    assert.ok(tool, 'strategist-only eligible policy must register the staged job tool');
    const context = { cwd: root };
    assert.match((await tool.execute('status', { action: 'status' }, undefined, undefined, context)).content[0].text, /No jobs/);
    await assert.rejects(tool.execute('start', { action: 'start', task: 'fixture', role: 'strategist' },
      undefined, undefined, context), /job budget is not configured/);
    assert.match((await tool.execute('status2', { action: 'status' }, undefined, undefined, context)).content[0].text, /No jobs/);
    rollbackPreview(staged);
    staged = undefined;
    assert.deepEqual(snapshot(agent), before, 'PI-4 staged runtime rollback restores prior sandbox bytes');
    assert.equal(fs.existsSync(path.join(root, 'backup')), false);
  } finally {
    if (previous === undefined) delete process.env.PI_ROLE_POLICY_PATH; else process.env.PI_ROLE_POLICY_PATH = previous;
    if (staged) (await release()).rollbackPreview(staged);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('isolated preview stages the explorer prompt unchanged and excludes retired concierge resources', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const explorer = 'pi/agents/explorer.md';
    const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.ok(fs.existsSync(path.join(staged.destination, explorer)), 'staged explorer prompt is present');
    assert.equal(hash(path.join(staged.destination, explorer)), hash(path.join(sourceRoot, explorer)));
    assert.ok(fs.existsSync(path.join(staged.destination, 'pi/lib/concierge-guard.mjs')), 'retained guard is present');
    for (const retired of ['pi/agents/concierge.md', 'pi/lib/concierge-evidence.mjs']) {
      assert.equal(fs.existsSync(path.join(staged.destination, retired)), false, `${retired} is absent`);
    }
    rollbackPreview(staged);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fresh disposable Pi consumer sees explorer roles and only its selected plugin', async () => {
  const root = sandbox();
  const launcher = path.join(os.homedir(), '.pi/agent/bin/pi-launcher.js');
  assert.ok(fs.existsSync(launcher), 'installed Pi CLI required for T16 resource smoke');
  let staged;
  try {
    const { stagePreview, rollbackPreview } = await release();
    staged = stagePreview({ sourceRoot, sandboxRoot: root });
    const opted = path.join(root, 'opted');
    const control = path.join(root, 'control');
    fs.mkdirSync(path.join(opted, '.pi'), { recursive: true });
    fs.mkdirSync(control);
    fs.writeFileSync(path.join(opted, '.pi/settings.json'), JSON.stringify({ packages: [{
      source: path.join(sourceRoot, 'optional_plugins/manuscript'),
      skills: ['skills/manuscript-review/SKILL.md'], extensions: [], prompts: [], themes: [],
    }] }));
    const policy = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'tests/fixtures/pi-role-policy.json'), 'utf8'));
    policy.roles.explorer = { model: policy.roles.strategist.model, thinking: 'low', tools: ['read', 'grep', 'find', 'ls'] };
    const policyPath = path.join(root, 'policy.json');
    fs.writeFileSync(policyPath, JSON.stringify(policy));
    const env = { ...process.env, PI_CODING_AGENT_DIR: staged.destination,
      PI_ROLE_POLICY_PATH: policyPath,
      PI_OFFLINE: '1', PI_TELEMETRY: '0' };
    const run = (cwd) => {
      const result = spawnSync(process.execPath,
        [launcher, '--mode', 'rpc', '--no-session', '--offline', '--no-mcp', '--approve'],
        { cwd, env, input: '{"type":"get_commands","id":"probe"}\n{"type":"prompt","message":"/pi-roles","id":"roles"}\n', encoding: 'utf8', timeout: 20000 });
      assert.equal(result.status, 0, result.stderr);
      const response = result.stdout.split(/\r?\n/).filter(Boolean).map(JSON.parse)
        .find(event => event.id === 'probe' && event.type === 'response');
      assert.ok(response?.success, result.stdout + result.stderr);
      const events = result.stdout.split(/\r?\n/).filter(Boolean).map(JSON.parse);
      assert.ok(events.some(event => event.id === 'roles' && event.type === 'response' && event.success), 'pi-roles command succeeded');
      assert.ok(events.some(event => event.type === 'extension_ui_request' && event.method === 'notify' &&
        /explorer:.*tools: read, grep, find, ls/.test(event.message) && !/concierge:/.test(event.message)),
      'pi-roles shows explorer and no concierge');
      return response.data.commands.map(item => item.name);
    };
    const enabled = run(opted);
    assert.ok(enabled.includes('pi-roles'), 'staged role extension');
    assert.ok(enabled.includes('blueprint'), 'staged Pi prompt');
    assert.ok(enabled.includes('skill:manuscript-review'), 'project-selected first-party skill');
    assert.equal(run(control).includes('skill:manuscript-review'), false);
    rollbackPreview(staged);
    staged = undefined;
  } finally {
    if (staged) (await release()).rollbackPreview(staged);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('staging rejects a dangling backup junction before copying or overwriting it', async () => {
  const root = sandbox();
  const link = path.join(root, 'backup');
  fs.symlinkSync(path.join(root, 'does-not-exist'), link, 'junction');
  try {
    const { stagePreview } = await release();
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: root }), /Symlink in isolated destination/);
    assert.equal(fs.existsSync(path.join(root, 'agent')), false);
    assert.ok(fs.lstatSync(link).isSymbolicLink());
  } finally { fs.unlinkSync(link); fs.rmSync(root, { recursive: true, force: true }); }
});

test('staging rejects a symlink child inside an otherwise isolated agent', async () => {
  const root = sandbox();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t16-child-target-'));
  const agent = path.join(root, 'agent');
  fs.mkdirSync(agent);
  const link = path.join(agent, 'linked');
  fs.symlinkSync(outside, link, 'junction');
  try {
    const { stagePreview } = await release();
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: root }), /Symlink in isolated destination/);
  } finally {
    fs.unlinkSync(link); fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('staging rejects an agent root junction before writing through it', async () => {
  const root = sandbox();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t16-outside-'));
  const link = path.join(root, 'agent');
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'outside sentinel');
  fs.symlinkSync(outside, link, 'junction');
  const before = snapshot(outside);
  try {
    const { stagePreview } = await release();
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: root }), /Symlink in isolated destination/);
    assert.deepEqual(snapshot(outside), before);
  } finally {
    fs.unlinkSync(link);
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('failed staging restores prior isolated files without leaving a backup behind', async () => {
  const root = sandbox();
  try {
    const agent = path.join(root, 'agent');
    fs.mkdirSync(agent);
    fs.writeFileSync(path.join(agent, 'keep.txt'), 'prior state');
    const before = snapshot(agent);
    const { stagePreview } = await release();
    assert.throws(() => stagePreview({ sourceRoot: root, sandboxRoot: root }));
    assert.deepEqual(snapshot(agent), before);
    assert.equal(fs.existsSync(path.join(root, 'backup')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Pi preview refuses an unmarked destination and a backup it did not create', async () => {
  const unmarked = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-t16-unmarked-'));
  const root = sandbox();
  try {
    const { stagePreview } = await release();
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: unmarked }));
    assert.equal(fs.readdirSync(unmarked).length, 0);
    fs.mkdirSync(path.join(root, 'backup'));
    fs.writeFileSync(path.join(root, 'backup/keep.txt'), 'existing backup');
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: root }), /existing.*backup/i);
    assert.equal(fs.readFileSync(path.join(root, 'backup/keep.txt'), 'utf8'), 'existing backup');
    assert.equal(fs.existsSync(path.join(root, 'agent')), false);
  } finally {
    fs.rmSync(unmarked, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('rollback restores the prior isolated agent directory byte-for-byte', async () => {
  const root = sandbox();
  try {
    const agent = path.join(root, 'agent');
    fs.mkdirSync(path.join(agent, 'notes'), { recursive: true });
    fs.writeFileSync(path.join(agent, 'AGENTS.md'), Buffer.from([0, 255, 65]));
    fs.writeFileSync(path.join(agent, 'settings.json'), '{"old":true}\n');
    fs.writeFileSync(path.join(agent, 'notes/keep.txt'), 'keep me');
    const before = snapshot(agent);
    const { stagePreview, rollbackPreview } = await release();
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    assert.ok(fs.existsSync(path.join(staged.destination, 'pi/agents/explorer.md')), 'rollback exercised after explorer staging');
    assert.notDeepEqual(snapshot(agent), before);
    rollbackPreview(staged);
    assert.deepEqual(snapshot(agent), before);
    assert.equal(fs.existsSync(path.join(root, 'backup')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('isolated Pi preview backs up prior agent files and stages only Pi resources', async () => {
  const root = sandbox();
  try {
    const agent = path.join(root, 'agent');
    fs.mkdirSync(agent);
    fs.writeFileSync(path.join(agent, 'AGENTS.md'), 'PREVIOUS_AGENT_INSTRUCTIONS\n');
    const { stagePreview } = await release();
    const result = stagePreview({ sourceRoot, sandboxRoot: root });
    assert.equal(result.destination, agent);
    assert.equal(fs.readFileSync(path.join(root, 'backup/AGENTS.md'), 'utf8'), 'PREVIOUS_AGENT_INSTRUCTIONS\n');
    const guidance = fs.readFileSync(path.join(agent, 'AGENTS.md'), 'utf8');
    assert.match(guidance, /Pi AI OS/);
    assert.equal(guidance, fs.readFileSync(path.join(sourceRoot, 'Pi-global.md'), 'utf8'));
    assert.doesNotMatch(guidance, /This file is \*\*source\*\*, not an installed Pi instruction/);
    const settings = JSON.parse(fs.readFileSync(path.join(agent, 'settings.json'), 'utf8'));
    assert.equal(settings.extensions.includes('pi/extensions/role-guard.ts'), false,
      'the child-only role guard must not be loaded by the parent');
    assert.deepEqual(settings.extensions, [
      'pi/extensions/guard.ts', 'pi/extensions/session-observability.ts', 'pi/extensions/role-agent.ts',
    ]);
    assert.equal(settings.packages?.length ?? 0, 0);
    assert.ok(fs.existsSync(path.join(agent, 'pi/license-gate.json')));
    assert.equal(fs.existsSync(path.join(agent, 'hooks')), false, 'Pi 1.4.0 warns on any hooks/ directory');
    assert.equal(fs.readFileSync(path.join(agent, 'pi/agents/scribe.md'), 'utf8'),
      fs.readFileSync(path.join(sourceRoot, 'pi/agents/scribe.md'), 'utf8'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
