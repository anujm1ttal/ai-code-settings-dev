import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const api = await import('../pi/lib/role-ownership.mjs').catch(error => { if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('role-ownership.mjs')) return {}; throw error; });
const { validateOwnershipPolicy, loadOwnership, authorizeMutation, PROTECTED_FLOOR } = api;
const base = () => ({ version: 1, roles: { strategist: { plans: ['planning/**'], todos: ['TODO.txt'] }, coder: { residual: true, generated: ['build/**'] }, auditor: { todos: ['TODO.txt'] }, scribe: { docs: ['docs/**'] } }, protected: [], approvalLinePrefixes: ['APPROVED:'] });
const temp = t => { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ownership-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return fs.realpathSync.native(root); };
const setup = t => { const root = temp(t); const globalPath = path.join(root, 'global.json'); fs.writeFileSync(globalPath, JSON.stringify(base())); return { root, globalPath, ownership: loadOwnership({ projectRoot: root, globalPath }) }; };
const auth = (s, role, requestedPath, operation = 'write') => authorizeMutation({ ownership: s.ownership, role, projectRoot: s.root, requestedPath, operation, globalPath: s.globalPath });

test('schema accepts a valid policy and freezes a detached result', () => {
  assert.equal(typeof validateOwnershipPolicy, 'function', 'ownership validator must exist');
  const input = base(), policy = validateOwnershipPolicy(input);
  assert.ok(Object.isFrozen(policy) && Object.isFrozen(policy.roles.strategist.plans));
  input.roles.strategist.plans.push('other'); assert.deepEqual(policy.roles.strategist.plans, ['planning/**']);
});

test('schema rejects malformed shapes, every nested list, paths and duplicates', () => {
  const mutations = [p => p.version = 2, p => p.extra = 1, p => delete p.roles.scribe, p => p.roles.explorer = {}, p => p.roles.coder.extra = 1, p => p.roles.coder.residual = false,
    ...[['strategist','plans'], ['strategist','todos'], ['coder','generated'], ['auditor','todos'], ['scribe','docs']].flatMap(([r,k]) => [p => p.roles[r][k] = 'x', p => p.roles[r][k] = [42], p => p.roles[r][k] = ['x', 'x']]),
    p => p.protected = [null], p => p.roles.scribe.docs = Array(1), p => p.approvalLinePrefixes = [1], p => p.approvalLinePrefixes = ['', ''], p => p.roles.auditor.todos = ['other'],
    ...['/abs', 'C:/abs', 'a\\b', 'a/../b', 'a/./b', 'a//b', '!x', 'a/[x]', 'a/{b}', 'a/(b)', 'a/**x', 'a:stream'].map(v => p => p.roles.scribe.docs = [v]),
    p => p.roles.scribe.docs = ['planning/**'], p => p.roles.coder.generated = ['docs/**'], p => p.roles.coder.generated = ['docs/output.txt'], p => p.roles.coder.generated = ['docs/*.md']];
  for (const mutate of mutations) { const p = base(); mutate(p); assert.throws(() => validateOwnershipPolicy(p)); }
});

test('override selection is fail-closed and absent policy denies coder', t => {
  const s = setup(t); assert.equal(s.ownership.source, 'global');
  fs.writeFileSync(path.join(s.root, 'role-ownership.json'), '{');
  assert.equal(loadOwnership({ projectRoot: s.root, globalPath: s.globalPath }).source, 'none');
  fs.rmSync(path.join(s.root, 'role-ownership.json')); fs.rmSync(s.globalPath);
  s.ownership = loadOwnership({ projectRoot: s.root, globalPath: s.globalPath });
  assert.equal(s.ownership.source, 'none'); assert.equal(auth(s, 'coder', 'x').allow, false);
});

test('alternate project mapping and per-role access', t => {
  const s = setup(t); fs.writeFileSync(path.join(s.root, 'role-ownership.json'), JSON.stringify(base()));
  s.ownership = loadOwnership({ projectRoot: s.root, globalPath: s.globalPath }); assert.equal(s.ownership.source, 'project');
  for (const [file, allowed] of [['planning/p.md', ['strategist']], ['TODO.txt', ['strategist','auditor']], ['docs/r.md', ['scribe']], ['src/a.js', ['coder']], ['build/a.js', ['coder']]]) {
    for (const role of ['strategist','auditor','scribe','coder','explorer','unknown']) assert.equal(auth(s, role, file, role === 'auditor' ? 'edit' : 'write').allow, allowed.includes(role), `${role} ${file}`);
  }
  assert.equal(auth(s, 'auditor', 'TODO.txt', 'write').allow, false);
  assert.ok(Object.isFrozen(auth(s, 'coder', 'src/a')));
});

