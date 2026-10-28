import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
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

test('isolated preview stages the concierge guard dependency used by the selected guard extension', async () => {
  const root = sandbox();
  try {
    const { stagePreview, rollbackPreview } = await release();
    const handle = stagePreview({ sourceRoot, sandboxRoot: root });
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/concierge-guard.mjs')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/concierge-evidence.mjs')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/agents/concierge.md')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/agents/council-perspectives.md')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/council-evidence.mjs')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/council-perspective.mjs')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/lib/council-session.mjs')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/agents/council-synthesis.md')));
    assert.ok(fs.existsSync(path.join(handle.destination, 'pi/prompts/council.md')));
    rollbackPreview(handle);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fresh disposable Pi consumer sees staged commands and only its selected plugin', async () => {
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
    const env = { ...process.env, PI_CODING_AGENT_DIR: staged.destination,
      PI_ROLE_POLICY_PATH: path.join(sourceRoot, 'tests/fixtures/pi-role-policy.json'),
      PI_OFFLINE: '1', PI_TELEMETRY: '0' };
    const run = (cwd) => {
      const result = spawnSync(process.execPath,
        [launcher, '--mode', 'rpc', '--no-session', '--offline', '--no-mcp', '--approve'],
        { cwd, env, input: '{"type":"get_commands","id":"probe"}\n', encoding: 'utf8', timeout: 20000 });
      assert.equal(result.status, 0, result.stderr);
      const response = result.stdout.split(/\r?\n/).filter(Boolean).map(JSON.parse)
        .find(event => event.id === 'probe' && event.type === 'response');
      assert.ok(response?.success, result.stdout + result.stderr);
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
    assert.deepEqual(settings.extensions, [
      'pi/extensions/guard.ts', 'pi/extensions/session-observability.ts', 'pi/extensions/role-agent.ts',
    ]);
    assert.equal(settings.packages?.length ?? 0, 0);
    assert.ok(fs.existsSync(path.join(agent, 'hooks/license-gate.json')));
    assert.equal(fs.readFileSync(path.join(agent, 'pi/agents/scribe.md'), 'utf8'),
      fs.readFileSync(path.join(sourceRoot, 'pi/agents/scribe.md'), 'utf8'));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
