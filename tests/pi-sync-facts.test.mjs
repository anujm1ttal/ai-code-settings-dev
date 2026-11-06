import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const source = fileURLToPath(new URL('../scripts/sync-facts.mjs', import.meta.url));
function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' } });
  assert.equal(r.status, 0, r.stderr); return r.stdout;
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-facts-'));
  git(root, 'init', '-q');
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'initial');
  git(root, 'add', 'tracked.txt'); git(root, 'commit', '-qm', 'initial');
  fs.mkdirSync(path.join(root, 'Artifacts'), { recursive: true });
  return root;
}
function put(root, rel, data) { const p = path.join(root, 'Artifacts', rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, data); }
function run(root, extra = []) {
  assert.ok(fs.existsSync(source), 'sync-facts script must exist');
  return spawnSync(process.execPath, [source, '--root', root, ...extra], { encoding: 'utf8', env: { ...process.env, SYNC_FACTS_CANARY: 'private-env-8e501b' }, maxBuffer: 1024 * 1024 });
}
function tree(root) {
  const hash = createHash('sha256');
  function visit(dir, rel = '') {
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name), r = path.join(rel, name), s = fs.lstatSync(p);
      hash.update(`${r}:${s.mode}:${s.size}:${s.mtimeMs}\n`);
      if (s.isDirectory()) visit(p, r); else if (s.isFile()) hash.update(fs.readFileSync(p));
    }
  }
  visit(root); return hash.digest('hex');
}
function withFixture(fn) { const root = fixture(); try { fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); } }

test('bounded facts preserve backlog counts and order while reading huge inputs without writes', () => withFixture(root => {
  const entries = Array.from({ length: 7 }, (_, i) => `## \`O${i + 1}\` Title ${i + 1}\n**Status:** ${i % 2 ? 'open' : 'OPEN'}\n`);
  put(root, 'BACKLOG.md', entries.join('') + '## `R1` Done\n**Status:** resolved\n## `X1` Unknown\n**Status:** paused\n' + 'a'.repeat(2 * 1024 * 1024));
  put(root, 'DECISION_LOG.md', '## Newest\n' + 'd'.repeat(1500000) + '\n## Older\nnot newest');
  put(root, '.agent/current_task.md', 'Active task');
  const before = tree(root), result = run(root);
  assert.equal(result.status, 0, result.stderr); assert.equal(tree(root), before);
  assert.ok(Buffer.byteLength(result.stdout) <= 6000);
  assert.match(result.stdout, /OPEN: 7.*RESOLVED: 1.*other: 1/i);
  assert.match(result.stdout, /O1.*Title 1[\s\S]*O2.*Title 2[\s\S]*O3.*Title 3[\s\S]*O4.*Title 4[\s\S]*O5.*Title 5/);
  assert.doesNotMatch(result.stdout, /O6.*Title 6/);
  assert.match(result.stdout, /Newest/); assert.doesNotMatch(result.stdout, /not newest|private-env-8e501b/);
}));

test('git facts list changed and untracked paths, and a 1.5 KB current task is never shortened', () => withFixture(root => {
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'changed');
  fs.writeFileSync(path.join(root, 'pilot-count.txt'), 'new');
  const task = '# Current Task\n' + 'Objective line that must survive intact. '.repeat(35) + '\nEND-OF-TASK-MARKER';
  assert.ok(Buffer.byteLength(task) > 1400 && Buffer.byteLength(task) <= 2000);
  put(root, '.agent/current_task.md', task);
  put(root, 'BACKLOG.md', '## `O1` First\n**Status:** OPEN\n'.repeat(1));
  put(root, 'DECISION_LOG.md', '## Newest\n' + 'd'.repeat(900));
  const r = run(root); assert.equal(r.status, 0, r.stderr);
  assert.ok(Buffer.byteLength(r.stdout) <= 6000);
  assert.match(r.stdout, /M tracked\.txt/); assert.match(r.stdout, /\?\? pilot-count\.txt/);
  assert.match(r.stdout, /END-OF-TASK-MARKER/); assert.doesNotMatch(r.stdout, /current task truncated/);
  assert.match(r.stdout, /MARKERS/); assert.doesNotMatch(r.stdout, /\[truncated\]/);
}));

test('unrecognized sectioned backlog is reported rather than guessed', () => withFixture(root => {
  put(root, 'BACKLOG.md', '# Backlog\n## Bugs\n### Task A\n**Status: OPEN**\n## Other\nStatus: tracker\n');
  const r = run(root); assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /headings not in registry format: 2/i);
  assert.match(r.stdout, /unparsed/i); assert.match(r.stdout, /OPEN/i); assert.match(r.stdout, /tracker/i);
}));

test('absent files, initial commit, nested repository ahead and env safety', () => withFixture(root => {
  const a = path.join(root, 'Artifacts'); git(a, 'init', '-q');
  put(root, 'sentinel', 'a'); git(a, 'add', 'sentinel'); git(a, 'commit', '-qm', 'base');
  git(a, 'branch', 'upstream'); git(a, 'branch', '--set-upstream-to', 'upstream');
  put(root, 'sentinel', 'b'); git(a, 'commit', '-qam', 'ahead');
  const before = tree(root), r = run(root); assert.equal(r.status, 0, r.stderr); assert.equal(tree(root), before);
  assert.match(r.stdout, /ARTIFACTS REPO/); assert.match(r.stdout, /ahead 1/);
  for (const name of ['TODO.md', 'IMPLEMENTATION_PLAN.md', 'current_task.md', 'DECISION_LOG.md', 'BACKLOG.md', 'HOT.md']) assert.match(r.stdout, new RegExp(`${name.replace('.', '\\.')}[^\n]*absent`));
  assert.match(r.stdout, /HEAD~1/); assert.doesNotMatch(r.stdout, /private-env-8e501b/);
}));

test('large backlog is refused and invalid root fails closed', () => withFixture(root => {
  put(root, 'BACKLOG.md', 'z'.repeat(8 * 1024 * 1024 + 1));
  const r = run(root); assert.equal(r.status, 0); assert.match(r.stdout, /too large to scan/i);
  const bad = run(path.join(root, 'missing')); assert.equal(bad.status, 2); assert.equal((bad.stdout + bad.stderr).trim().split(/\r?\n/).length, 1);
}));

test('marker checker runs only for existing named plans', () => withFixture(root => {
  fs.mkdirSync(path.join(root, 'scripts')); fs.copyFileSync(fileURLToPath(new URL('../scripts/check-markers.mjs', import.meta.url)), path.join(root, 'scripts/check-markers.mjs'));
  // Real checker closure is copied to the fixture, not the project under test.
  fs.mkdirSync(path.join(root, 'pi/lib'), { recursive: true });
  for (const name of ['verdict.mjs', 'todo-ownership.mjs']) fs.copyFileSync(fileURLToPath(new URL(`../pi/lib/${name}`, import.meta.url)), path.join(root, 'pi/lib', name));
  put(root, 'Plans/P.md', '# Tasks\n- [ ] [coder] T1: Build — Success: works — Mode: AFK\n');
  put(root, '.agent/current_task.md', 'Plans/P.md Plans/missing.md');
  const r = run(root); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /MARKERS/); assert.match(r.stdout, /Plans\/P\.md.*summary.*exit/i); assert.doesNotMatch(r.stdout, /Plans\/missing\.md.*summary/);
}));