test('floor is immutable and evidence is exclusively coder create-only', t => {
  const s = setup(t); assert.ok(Object.isFrozen(PROTECTED_FLOOR));
  const floor = ['Artifacts/.agent/x', 'Artifacts/BACKLOG.md', 'Artifacts/learnings/x', 'Artifacts/GLOBAL_INBOX.md', 'role-ownership.json', 'global.json', 'bulk-read-approval.json', 'Artifacts/.agent/bulk-read-ledger.jsonl', 'Artifacts/.agent/bulk-read-ledger.lock'];
  for (const role of ['strategist','auditor','scribe','coder']) {
    const p = base(); p.roles.strategist.plans = []; p.roles.strategist.todos = []; p.roles.auditor.todos = []; p.roles.scribe.docs = []; p.roles.coder.generated = [];
    if (role === 'strategist') p.roles.strategist.plans = ['**'];
    if (role === 'auditor') { p.roles.strategist.todos = ['**']; p.roles.auditor.todos = ['**']; }
    if (role === 'scribe') p.roles.scribe.docs = ['**'];
    p.protected = ['private/**']; fs.writeFileSync(path.join(s.root, 'role-ownership.json'), JSON.stringify(p));
    s.ownership = loadOwnership({ projectRoot: s.root, globalPath: s.globalPath }); assert.equal(s.ownership.source, 'project');
    assert.equal(auth(s, role, 'ordinary', role === 'auditor' ? 'edit' : 'write').allow, true, 'presence control');
    for (const file of [...floor, 'private/x']) assert.equal(auth(s, role, file, role === 'auditor' ? 'edit' : 'write').allow, false, `${role} ${file}`);
    if (role !== 'coder') assert.equal(auth(s, role, 'Artifacts/Evidence/new.txt', role === 'auditor' ? 'edit' : 'write').allow, false);
  }
  const evidence = 'Artifacts/Evidence/new.txt';
  for (const role of ['strategist','auditor','scribe']) assert.equal(auth(s, role, evidence).allow, false);
  assert.equal(auth(s, 'coder', evidence, 'edit').allow, false); assert.equal(auth(s, 'coder', evidence).allow, true);
  fs.mkdirSync(path.join(s.root, 'Artifacts/Evidence'), { recursive: true }); fs.writeFileSync(path.join(s.root, evidence), 'x');
  assert.equal(auth(s, 'coder', evidence).allow, false); assert.equal(auth(s, 'coder', evidence, 'edit').allow, false);
});

test('target-time overlapping patterns deny ambiguity', t => {
  const s = setup(t); const p = base(); p.roles.strategist.plans = ['common/*.md']; p.roles.scribe.docs = ['common/a.*'];
  fs.writeFileSync(s.globalPath, JSON.stringify(p)); s.ownership = loadOwnership({ projectRoot: s.root, globalPath: s.globalPath });
  assert.equal(s.ownership.source, 'global');
  for (const role of ['strategist','scribe','coder']) assert.equal(auth(s, role, 'common/a.md').allow, false);
  p.roles.strategist.plans = []; p.roles.scribe.docs = ['common/*.md']; p.roles.coder.generated = ['common/a.*'];
  fs.writeFileSync(s.globalPath, JSON.stringify(p)); s.ownership = loadOwnership({ projectRoot: s.root, globalPath: s.globalPath });
  assert.equal(s.ownership.source, 'global');
  for (const role of ['scribe','coder']) assert.equal(auth(s, role, 'common/a.md').allow, false);
});

test('glob stars match all filename characters without accepting unmatched suffixes', t => {
  if (process.platform === 'win32') return t.skip('Windows forbids newline filenames');
  const s = setup(t); const p = base(); p.roles.scribe.docs = ['docs/*.md']; p.protected = ['secret/*'];
  fs.writeFileSync(s.globalPath, JSON.stringify(p)); s.ownership = loadOwnership({ projectRoot: s.root, globalPath: s.globalPath });
  assert.equal(auth(s, 'scribe', 'docs/a\nb.md').allow, true);
  assert.equal(auth(s, 'scribe', 'docs/a.md\n').allow, false);
  assert.equal(auth(s, 'coder', 'secret/a\nb').allow, false);
});

