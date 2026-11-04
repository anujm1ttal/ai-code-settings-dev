import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadOwnership, authorizeMutation } from '../pi/lib/role-ownership.mjs';

const entry = process.env.PI_CODING_AGENT_SDK_PATH;
const skip = !entry || !path.isAbsolute(entry) || !fs.existsSync(entry) ? 'Set PI_CODING_AGENT_SDK_PATH to the installed SDK dist/index.js' : false;
const sdk = skip ? null : await import(pathToFileURL(entry).href);
const previousFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async () => { fetchCalls++; throw new Error('network forbidden'); };
after(() => { globalThis.fetch = previousFetch; assert.equal(fetchCalls, 0); });
let core;
try { core = await import('../pi/lib/role-guard-core.mjs'); } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
const task = '- [ ] [coder] T1: Build — Success: works — Mode: AFK';
const verified = '- [x] [coder] T2: Check — Success: works — Mode: AFK — Auditor-verified 2026-01-01 (ref)';
const initial = `# Plan\n\nApproval: yes\n\n${task}\n${verified}\n`;
const policy = () => ({ version: 1, roles: { strategist: { plans: ['plans/**'], todos: ['todo.md'] }, coder: { residual: true, generated: [] }, auditor: { todos: ['todo.md'] }, scribe: { docs: ['docs/**'] } }, protected: [], approvalLinePrefixes: ['Approval:'] });
function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-role-guard-'));
  const project = path.join(base, 'project'), agent = path.join(base, 'agent');
  fs.mkdirSync(project); fs.mkdirSync(agent);
  const globalPath = path.join(agent, 'role-ownership.json');
  fs.writeFileSync(globalPath, JSON.stringify(policy()));
  return { base, project, globalPath, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}
function put(f, rel, value) { const p = path.join(f.project, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, value); return p; }
function snapshot(p) { return fs.existsSync(p) ? fs.readFileSync(p) : null; }
async function denied(p, fn) { const before = snapshot(p); await assert.rejects(fn); assert.deepEqual(snapshot(p), before, 'refusal preserves bytes and existence'); }
function tools(f, role, extra = {}) {
  assert.equal(typeof core?.createGuardedOperations, 'function', 'guarded operations must exist');
  const ops = core.createGuardedOperations({ role, projectRoot: f.project, globalPath: f.globalPath, ...extra });
  return { edit: sdk.createEditToolDefinition(f.project, { operations: ops.edit }), write: sdk.createWriteToolDefinition(f.project, { operations: ops.write }) };
}
const run = (tool, f, input) => tool.execute('test', input, undefined, undefined, { cwd: f.project });
const edit = (p, oldText, newText) => ({ path: p, edits: [{ oldText, newText }] });

test('guarded operations expose the mutation-boundary API', () => assert.equal(typeof core?.createGuardedOperations, 'function', 'guarded operations must exist'));

test('G05 auditor cannot use guard authorization even on auditor-owned TODO', () => {
  const f = fixture(); try {
    const p = put(f, 'todo.md', initial);
    const make = role => core.createGuardedOperations({ role, projectRoot: f.project, globalPath: f.globalPath });
    assert.equal(make('strategist').authorize(p, 'edit').decision.allow, true);
    const ownership = loadOwnership({ projectRoot: f.project, globalPath: f.globalPath });
    assert.equal(authorizeMutation({ ownership, role: 'auditor', projectRoot: f.project, requestedPath: p,
      operation: 'edit', globalPath: f.globalPath }).allow, true, 'ownership permits auditor edit independently');
    assert.throws(() => make('auditor').authorize(p, 'edit'), /role has no mutation authority/);
    assert.deepEqual(snapshot(p), Buffer.from(initial));
  } finally { f.cleanup(); }
});

