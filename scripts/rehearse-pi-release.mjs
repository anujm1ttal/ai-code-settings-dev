// Read-only retained-base rehearsal. No installed Pi paths are used as destinations.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stagePreview, rollbackPreview } from '../pi/lib/release-preview.mjs';
import { canonicalTaskHash } from '../pi/lib/verdict.mjs';
import { buildAuditorRecording } from '../pi/lib/todo-ownership.mjs';
import { persistFullResult } from '../pi/lib/result-contract.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const banned = name => /^(?:auth\.json|models[^/]*\.json|models-store\.json|sessions|win-git-bash|backup-.*|install|bin)$/i.test(name);

function inventory(base) {
  const rows = [];
  function visit(relative) {
    const name = path.join(base, ...relative.split('/'));
    const stat = fs.lstatSync(name);
    if (stat.isSymbolicLink()) throw new Error(`Refusing linked base entry: ${relative}`);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(name).sort()) {
        if (banned(child)) throw new Error(`Forbidden name in retained base: ${relative}/${child}`);
        visit(`${relative}/${child}`);
      }
    } else if (stat.isFile()) rows.push({ path: relative, sha256: sha(fs.readFileSync(name)) });
    else throw new Error(`Non-file in retained base: ${relative}`);
  }
  for (const rel of ['AGENTS.md', 'settings.json', 'role-policy.json', 'pi']) visit(rel);
  return rows;
}

function run() {
  const base = process.env.PI_RETAINED_BASE;
  if (!base || !path.isAbsolute(base)) throw new Error('PI_RETAINED_BASE must name an absolute read-only agent directory');
  const baseStat = fs.lstatSync(base);
  if (!baseStat.isDirectory() || baseStat.isSymbolicLink()) throw new Error('Invalid base directory');
  const before = inventory(base);
  console.log('base before inventory:', JSON.stringify(before));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-release-rehearsal-'));
  try {
    fs.writeFileSync(path.join(root, '.pi-pilot-sandbox'), 'pi-t16-isolated\n');
    const agent = path.join(root, 'agent'); fs.mkdirSync(agent);
    for (const entry of before) {
      const dest = path.join(agent, ...entry.path.split('/'));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const bytes = fs.readFileSync(path.join(base, ...entry.path.split('/')));
      assert.equal(sha(bytes), entry.sha256, `base changed during copy: ${entry.path}`);
      fs.writeFileSync(dest, bytes);
    }
    assert.deepEqual(inventory(agent), before);
    const sentinel = path.join(agent, 'unmanaged-rehearsal-sentinel');
    fs.writeFileSync(sentinel, 'before');
    const staged = stagePreview({ sourceRoot, sandboxRoot: root });
    console.log('manifest:', JSON.stringify(staged.manifest));
    console.log('backup inventory:', JSON.stringify(staged.records));
    assert.equal(fs.existsSync(path.join(agent, 'role-ownership.json')), true);
    fs.writeFileSync(sentinel, 'changed during rehearsal');
    rollbackPreview(staged);
    assert.equal(fs.readFileSync(sentinel, 'utf8'), 'changed during rehearsal');
    assert.equal(fs.existsSync(path.join(agent, 'role-ownership.json')), false);
    const restored = inventory(agent);
    assert.deepEqual(restored, before);
    // Inventory the entire sandbox agent to prove that only the retained checker and sentinel were added.
    function files(dir, prefix = '') {
      return fs.readdirSync(dir).sort().flatMap(name => {
        const rel = prefix ? `${prefix}/${name}` : name;
        const item = path.join(dir, name), st = fs.lstatSync(item);
        if (st.isSymbolicLink()) throw new Error(`Unexpected symlink: ${rel}`);
        return st.isDirectory() ? files(item, rel) : [rel];
      });
    }
    const expected = [...before.map(row => row.path), 'unmanaged-rehearsal-sentinel', ...staged.manifest.filter(row => row.destination.startsWith('pi-retained/')).map(row => row.destination)].sort();
    assert.deepEqual(files(agent).sort(), expected);
    console.log('restored base inventory equal: true');
    console.log('no new runtime files: true; unmanaged sentinel preserved: true; ownership prior absence restored: true');
    const project = path.join(root, 'project'), results = path.join(project, 'Artifacts/.agent/pi-results');
    fs.mkdirSync(results, { recursive: true }); fs.mkdirSync(path.join(project, 'Artifacts/Plans'), { recursive: true });
    const todos = [];
    for (const [index, verdict] of ['PASS', 'FAIL'].entries()) {
      const rel = `Artifacts/Plans/${verdict}.md`, id = `T${index + 1}`, dispatch = `job-${index + 1}`;
      const line = `- [${verdict === 'PASS' ? ' ' : 'x'}] [coder] ${id}: Build — Success: works — Mode: AFK`;
      const result = persistFullResult({ dir: results, dispatchId: dispatch, role: 'auditor', completeness: 'complete', meta: { role: 'auditor' }, text: `Report.\nVERDICT: ${verdict} task=${id} todo=${rel} taskSha256=${canonicalTaskHash(line)}\n` });
      fs.writeFileSync(path.join(results, `${dispatch}.settlement.json`), JSON.stringify({ version: 1, dispatchId: dispatch, role: 'auditor', state: 'succeeded', receipt: { sha256: result.sha256, bytes: result.bytes, completeness: 'complete' } }));
      const built = buildAuditorRecording(Buffer.from(`# Plan\n${line}\n`), { taskId: id, verdict, date: '2026-11-03', ref: `${verdict}; verdict=${dispatch}; sha256=${result.sha256}` });
      assert.equal(built.ok, true);
      const target = path.join(project, ...rel.split('/')); fs.writeFileSync(target, built.candidate); todos.push(target);
    }
    const checked = spawnSync(process.execPath, [path.join(agent, 'pi-retained/scripts/check-markers.mjs'), ...todos, '--root', project, '--strict'], { cwd: root, encoding: 'utf8' });
    process.stdout.write(checked.stdout); process.stderr.write(checked.stderr);
    assert.equal(checked.status, 0); assert.match(checked.stdout, /summary \{"valid":1,"reviewed":1\} exit=0/);
    const after = inventory(base);
    console.log('base after inventory:', JSON.stringify(after));
    assert.deepEqual(after, before);
    console.log('live before/after equal: true');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

try { run(); console.log('rehearsal exit=0'); }
catch (error) { console.error(`rehearsal failed: ${error.message}`); process.exitCode = 1; }