test('unsafe lexical paths and sibling prefix are refused', t => {
  const s = setup(t);
  for (const file of ['../escape', path.join(path.dirname(s.root), `${path.basename(s.root)}2`, 'x'), '\\\\server\\share\\x', '//server/share/x', '\\\\?\\C:\\x', '\\\\.\\C:\\x', 'x:stream', 'C:relative', 'CON.txt', 'dir/prn', 'COM1.log', 'lpt9', 'dir/name.', 'dir/name ', 'dir/PROGRA~1/x', 'x\0z']) assert.equal(auth(s, 'coder', file).allow, false, JSON.stringify(file));
  assert.equal(auth(s, 'coder', 'safe/x').allow, true);
  const real = fs.realpathSync.native, lstat = fs.lstatSync;
  try {
    fs.realpathSync.native = () => { throw new Error('unexpected filesystem access'); };
    fs.lstatSync = () => { throw new Error('unexpected filesystem access'); };
    const denied = auth(s, 'coder', '//server/share/x');
    assert.equal(denied.allow, false); assert.match(denied.reason, /unsafe lexical/);
  } finally { fs.realpathSync.native = real; fs.lstatSync = lstat; }
});

test('O05: case-folded strategist patterns cannot overlap across lists', () => {
  const p = base();
  assert.doesNotThrow(() => validateOwnershipPolicy(p));
  p.roles.strategist.plans = ['todo.TXT'];
  assert.throws(() => validateOwnershipPolicy(p), /duplicate strategist pattern/);
});

test('O13: load rejects resolvable unsafe paths at its own boundary', t => {
  const s = setup(t);
  assert.equal(s.ownership.source, 'global');
  // Construct without path.join normalizing away the unsafe segment.
  const unsafeGlobal = `${s.root}${path.sep}..${path.sep}${path.basename(s.root)}${path.sep}global.json`;
  const unsafeProject = `${s.root}${path.sep}..${path.sep}${path.basename(s.root)}`;
  const read = fs.readFileSync, lstat = fs.lstatSync;
  let accesses = 0;
  try {
    fs.readFileSync = (...args) => { accesses++; return read(...args); };
    fs.lstatSync = (...args) => { accesses++; return lstat(...args); };
    for (const input of [{ projectRoot: unsafeProject, globalPath: s.globalPath }, { projectRoot: s.root, globalPath: unsafeGlobal }]) {
      const result = loadOwnership(input);
      assert.equal(result.source, 'none');
      assert.equal(result.policy, null);
      assert.equal(result.reason, 'invalid paths');
      assert.equal(accesses, 0);
    }
  } finally { fs.readFileSync = read; fs.lstatSync = lstat; }
});

test('O21 O22 O33: direct authorization rejects unsafe global, forged source and operation', t => {
  const s = setup(t);
  assert.equal(auth(s, 'coder', 'src/file', 'edit').allow, true);
  const input = { ownership: s.ownership, role: 'coder', projectRoot: s.root, requestedPath: 'src/file', operation: 'edit', globalPath: s.globalPath };
  const unsafeGlobal = `${s.root}${path.sep}..${path.sep}${path.basename(s.root)}${path.sep}global.json`;
  const realpath = fs.realpathSync.native, lstat = fs.lstatSync;
  let accesses = 0, invalidPath;
  try {
    fs.realpathSync.native = (...args) => { accesses++; return realpath(...args); };
    fs.lstatSync = (...args) => { accesses++; return lstat(...args); };
    invalidPath = authorizeMutation({ ...input, globalPath: unsafeGlobal });
  } finally { fs.realpathSync.native = realpath; fs.lstatSync = lstat; }
  assert.equal(invalidPath.allow, false);
  assert.equal(invalidPath.reason, 'invalid global path');
  assert.equal(invalidPath.relPath, null);
  assert.equal(accesses, 0);
  const forged = authorizeMutation({ ...input, ownership: { source: 'none', policy: s.ownership.policy } });
  assert.equal(forged.allow, false);
  assert.equal(forged.reason, 'no ownership');
  const unknown = authorizeMutation({ ...input, operation: 'delete' });
  assert.equal(unknown.allow, false);
  assert.equal(unknown.reason, 'invalid role or operation');
});

test('filesystem aliases and nonregular files are refused', async t => {
  const s = setup(t); const file = path.join(s.root, 'Readme.md'); fs.writeFileSync(file, 'a');
  await t.test('case alias', t => { if (!fs.existsSync(path.join(s.root, 'README.md'))) return t.skip('filesystem is case-sensitive'); assert.equal(auth(s, 'coder', 'README.md').allow, false); });
  await t.test('junction escape', t => { const outside = temp(t); try { fs.symlinkSync(outside, path.join(s.root, 'link'), 'junction'); } catch (e) { return t.skip(`junction unavailable: ${e.code}`); } assert.equal(auth(s, 'coder', 'link/new').allow, false); });
  await t.test('hard link', t => { try { fs.linkSync(file, path.join(s.root, 'hard')); } catch (e) { return t.skip(`hard links unavailable: ${e.code}`); } assert.equal(auth(s, 'coder', 'hard').allow, false); });
  fs.mkdirSync(path.join(s.root, 'directory')); assert.equal(auth(s, 'coder', 'directory').allow, false);
});