for (const method of ['access', 'readFile']) test(`G13/G14 edit ${method} refuses foreign content before IO`, async () => {
  const f = fixture(); try {
    const owned = put(f, 'src/own.txt', 'control'), foreign = put(f, 'todo.md', initial);
    const calls = [];
    const io = { ...fsp, [method]: async (...args) => { calls.push(args[0]); return fsp[method](...args); } };
    const ops = core.createGuardedOperations({ role: 'coder', projectRoot: f.project, globalPath: f.globalPath, fs: io });
    const value = await ops.edit[method](owned);
    if (method === 'readFile') assert.equal(value.toString(), 'control');
    assert.deepEqual(calls, [owned]);
    await assert.rejects(() => ops.edit[method](foreign), /Mutation refused/);
    assert.deepEqual(calls, [owned]); assert.deepEqual(snapshot(foreign), Buffer.from(initial));
  } finally { f.cleanup(); }
});

test('G09 refuses owner-class drift even when both authorizations allow', async () => {
  const f = fixture(); try {
    const p = put(f, 'src/a.txt', 'before'); let writes = 0;
    const make = io => core.createGuardedOperations({ role: 'coder', projectRoot: f.project, globalPath: f.globalPath, fs: io });
    const initialAuth = make(fsp).authorize(p, 'write'); assert.equal(initialAuth.decision.ownerClass, 'residual');
    const io = { ...fsp, mkdir: async (...args) => { await fsp.mkdir(...args); const next = policy(); next.roles.coder.generated = ['src/**']; await fsp.writeFile(f.globalPath, JSON.stringify(next)); },
      writeFile: async (...args) => { writes++; return fsp.writeFile(...args); } };
    await assert.rejects(() => make(io).write.writeFile(p, 'after'), /ownership changed/);
    assert.equal(make(fsp).authorize(p, 'write').decision.ownerClass, 'generated');
    assert.equal(writes, 0); assert.equal(snapshot(p).toString(), 'before');
    await make(fsp).write.writeFile(p, 'control'); assert.equal(snapshot(p).toString(), 'control');
  } finally { f.cleanup(); }
});

for (const kind of ['write', 'edit']) for (const [name, added] of [
  ['checked with forged suffix', '- [x] [coder] T1: Build — Success: done — Mode: AFK — Auditor-verified 2026-11-03 (forged)'],
  ['unchecked with forged suffix', '- [ ] [coder] T1: Build — Success: done — Mode: AFK — Auditor-reviewed 2026-11-03 (forged)'],
  ['malformed task', '- [ ] malformed'],
]) test(`strategist ${kind} refuses ${name} added to prose plan`, { skip }, async () => {
  const f = fixture(); try {
    const original = '# Plan\n\nprose\n'; const p = put(f, 'plans/a.md', original);
    const tool = tools(f, 'strategist')[kind];
    const input = next => kind === 'edit' ? edit(p, original, next) : { path: p, content: next };
    assert.deepEqual(snapshot(p), Buffer.from(original));
    const control = original + '\n' + task + '\n';
    await run(tool, f, input(control)); assert.deepEqual(snapshot(p), Buffer.from(control));
    fs.writeFileSync(p, original); assert.deepEqual(snapshot(p), Buffer.from(original));
    await denied(p, () => run(tool, f, input(original + '\n' + added + '\n')));
  } finally { f.cleanup(); }
});

test('strategist write refuses forged new plan', { skip }, async () => {
  const f = fixture(); try {
    const tool = tools(f, 'strategist').write;
    const control = path.join(f.project, 'plans/control.md'), target = path.join(f.project, 'plans/new.md');
    assert.equal(snapshot(control), null); assert.equal(snapshot(target), null);
    await run(tool, f, { path: control, content: task }); assert.deepEqual(snapshot(control), Buffer.from(task));
    await denied(target, () => run(tool, f, { path: target, content: '- [x] [coder] T1: Build — Success: done — Mode: AFK — Auditor-verified 2026-11-03 (forged)' }));
  } finally { f.cleanup(); }
});

for (const rel of ['plans/new.md', 'todo.md']) for (const bom of ['', '\ufeff']) test(`strategist creates ${rel} with newline ${bom ? 'and BOM' : 'without BOM'}`, { skip }, async () => {
  const f = fixture(); try {
    const target = path.join(f.project, rel), content = `${bom}Approval: new\n\n${task}\n`;
    assert.equal(snapshot(target), null);
    await run(tools(f, 'strategist').write, f, { path: target, content });
    assert.deepEqual(snapshot(target), Buffer.from(content));
    await denied(target, () => run(tools(f, 'strategist').write, f, { path: target, content: content.replace('[ ]', '[x]') }));
  } finally { f.cleanup(); }
});

