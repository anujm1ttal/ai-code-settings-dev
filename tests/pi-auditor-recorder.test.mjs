import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { canonicalTaskHash } from '../pi/lib/verdict.mjs';
import { buildAuditorRecording } from '../pi/lib/todo-ownership.mjs';
import { persistFullResult } from '../pi/lib/result-contract.mjs';
import { checkMarkers } from '../scripts/check-markers.mjs';

const lib = await import('../pi/lib/auditor-recorder.mjs').catch(e => e.code === 'ERR_MODULE_NOT_FOUND' ? null : Promise.reject(e));
const todo = 'Artifacts/Plans/X-TODO.md', results = 'Artifacts/.agent/pi-results';
const line = '- [ ] [coder] T1: Build — Success: works — Mode: AFK';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture({ verdict = 'PASS', dispatch = 'job-1', original = `\ufeff# Plan\r\n\n${line}\r\n`, completeness = 'complete', settle = true } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-recorder-')), root = path.join(base, 'project'), agent = path.join(base, 'agent');
  fs.mkdirSync(path.join(root, 'Artifacts/Plans'), { recursive: true }); fs.mkdirSync(path.join(root, results), { recursive: true }); fs.mkdirSync(agent);
  const globalPath = path.join(agent, 'role-ownership.json');
  fs.writeFileSync(globalPath, JSON.stringify({ version: 1, roles: { strategist: { plans: [], todos: ['Artifacts/Plans/*.md'] }, coder: { residual: true, generated: [] }, auditor: { todos: ['Artifacts/Plans/*.md'] }, scribe: { docs: [] } }, protected: [], approvalLinePrefixes: ['Approval:'] }));
  const target = path.join(root, todo); fs.writeFileSync(target, original);
  const r = persistFullResult({ dir: path.join(root, results), dispatchId: dispatch, role: 'auditor', completeness, meta: { role: 'auditor' }, text: `Report.\nVERDICT: ${verdict} task=T1 todo=${todo} taskSha256=${canonicalTaskHash(line)}\n` });
  if (settle) fs.writeFileSync(path.join(root, results, `${dispatch}.settlement.json`), JSON.stringify({ version: 1, dispatchId: dispatch, role: 'auditor', state: 'succeeded', receipt: { sha256: r.sha256, bytes: r.bytes, completeness: 'complete' } }));
  const manifestPath = 'Artifacts/manifest.json'; fs.writeFileSync(path.join(root, manifestPath), '{"version":1}');
  const binding = { todo, taskId: 'T1', taskSha256: canonicalTaskHash(line), verdictRef: `${results}/${dispatch}.result`, verdictSha256: r.sha256, manifestPath, manifestSha256: sha(fs.readFileSync(path.join(root, manifestPath))), date: '2026-11-03' };
  return { base, root, agent, globalPath, target, r, binding, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}
const recorder = (f, overrides = {}) => lib.createRecorder({ binding: f.binding, projectRoot: f.root, globalPath: f.globalPath, role: 'auditor', ...overrides });
const denied = (f, fn, reason) => { const before = fs.readFileSync(f.target); assert.throws(fn, reason); assert.deepEqual(fs.readFileSync(f.target), before); };

test('recorder exposes the bound recording API', () => {
  assert.equal(typeof lib?.validateBinding, 'function'); assert.equal(typeof lib?.createRecorder, 'function');
});

test('PASS and FAIL preserve exact bytes, are single-use and pass check-markers', () => {
  for (const verdict of ['PASS', 'FAIL']) {
    const f = fixture({ verdict, original: `\ufeff# Plan\r\n\n${verdict === 'FAIL' ? line.replace('[ ]', '[x]') : line}\r\n# End` });
    try {
      const original = fs.readFileSync(f.target), record = recorder(f);
      const expected = buildAuditorRecording(original, { taskId: 'T1', verdict, date: f.binding.date, ref: `${verdict}; verdict=job-1; sha256=${f.r.sha256}`, approvalLinePrefixes: ['Approval:'] });
      assert.equal(expected.ok, true); const out = record(); assert.equal(out.verdict, verdict);
      assert.deepEqual(fs.readFileSync(f.target), expected.candidate);
      assert.deepEqual(checkMarkers({ root: f.root, todos: [f.target] }).counts, { [verdict === 'PASS' ? 'valid' : 'reviewed']: 1 });
      denied(f, record, /once|already|used/i);
    } finally { f.cleanup(); }
  }
});

test('binding rejects unknown, missing, invalid or noncanonical fields', () => {
  const f = fixture(); try {
    assert.doesNotThrow(() => lib.validateBinding(f.binding));
    const cases = [{ ...f.binding, extra: 1 }, Object.fromEntries(Object.entries(f.binding).filter(([k]) => k !== 'date')),
      ...['../x', '/tmp/x', 'Artifacts/Plans/../x', 'Artifacts\\Plans\\X.md', 'Artifacts//x'].map(todo => ({ ...f.binding, todo })),
      { ...f.binding, verdictRef: 'Artifacts/.agent/pi-results/../job-1.result' }, { ...f.binding, manifestPath: '../x' },
      { ...f.binding, taskId: '../x' }, { ...f.binding, taskSha256: 'A'.repeat(64) }, { ...f.binding, verdictSha256: 'x' },
      { ...f.binding, manifestSha256: 'x' }, { ...f.binding, date: '2026-02-30' }];
    for (const binding of cases) denied(f, () => recorder(f, { binding })(), /./);
  } finally { f.cleanup(); }
});

test('all authorization, task and evidence refusals leave target unchanged', async t => {
  const cases = [
    ['role', f => ({ role: 'coder' })],
    ['unowned top-level TODO', f => { const target = path.join(f.root, 'Artifacts/TODO.md'); fs.copyFileSync(f.target, target); return { binding: { ...f.binding, todo: 'Artifacts/TODO.md' } }; }],
    ['missing ownership', f => { fs.unlinkSync(f.globalPath); return {}; }],
    ['protected path', f => { const p = JSON.parse(fs.readFileSync(f.globalPath)); p.protected = [todo]; fs.writeFileSync(f.globalPath, JSON.stringify(p)); return {}; }],
    ['hard-linked target', f => { fs.linkSync(f.target, path.join(f.root, 'linked.md')); return {}; }],
    ['ineligible', f => { fs.writeFileSync(f.target, `${line}\n${line}\n`); return {}; }],
    ['missing task', f => ({ binding: { ...f.binding, taskId: 'T2' } })],
    ['stale task', f => { fs.writeFileSync(f.target, line.replace('works', 'changed')); return {}; }],
    ['checked PASS', f => { fs.writeFileSync(f.target, line.replace('[ ]', '[x]')); return {}; }],
    ['result missing', f => { fs.unlinkSync(f.r.ref); return {}; }],
    ['result directory', f => { fs.unlinkSync(f.r.ref); fs.mkdirSync(f.r.ref); return {}; }],
    ['result hash changed', f => { fs.appendFileSync(f.r.ref, 'changed'); return {}; }],
    ['missing settlement', f => { fs.unlinkSync(path.join(f.root, results, 'job-1.settlement.json')); return {}; }],
    ['manifest missing', f => { fs.unlinkSync(path.join(f.root, f.binding.manifestPath)); return {}; }],
    ['manifest stale', f => { fs.writeFileSync(path.join(f.root, f.binding.manifestPath), 'changed'); return {}; }],
  ];
  for (const [name, change] of cases) await t.test(name, () => { const f = fixture(); try { const opts = change(f); denied(f, () => recorder(f, opts)(), /./); if (name === 'unowned top-level TODO') assert.equal(fs.readFileSync(path.join(f.root, 'Artifacts/TODO.md'), 'utf8'), fs.readFileSync(f.target, 'utf8')); } finally { f.cleanup(); } });
  for (const [name, options] of [['uncorroborated', { dispatch: 'role-1' }], ['partial', { completeness: 'partial' }], ['incomplete', { verdict: 'INCOMPLETE' }]]) await t.test(name, () => { const f = fixture(options); try { denied(f, () => recorder(f)(), /./); } finally { f.cleanup(); } });
});

test('target drift before write refuses without overwriting external bytes', () => {
  const f = fixture(); try {
    let reads = 0;
    const injected = { ...fs, readFileSync(p, ...args) { const value = fs.readFileSync(p, ...args); if (p === f.target && ++reads === 1) fs.writeFileSync(p, 'external'); return value; } };
    assert.throws(() => recorder(f, { fs: injected })(), /drift/i); assert.equal(fs.readFileSync(f.target, 'utf8'), 'external');
    assert.deepEqual(fs.readdirSync(path.dirname(f.target)), ['X-TODO.md']);
  } finally { f.cleanup(); }
});

test('failed rename removes the exclusive temporary file and preserves target bytes', () => {
  const f = fixture(); try {
    let flags; const injected = { ...fs, openSync(p, flag, ...args) { flags = flag; return fs.openSync(p, flag, ...args); }, renameSync() { throw new Error('injected rename failure'); } };
    denied(f, () => recorder(f, { fs: injected })(), /rename failure/);
    assert.equal(flags, 'wx'); assert.deepEqual(fs.readdirSync(path.dirname(f.target)), ['X-TODO.md']);
  } finally { f.cleanup(); }
});

test('child recorder shares the Pi per-file mutation queue', { skip: !process.env.PI_CODING_AGENT_SDK_PATH }, async () => {
  const f = fixture(); const saved = { role: process.env.PI_ROLE, dir: process.env.PI_CODING_AGENT_DIR, binding: process.env.PI_RECORD_BINDING };
  try {
    process.env.PI_ROLE = 'auditor'; process.env.PI_CODING_AGENT_DIR = f.agent; process.env.PI_RECORD_BINDING = JSON.stringify(f.binding);
    const sdk = await import(pathToFileURL(process.env.PI_CODING_AGENT_SDK_PATH).href);
    const register = (await import('../pi/extensions/auditor-recorder.ts')).default; let tool;
    await register({ registerTool: d => { tool = d; } });
    let release, started; const waiting = new Promise(resolve => { release = resolve; }); const locked = new Promise(resolve => { started = resolve; });
    const blocker = sdk.withFileMutationQueue(f.target, async () => { started(); await waiting; }); await locked;
    const before = fs.readFileSync(f.target); let settled = false;
    const run = tool.execute('id', {}, undefined, undefined, { cwd: f.root }).finally(() => { settled = true; });
    try { await new Promise(resolve => setTimeout(resolve, 30)); assert.equal(settled, false); assert.deepEqual(fs.readFileSync(f.target), before); }
    finally { release(); await blocker; await run; }
    assert.notDeepEqual(fs.readFileSync(f.target), before);
  } finally {
    for (const [key, value] of Object.entries({ PI_ROLE: saved.role, PI_CODING_AGENT_DIR: saved.dir, PI_RECORD_BINDING: saved.binding })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } f.cleanup();
  }
});

test('real Pi loader discovers the child recorder tool', { skip: !process.env.PI_CODING_AGENT_SDK_PATH }, async () => {
  const f = fixture(); const saved = { role: process.env.PI_ROLE, dir: process.env.PI_CODING_AGENT_DIR, binding: process.env.PI_RECORD_BINDING };
  try {
    process.env.PI_ROLE = 'auditor'; process.env.PI_CODING_AGENT_DIR = f.agent; process.env.PI_RECORD_BINDING = JSON.stringify(f.binding);
    const { DefaultResourceLoader } = await import(pathToFileURL(process.env.PI_CODING_AGENT_SDK_PATH).href);
    const loader = new DefaultResourceLoader({ cwd: f.root, agentDir: f.agent, noExtensions: true, additionalExtensionPaths: [path.resolve('pi/extensions/auditor-recorder.ts')] });
    await loader.reload(); const loaded = loader.getExtensions(); assert.deepEqual(loaded.errors, []);
    const tool = loaded.extensions[0].tools.get('pi_record_verification').definition;
    const result = await tool.execute('id', {}, undefined, undefined, { cwd: f.root }); assert.match(result.content[0].text, /T1.*PASS/);
  } finally {
    for (const [key, value] of Object.entries({ PI_ROLE: saved.role, PI_CODING_AGENT_DIR: saved.dir, PI_RECORD_BINDING: saved.binding })) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } f.cleanup();
  }
});

