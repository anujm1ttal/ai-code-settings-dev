import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stagePreview, rollbackPreview } from '../pi/lib/release-preview.mjs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { canonicalTaskHash } from '../pi/lib/verdict.mjs';
import { buildAuditorRecording } from '../pi/lib/todo-ownership.mjs';
import { persistFullResult } from '../pi/lib/result-contract.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('rollback preserves unmanaged changes and does not rewrite matching settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-rehearsal-'));
  try {
    fs.writeFileSync(path.join(root, '.pi-pilot-sandbox'), 'pi-t16-isolated\n');
    const agent = path.join(root, 'agent');
    fs.mkdirSync(agent);
    const settings = Buffer.from('{ "extensions" : ["pi/extensions/guard.ts", "pi/extensions/session-observability.ts", "pi/extensions/role-agent.ts"], "other": 1 }\r\n');
    fs.writeFileSync(path.join(agent, 'settings.json'), settings);
    const sentinel = path.join(agent, 'unmanaged.txt');
    fs.writeFileSync(sentinel, 'before');
    const handle = stagePreview({ sourceRoot, sandboxRoot: root });
    assert.deepEqual(fs.readFileSync(path.join(agent, 'settings.json')), settings, 'matching settings are not rewritten');
    fs.writeFileSync(sentinel, 'changed during rehearsal');
    rollbackPreview(handle);
    assert.deepEqual(fs.readFileSync(path.join(agent, 'settings.json')), settings);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'changed during rehearsal');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('rollback rejects forged and modified handles without touching outside files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-handle-'));
  try {
    fs.writeFileSync(path.join(root, '.pi-pilot-sandbox'), 'pi-t16-isolated\n');
    const outside = path.join(root, 'outside'); fs.writeFileSync(outside, 'keep');
    const handle = stagePreview({ sourceRoot, sandboxRoot: root });
    const forged = { ...handle, records: [{ name: '../outside', existed: false }] };
    assert.throws(() => rollbackPreview(forged), /invalid|handle/i);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
    assert.throws(() => { handle.records.push({ name: '../outside', existed: false }); }, /extensible|read only|object/i);
    rollbackPreview(handle);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('staging refuses a managed destination hard-linked outside the sandbox', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-hardlink-'));
  try {
    fs.writeFileSync(path.join(root, '.pi-pilot-sandbox'), 'pi-t16-isolated\n');
    const outside = path.join(root, 'outside'), agent = path.join(root, 'agent');
    fs.writeFileSync(outside, 'keep'); fs.mkdirSync(agent); fs.linkSync(outside, path.join(agent, 'AGENTS.md'));
    assert.throws(() => stagePreview({ sourceRoot, sandboxRoot: root }), /regular|link/i);
    assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('manifest rejects an unstaged relative import before changing the sandbox', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-manifest-'));
  try {
    const first = path.join(root, 'first'), second = path.join(root, 'second'), source = path.join(root, 'source');
    for (const sandbox of [first, second]) { fs.mkdirSync(sandbox); fs.writeFileSync(path.join(sandbox, '.pi-pilot-sandbox'), 'pi-t16-isolated\n'); }
    const handle = stagePreview({ sourceRoot, sandboxRoot: first });
    for (const { source: rel } of handle.manifest) {
      if (rel.startsWith('synthetic:')) continue;
      const dest = path.join(source, rel); fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, rel), dest);
    }
    rollbackPreview(handle);
    fs.appendFileSync(path.join(source, 'pi/lib/role-policy.mjs'), "\nimport './unstaged.mjs';\n");
    assert.throws(() => stagePreview({ sourceRoot: source, sandboxRoot: second }), /Unstaged relative import/);
    assert.equal(fs.existsSync(path.join(second, 'agent')), false);
    assert.equal(fs.existsSync(path.join(second, 'backup')), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('synthetic ownership is managed and restores prior bytes or absence', () => {
  for (const existing of [false, true]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-ownership-preview-'));
    try {
      fs.writeFileSync(path.join(root, '.pi-pilot-sandbox'), 'pi-t16-isolated\n');
      const agent = path.join(root, 'agent'); fs.mkdirSync(agent);
      const target = path.join(agent, 'role-ownership.json'), prior = Buffer.from('prior non-JSON bytes\r\n');
      if (existing) fs.writeFileSync(target, prior);
      const handle = stagePreview({ sourceRoot, sandboxRoot: root });
      const entry = handle.manifest.find(item => item.destination === 'role-ownership.json');
      const bytes = fs.readFileSync(target), policy = JSON.parse(bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
      assert.deepEqual(policy.roles.strategist.todos, ['Artifacts/Plans/*.md']);
      assert.deepEqual(policy.roles.auditor.todos, ['Artifacts/Plans/*.md']);
      const record = handle.records.find(item => item.name === 'role-ownership.json');
      assert.equal(record.type, existing ? 'file' : 'absent');
      if (existing) assert.equal(record.sha256, createHash('sha256').update(prior).digest('hex'));
      rollbackPreview(handle);
      assert.equal(fs.existsSync(target), existing);
      if (existing) assert.deepEqual(fs.readFileSync(target), prior);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
});

test('rehearsal entry point copies and restores only an allowlisted synthetic base', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-base-'));
  try {
    fs.writeFileSync(path.join(base, 'AGENTS.md'), 'base guidance');
    fs.writeFileSync(path.join(base, 'settings.json'), '{"extensions":["pi/extensions/guard.ts","pi/extensions/session-observability.ts","pi/extensions/role-agent.ts"]}');
    fs.writeFileSync(path.join(base, 'role-policy.json'), '{"synthetic":true}');
    fs.mkdirSync(path.join(base, 'pi/lib'), { recursive: true });
    fs.writeFileSync(path.join(base, 'pi/lib/base.mjs'), 'base');
    const run = spawnSync(process.execPath, [path.join(sourceRoot, 'scripts/rehearse-pi-release.mjs')], { env: { ...process.env, PI_RETAINED_BASE: base }, encoding: 'utf8', timeout: 60000 });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /live before\/after equal: true/);
    assert.match(run.stdout, /restored base inventory equal: true/);
    assert.match(run.stdout, /summary \{"valid":1,"reviewed":1\} exit=0/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('manifest stages the checker closure and retains it after rollback', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-rehearsal-'));
  try {
    fs.writeFileSync(path.join(root, '.pi-pilot-sandbox'), 'pi-t16-isolated\n');
    const handle = stagePreview({ sourceRoot, sandboxRoot: root });
    const expected = ['scripts/check-markers.mjs', 'scripts/sync-facts.mjs', 'pi/lib/verdict.mjs', 'pi/lib/todo-ownership.mjs'];
    for (const source of expected) {
      const destination = `pi-retained/${source}`;
      const entry = handle.manifest.find(item => item.source === source && item.destination === destination);
      assert.ok(entry, `missing retained ${source}`);
      const bytes = fs.readFileSync(path.join(handle.destination, destination));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256);
    }
    rollbackPreview(handle);
    for (const source of expected) assert.ok(fs.existsSync(path.join(handle.destination, 'pi-retained', source)));
    const project = path.join(root, 'project');
    const results = path.join(project, 'Artifacts/.agent/pi-results');
    fs.mkdirSync(results, { recursive: true });
    fs.mkdirSync(path.join(project, 'Artifacts/Plans'), { recursive: true });
    const todos = [];
    for (const [index, verdict] of ['PASS', 'FAIL'].entries()) {
      const rel = `Artifacts/Plans/${verdict}.md`;
      const line = `- [${verdict === 'PASS' ? ' ' : 'x'}] [coder] T${index + 1}: Build — Success: works — Mode: AFK`;
      const dispatch = `job-${index + 1}`;
      const result = persistFullResult({ dir: results, dispatchId: dispatch, role: 'auditor', completeness: 'complete', meta: { role: 'auditor' }, text: `Report.\nVERDICT: ${verdict} task=T${index + 1} todo=${rel} taskSha256=${canonicalTaskHash(line)}\n` });
      fs.writeFileSync(path.join(results, `${dispatch}.settlement.json`), JSON.stringify({ version: 1, dispatchId: dispatch, role: 'auditor', state: 'succeeded', receipt: { sha256: result.sha256, bytes: result.bytes, completeness: 'complete' } }));
      const built = buildAuditorRecording(Buffer.from(`# Plan\n${line}\n`), { taskId: `T${index + 1}`, verdict, date: '2026-11-03', ref: `${verdict}; verdict=${dispatch}; sha256=${result.sha256}` });
      assert.equal(built.ok, true);
      const todo = path.join(project, rel); fs.writeFileSync(todo, built.candidate); todos.push(todo);
    }
    const checker = spawnSync(process.execPath, [path.join(handle.destination, 'pi-retained/scripts/check-markers.mjs'), ...todos, '--root', project, '--strict'], { encoding: 'utf8' });
    assert.equal(checker.status, 0, checker.stderr);
    assert.match(checker.stdout, /summary \{"valid":1,"reviewed":1\} exit=0/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