for (const kind of ['edit', 'write']) test(`scribe ${kind} edits document checklists while preserving approval`, { skip }, async () => {
  const f = fixture(); try {
    const original = '# Docs\n\nApproval: yes\nkept\n\n```md\n- [ ] example\n```\n\n- [ ] deploy step\n  - [ ] nested\n\nhello\n';
    const p = put(f, 'docs/a.md', original), tool = tools(f, 'scribe')[kind];
    const input = next => kind === 'edit' ? edit(p, original, next) : { path: p, content: next };
    assert.deepEqual(snapshot(p), Buffer.from(original));
    const control = original.replace('hello', 'world');
    await run(tool, f, input(control)); assert.deepEqual(snapshot(p), Buffer.from(control));
    fs.writeFileSync(p, original); assert.deepEqual(snapshot(p), Buffer.from(original));
    for (const bad of [original.replace('Approval: yes\nkept\n\n', ''), original.replace('kept', 'changed'), original.replace('hello', 'words Approval: ambiguous')]) {
      await denied(p, () => run(tool, f, input(bad)));
    }
  } finally { f.cleanup(); }
});

test('strategist edits non-task plan prose while preserving approvals', { skip }, async () => {
  const f = fixture(); try {
    const original = '# Plan\n\nApproval: yes\n\nprose\n'; const p = put(f, 'plans/a.md', original);
    assert.deepEqual(snapshot(p), Buffer.from(original));
    const next = original.replace('prose', 'revised prose');
    await run(tools(f, 'strategist').write, f, { path: p, content: next }); assert.deepEqual(snapshot(p), Buffer.from(next));
    await denied(p, () => run(tools(f, 'strategist').write, f, { path: p, content: next.replace('Approval: yes', 'Approval: no') }));
  } finally { f.cleanup(); }
});
test('parent guard is byte-identical to HEAD', () => {
  const show = spawnSync('git', ['show', 'HEAD:pi/extensions/guard.ts']);
  assert.equal(show.status, 0); assert.deepEqual(fs.readFileSync('pi/extensions/guard.ts'), show.stdout);
});
for (const role of ['strategist', 'coder', 'scribe']) for (const kind of ['edit', 'write']) test(`${role} ${kind}: owned control, cross-owner and floor`, { skip }, async () => {
  const f = fixture(); try {
    const rel = { strategist: 'todo.md', coder: 'src/a.txt', scribe: 'docs/a.md' }[role];
    const original = role === 'strategist' ? initial : 'Approval: yes\n\nhello\n';
    const target = put(f, rel, original), foreign = put(f, role === 'coder' ? 'todo.md' : 'src/foreign.txt', initial);
    const floor = put(f, 'Artifacts/BACKLOG.md', 'protected\n');
    const tool = tools(f, role)[kind];
    const input = (p, old, next) => kind === 'edit' ? edit(p, old, next) : { path: p, content: next };
    const next = original.replace('hello', 'world').replace('Build', 'Build better');
    await run(tool, f, input(target, original, next)); assert.deepEqual(snapshot(target), Buffer.from(next));
    await denied(foreign, () => run(tool, f, input(foreign, initial, 'bad')));
    await denied(floor, () => run(tool, f, input(floor, 'protected\n', 'bad')));
  } finally { f.cleanup(); }
});
for (const kind of ['edit', 'write']) for (const [name, changed] of [
  ['delete task', initial.replace(`${task}\n`, '')], ['flip marker', initial.replace('[ ]', '[x]')],
  ['change verified', initial.replace('T2: Check', 'T2: Alter')], ['remove approval', initial.replace('Approval: yes\n', '')],
]) test(`strategist ${kind} refuses ${name}`, { skip }, async () => {
  const f = fixture(); try { const p = put(f, 'todo.md', initial); const tool = tools(f, 'strategist')[kind];
    await denied(p, () => run(tool, f, kind === 'edit' ? edit(p, initial, changed) : { path: p, content: changed }));
  } finally { f.cleanup(); }
});
for (const kind of ['edit', 'write']) for (const changed of ['# Doc\n\nhello\n', '# Doc\n\nApproval: no\n\nhello\n']) test(`scribe ${kind} preserves approval`, { skip }, async () => {
  const f = fixture(); try { const original = '# Doc\n\nApproval: yes\n\nhello\n'; const p = put(f, 'docs/a.md', original); const tool = tools(f, 'scribe')[kind];
    await denied(p, () => run(tool, f, kind === 'edit' ? edit(p, original, changed) : { path: p, content: changed }));
  } finally { f.cleanup(); }
});
for (const role of [undefined, 'unknown', 'explorer', 'auditor']) for (const kind of ['edit', 'write']) test(`${role ?? 'missing'} ${kind} is refused`, { skip }, async () => {
  const f = fixture(); try { const p = put(f, 'src/a.txt', 'hello'); const tool = tools(f, role)[kind];
    await denied(p, () => run(tool, f, kind === 'edit' ? edit(p, 'hello', 'world') : { path: p, content: 'world' }));
  } finally { f.cleanup(); }
});
for (const value of ['missing', 'invalid']) test(`coder fails closed with ${value} policy`, { skip }, async () => {
  const f = fixture(); try { const p = put(f, 'src/a.txt', 'hello'); if (value === 'missing') fs.unlinkSync(f.globalPath); else fs.writeFileSync(f.globalPath, '{');
    for (const kind of ['edit', 'write']) await denied(p, () => run(tools(f, 'coder')[kind], f, kind === 'edit' ? edit(p, 'hello', 'world') : { path: p, content: 'world' }));
  } finally { f.cleanup(); }
});
test('coder evidence is exclusive create and never editable', { skip }, async () => {
  const f = fixture(); try { const p = path.join(f.project, 'Artifacts/Evidence/x/a.txt'); const t = tools(f, 'coder');
    assert.equal(snapshot(p), null); await run(t.write, f, { path: p, content: 'first' }); assert.deepEqual(snapshot(p), Buffer.from('first'));
    await denied(p, () => run(t.write, f, { path: p, content: 'second' })); await denied(p, () => run(t.edit, f, edit(p, 'first', 'second')));
  } finally { f.cleanup(); }
});
for (const role of ['strategist', 'coder', 'scribe']) for (const kind of ['edit', 'write']) test(`${role} ${kind} refuses drift after read`, { skip }, async () => {
  const f = fixture(); try {
    const rel = { strategist: 'todo.md', coder: 'src/a.txt', scribe: 'docs/a.md' }[role];
    const original = role === 'strategist' ? initial : 'hello\n';
    const next = original.replace(role === 'strategist' ? 'Build' : 'hello', 'changed');
    const p = put(f, rel, original); let reads = 0, writes = 0;
    const injected = { ...fsp, readFile: async (...args) => { const result = await fsp.readFile(...args); if (++reads === 1) await fsp.writeFile(p, 'external'); return result; }, writeFile: async (...args) => { writes++; return fsp.writeFile(...args); } };
    const tool = tools(f, role, { fs: injected })[kind];
    await assert.rejects(run(tool, f, kind === 'edit' ? edit(p, original, next) : { path: p, content: next }), /drift/i);
    assert.equal(writes, 0); assert.deepEqual(snapshot(p), Buffer.from('external'));
  } finally { f.cleanup(); }
});
for (const kind of ['edit', 'write']) test(`strategist ${kind} protects tasks in plans and ambiguous originals`, { skip }, async () => {
  const f = fixture(); try { const p = put(f, 'plans/a.md', initial); const tool = tools(f, 'strategist')[kind];
    const next = initial.replace(task + '\n', '');
    await denied(p, () => run(tool, f, kind === 'edit' ? edit(p, initial, next) : { path: p, content: next }));
    const ambiguous = '# Plan\n\n - [ ] malformed\n'; fs.writeFileSync(p, ambiguous);
    await denied(p, () => run(tool, f, kind === 'edit' ? edit(p, 'malformed', 'changed') : { path: p, content: '# Plan\n' }));
  } finally { f.cleanup(); }
});
test('actual bytes at execution control validation after earlier snapshot', { skip }, async () => {
  const f = fixture(); try { const p = put(f, 'todo.md', initial); const earlier = snapshot(p); assert.deepEqual(earlier, Buffer.from(initial));
    const external = initial.replace('Approval: yes', 'Approval: external'); fs.writeFileSync(p, external);
    for (const kind of ['edit', 'write']) { const tool = tools(f, 'strategist')[kind];
      await denied(p, () => run(tool, f, kind === 'edit' ? edit(p, 'Approval: external', 'Approval: yes') : { path: p, content: initial })); }
  } finally { f.cleanup(); }
});
test('registered extension uses child role and real SDK definitions; missing SDK fails closed', { skip }, async () => {
  const f = fixture(); const saved = { role: process.env.PI_ROLE, dir: process.env.PI_CODING_AGENT_DIR, sdk: process.env.PI_CODING_AGENT_SDK_PATH };
  try {
    process.env.PI_CODING_AGENT_DIR = path.dirname(f.globalPath);
    const register = (await import('../pi/extensions/role-guard.ts')).default;
    for (const role of ['coder', 'auditor', 'explorer', 'unknown', undefined]) {
      if (role === undefined) delete process.env.PI_ROLE; else process.env.PI_ROLE = role;
      const registered = new Map(); await register({ registerTool: definition => registered.set(definition.name, definition) });
      assert.deepEqual([...registered.keys()], ['edit', 'write']);
      const p = put(f, 'src/a.txt', 'hello');
      for (const kind of ['edit', 'write']) {
        const input = kind === 'edit' ? edit(p, 'hello', 'world') : { path: p, content: 'world' };
        if (role === 'coder') { await run(registered.get(kind), f, input); assert.deepEqual(snapshot(p), Buffer.from('world')); fs.writeFileSync(p, 'hello'); }
        else await denied(p, () => run(registered.get(kind), f, input));
      }
    }
    process.env.PI_ROLE = 'coder'; process.env.PI_CODING_AGENT_SDK_PATH = path.join(f.base, 'missing-sdk.js');
    const failed = new Map(); await register({ registerTool: d => failed.set(d.name, d) });
    const p = put(f, 'src/a.txt', 'hello');
    for (const kind of ['edit', 'write']) await denied(p, () => run(failed.get(kind), f, { path: p, content: 'bad', edits: [] }));
  } finally {
    for (const [key, value] of Object.entries({ PI_ROLE: saved.role, PI_CODING_AGENT_DIR: saved.dir, PI_CODING_AGENT_SDK_PATH: saved.sdk })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    f.cleanup();
  }
});
// Fake native definitions expose any execution without touching the target files.
async function fakeGuardSdk(f) {
  const file = path.join(f.base, 'sdk.mjs');
  fs.writeFileSync(file, `const make = name => (cwd, options) => ({ name, async execute(id, input) { globalThis.__piGuardNative.push({name, cwd, input, hasOperations: !!options?.operations}); return {}; } });\nexport const createEditToolDefinition = make('edit');\nexport const createWriteToolDefinition = make('write');\n`);
  globalThis.__piGuardNative = [];
  return file;
}
async function registeredGuard(register, f, sdkPath) {
  process.env.PI_ROLE = 'coder'; process.env.PI_CODING_AGENT_DIR = path.dirname(f.globalPath); process.env.PI_CODING_AGENT_SDK_PATH = sdkPath;
  const registered = new Map(); await register({ registerTool: d => registered.set(d.name, d) }); return registered;
}
function restoreGuardEnv(saved) {
  for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  delete globalThis.__piGuardNative;
}
function saveGuardEnv() { return Object.fromEntries(['PI_ROLE', 'PI_CODING_AGENT_DIR', 'PI_CODING_AGENT_SDK_PATH'].map(k => [k, process.env[k]])); }

test('GX01 resolvable relative SDK path replaces both native tools with refusal stubs', async () => {
  const f = fixture(), saved = saveGuardEnv(); try {
    const sdkPath = await fakeGuardSdk(f), register = (await import('../pi/extensions/role-guard.ts')).default;
    const p = put(f, 'src/a.txt', 'before');
    const control = await registeredGuard(register, f, sdkPath);
    await run(control.get('write'), f, { path: p, content: 'control' }); assert.equal(globalThis.__piGuardNative.length, 1);
    globalThis.__piGuardNative.length = 0;
    const relative = path.relative(process.cwd(), sdkPath); assert.equal(path.isAbsolute(relative), false);
    const failed = await registeredGuard(register, f, relative);
    for (const kind of ['edit', 'write']) await denied(p, () => run(failed.get(kind), f, { path: p, content: 'bad', edits: [] }));
    assert.equal(globalThis.__piGuardNative.length, 0);
  } finally { restoreGuardEnv(saved); f.cleanup(); }
});

test('GX02 relative cwd refuses before native write even for an otherwise owned target', async () => {
  const f = fixture(), saved = saveGuardEnv(); try {
    const sdkPath = await fakeGuardSdk(f), register = (await import('../pi/extensions/role-guard.ts')).default;
    const tools = await registeredGuard(register, f, sdkPath);
    const target = path.join(process.cwd(), 'tests', 'pi-extension.test.mjs'); const before = snapshot(target);
    await tools.get('write').execute('id', { path: target, content: 'bad' }, undefined, undefined, { cwd: process.cwd() });
    assert.equal(globalThis.__piGuardNative.length, 1); globalThis.__piGuardNative.length = 0;
    await assert.rejects(tools.get('write').execute('id', { path: target, content: 'bad' }, undefined, undefined, { cwd: '.' }), /project directory/i);
    assert.equal(globalThis.__piGuardNative.length, 0); assert.deepEqual(snapshot(target), before);
  } finally { restoreGuardEnv(saved); f.cleanup(); }
});

test('GX03 native edit and write are never executed for foreign targets', async () => {
  const f = fixture(), saved = saveGuardEnv(); try {
    const sdkPath = await fakeGuardSdk(f), register = (await import('../pi/extensions/role-guard.ts')).default;
    const tools = await registeredGuard(register, f, sdkPath);
    const owned = put(f, 'src/a.txt', 'before'), foreign = put(f, 'todo.md', initial);
    for (const kind of ['edit', 'write']) {
      await run(tools.get(kind), f, { path: owned });
      const count = globalThis.__piGuardNative.length;
      await denied(foreign, () => run(tools.get(kind), f, { path: foreign }));
      assert.equal(globalThis.__piGuardNative.length, count);
    }
    assert.equal(globalThis.__piGuardNative.length, 2);
  } finally { restoreGuardEnv(saved); f.cleanup(); }
});

test('GX05 non-function guard core causes both native tools to be replaced', async () => {
  const f = fixture(), saved = saveGuardEnv(); try {
    const sdkPath = await fakeGuardSdk(f), normal = (await import('../pi/extensions/role-guard.ts')).default;
    const p = put(f, 'src/a.txt', 'before'); const control = await registeredGuard(normal, f, sdkPath);
    await run(control.get('write'), f, { path: p }); assert.equal(globalThis.__piGuardNative.length, 1);
    globalThis.__piGuardNative.length = 0;
    const extension = path.join(f.base, 'extensions', 'role-guard.ts'), lib = path.join(f.base, 'lib');
    fs.mkdirSync(path.dirname(extension)); fs.mkdirSync(lib);
    fs.copyFileSync('pi/extensions/role-guard.ts', extension); fs.writeFileSync(path.join(lib, 'role-guard-core.mjs'), 'export const createGuardedOperations = 1;');
    const register = (await import(pathToFileURL(extension).href)).default;
    const failed = await registeredGuard(register, f, sdkPath);
    for (const kind of ['edit', 'write']) {
      await assert.rejects(run(failed.get(kind), f, { path: p }), /guard dependency unavailable/i);
      assert.equal(failed.get(kind).description, 'Unavailable: mutation guard dependency failed to load.');
    }
    assert.equal(globalThis.__piGuardNative.length, 0); assert.equal(snapshot(p).toString(), 'before');
  } finally { restoreGuardEnv(saved); f.cleanup(); }
});

test('missing guard core still registers refusing edit and write', { skip }, async () => {
  const f = fixture(); const saved = process.env.PI_ROLE;
  try {
    process.env.PI_ROLE = 'coder'; const extension = path.join(f.base, 'extensions', 'role-guard.ts');
    fs.mkdirSync(path.dirname(extension)); fs.copyFileSync('pi/extensions/role-guard.ts', extension);
    const register = (await import(pathToFileURL(extension).href)).default;
    const registered = new Map(); await register({ registerTool: d => registered.set(d.name, d) });
    assert.deepEqual([...registered.keys()], ['edit', 'write']); const p = put(f, 'src/a.txt', 'hello');
    for (const kind of ['edit', 'write']) await denied(p, () => run(registered.get(kind), f, { path: p, content: 'bad', edits: [] }));
  } finally { if (saved === undefined) delete process.env.PI_ROLE; else process.env.PI_ROLE = saved; f.cleanup(); }
});
for (const role of ['strategist', 'scribe']) test(`${role} refuses empty approval prefixes`, { skip }, async () => {
  const f = fixture(); try { const p = put(f, role === 'strategist' ? 'todo.md' : 'docs/a.md', 'hello\n');
    const declaration = policy(); declaration.approvalLinePrefixes = []; fs.writeFileSync(f.globalPath, JSON.stringify(declaration));
    for (const kind of ['edit', 'write']) await denied(p, () => run(tools(f, role)[kind], f, kind === 'edit' ? edit(p, 'hello', 'world') : { path: p, content: 'world\n' }));
  } finally { f.cleanup(); }
});
test('policy is reloaded at every write boundary and refused writes do not create parent directories', { skip }, async () => {
  const f = fixture(); try { const t = tools(f, 'coder'); const p = put(f, 'src/a.txt', 'hello');
    await run(t.write, f, { path: p, content: 'world' }); fs.writeFileSync(f.globalPath, '{');
    await denied(p, () => run(t.write, f, { path: p, content: 'bad' }));
    const absent = path.join(f.project, 'new', 'deep', 'file.txt');
    await denied(absent, () => run(t.write, f, { path: absent, content: 'bad' })); assert.equal(fs.existsSync(path.dirname(absent)), false);
  } finally { f.cleanup(); }
});
test('latest policy governs final candidate if ownership declaration changes during write', { skip }, async () => {
  const f = fixture(); try { const p = put(f, 'docs/a.md', 'Secret: yes\n\nhello\n'); let reads = 0;
    const injected = { ...fsp, readFile: async (...args) => { const result = await fsp.readFile(...args); if (++reads === 1) { const changed = policy(); changed.approvalLinePrefixes = ['Secret:']; await fsp.writeFile(f.globalPath, JSON.stringify(changed)); } return result; } };
    await denied(p, () => run(tools(f, 'scribe', { fs: injected }).write, f, { path: p, content: 'hello\n' }));
  } finally { f.cleanup(); }
});
test('evidence wx refuses a competing creator after authorization', { skip }, async () => {
  const f = fixture(); try { const p = path.join(f.project, 'Artifacts/Evidence/x/a.txt'); let attempts = 0;
    const injected = { ...fsp, writeFile: async (target, content, options) => { attempts++; assert.equal(options.flag, 'wx'); await fsp.writeFile(target, 'external', { flag: 'wx' }); return fsp.writeFile(target, content, options); } };
    await assert.rejects(run(tools(f, 'coder', { fs: injected }).write, f, { path: p, content: 'ours' }), /already exists/i);
    assert.equal(attempts, 1); assert.deepEqual(snapshot(p), Buffer.from('external'));
  } finally { f.cleanup(); }
});
test('strategist mixed EOL BOM native normalization is refused when unchanged line endings change', { skip }, async () => {
  const f = fixture(); try { const original = '\ufeff# Plan\r\n\nApproval: yes\n\n' + task + '\r\n'; const p = put(f, 'todo.md', original);
    await denied(p, () => run(tools(f, 'strategist').edit, f, edit(p, 'Build', 'Build better')));
  } finally { f.cleanup(); }
});