test('child extension registers a bound empty-input tool and fails closed', { skip: !process.env.PI_CODING_AGENT_SDK_PATH }, async () => {
  const f = fixture(); const saved = { ...process.env };
  try {
    process.env.PI_ROLE = 'auditor'; process.env.PI_CODING_AGENT_DIR = f.agent; process.env.PI_RECORD_BINDING = JSON.stringify(f.binding);
    const extension = await import('../pi/extensions/auditor-recorder.ts').catch(e => e.code === 'ERR_MODULE_NOT_FOUND' ? null : Promise.reject(e));
    assert.equal(typeof extension?.default, 'function', 'child recorder extension must register the tool');
    const register = extension.default;
    const get = async () => { const m = new Map(); await register({ registerTool: d => m.set(d.name, d) }); assert.deepEqual([...m.keys()], ['pi_record_verification']); return m.values().next().value; };
    const tool = await get(); assert.deepEqual(tool.parameters.properties, {}); assert.equal(tool.parameters.additionalProperties, false);
    const out = await tool.execute('id', {}, undefined, undefined, { cwd: f.root }); assert.match(out.content[0].text, /T1.*PASS/);
    await assert.rejects(tool.execute('id', {}, undefined, undefined, { cwd: f.root }), /Recording refused/);
    for (const [role, binding] of [['coder', JSON.stringify(f.binding)], ['auditor', 'bad'], ['auditor', '']]) {
      process.env.PI_ROLE = role; process.env.PI_RECORD_BINDING = binding; const stub = await get(); await assert.rejects(stub.execute('id', {}, undefined, undefined, { cwd: f.root }), /Recording refused/);
    }
    process.env.PI_RECORD_BINDING = JSON.stringify(f.binding); const stub = await get(); await assert.rejects(stub.execute('id', {}, undefined, undefined, { cwd: 'relative' }), /Recording refused/);
    const copied = path.join(f.base, 'extensions/auditor-recorder.ts'); fs.mkdirSync(path.dirname(copied)); fs.copyFileSync('pi/extensions/auditor-recorder.ts', copied);
    const missing = (await import(pathToFileURL(copied).href)).default, m = new Map(); await missing({ registerTool: d => m.set(d.name, d) }); assert.ok(m.has('pi_record_verification')); await assert.rejects(m.get('pi_record_verification').execute(), /Recording refused/);
    const sdk = process.env.PI_CODING_AGENT_SDK_PATH;
    try { process.env.PI_CODING_AGENT_SDK_PATH = path.join(f.base, 'missing-sdk.js'); const badSdk = await get(); await assert.rejects(badSdk.execute(), /Recording refused/); }
    finally { process.env.PI_CODING_AGENT_SDK_PATH = sdk; }
  } finally { for (const key of ['PI_ROLE', 'PI_CODING_AGENT_DIR', 'PI_RECORD_BINDING']) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; } f.cleanup(); }
});
