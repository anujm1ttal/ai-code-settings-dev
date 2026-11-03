import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { markVerified } from '../scripts/mark-verified.mjs';
import { canonicalTaskHash } from '../pi/lib/verdict.mjs';
import { persistFullResult } from '../pi/lib/result-contract.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'mark-verified.mjs');
const TODO = 'Artifacts/Plans/X-TODO.md';
const TARGET = '- [ ] [coder] T7: target task — Success: x — Mode: AFK';
const TODAY = '2026-11-03';

function project(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-mark-'));
  fs.mkdirSync(path.join(root, 'Artifacts', 'Plans'), { recursive: true });
  fs.mkdirSync(path.join(root, 'Artifacts', '.agent', 'pi-results'), { recursive: true });
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
// ~870 lines, mixed endings by line index, target in the middle.
function fixture({ eol = i => (i % 3 ? '\r\n' : '\n'), bom = true, finalNewline = false, target = TARGET, extra = [] } = {}) {
  const lines = [];
  for (let i = 0; i < 870; i++) lines.push(i === 400 ? target : i % 7 === 0 ? `- [ ] [coder] T${1000 + i}: filler ${i} café 🚀` : `prose ${i} — ünïcode`);
  lines.push(...extra);
  let s = lines.map((l, i) => l + (i === lines.length - 1 && !finalNewline ? '' : eol(i))).join('');
  return (bom ? '\uFEFF' : '') + s;
}
const writeTodo = (root, text) => { const p = path.join(root, TODO); fs.writeFileSync(p, Buffer.from(text, 'utf8')); return p; };
const resultFor = (root, { line = TARGET, task = 'T7', todo = TODO, verdict = 'PASS', id = 'role-t7', role = 'auditor', completeness = 'complete', hash } = {}) =>
  persistFullResult({
    dir: path.join(root, 'Artifacts', '.agent', 'pi-results'), dispatchId: id, role, completeness, meta: { role },
    text: `Report.\nVERDICT: ${verdict} task=${task} todo=${todo} taskSha256=${hash ?? canonicalTaskHash(line)}\n`,
  });
const run = (root, todoPath, receipt, o = {}) =>
  markVerified({ root, todo: todoPath, taskId: o.taskId ?? 'T7', resultRef: receipt.ref, apply: o.apply, acceptUncorroborated: o.accept ?? true, today: TODAY });

test('dry run writes nothing and reports the evidence kind and the planned line', () => project(root => {
  const p = writeTodo(root, fixture());
  const r = resultFor(root);
  const before = fs.readFileSync(p);
  const out = run(root, p, r);
  assert.equal(out.applied, false);
  assert.equal(out.evidence, 'uncorroborated');
  assert.match(out.newLine, /^- \[x\] \[coder\] T7: target task .* — Auditor-verified 2026-11-03 \(PASS; verdict=role-t7; sha256=[0-9a-f]{64}\)$/);
  assert.deepEqual(fs.readFileSync(p), before);
  assert.deepEqual(fs.readdirSync(path.dirname(p)), ['X-TODO.md']);
}));

for (const [name, opts] of [
  ['mixed endings with BOM, no final newline', {}],
  ['mixed endings, no BOM, final newline', { bom: false, finalNewline: true }],
  ['all LF', { eol: () => '\n', bom: false, finalNewline: true }],
  ['all CRLF with BOM', { eol: () => '\r\n', finalNewline: true }],
  ['lone CR endings', { eol: () => '\r', bom: false }],
]) {
  test(`--apply changes exactly one marker character and one suffix: ${name}`, () => project(root => {
    const text = fixture(opts);
    const p = writeTodo(root, text);
    const r = resultFor(root);
    const out = run(root, p, r, { apply: true });
    assert.equal(out.applied, true);
    const before = Buffer.from(text, 'utf8');
    const after = fs.readFileSync(p);
    const suffix = ` — Auditor-verified ${TODAY} (PASS; verdict=role-t7; sha256=${r.sha256})`;
    const at = before.indexOf(Buffer.from(TARGET, 'utf8'));
    assert.ok(at > 0);
    const expected = Buffer.concat([
      before.subarray(0, at), Buffer.from(TARGET.replace('[ ]', '[x]') + suffix, 'utf8'), before.subarray(at + Buffer.byteLength(TARGET)),
    ]);
    assert.deepEqual(after, expected);
    assert.equal(after[0] === 0xEF, text.startsWith('\uFEFF'));
    assert.equal(after.at(-1) === 10 || after.at(-1) === 13, before.at(-1) === 10 || before.at(-1) === 13);
    assert.deepEqual(fs.readdirSync(path.dirname(p)), ['X-TODO.md']);
  }));
}

test('a [-] marker is accepted and becomes [x]', () => project(root => {
  const line = TARGET.replace('[ ]', '[-]');
  const p = writeTodo(root, fixture({ target: line }));
  const r = resultFor(root, { line });
  run(root, p, r, { apply: true });
  assert.ok(fs.readFileSync(p, 'utf8').includes('- [x] [coder] T7: target task'));
}));

test('a prior review suffix is replaced, not stacked, and the hash still matches', () => project(root => {
  const line = TARGET + ' — Auditor-reviewed 2026-11-01 (FAIL; verdict=role-old; sha256=' + 'a'.repeat(64) + ')';
  const p = writeTodo(root, fixture({ target: line }));
  const r = resultFor(root, { line: TARGET });
  run(root, p, r, { apply: true });
  const text = fs.readFileSync(p, 'utf8');
  assert.equal((text.match(/Auditor-(verified|reviewed)/g) ?? []).length, 1);
  assert.ok(text.includes('Auditor-verified 2026-11-03'));
}));

const refused = (root, p, r, re, o) => assert.throws(() => run(root, p, r, { apply: true, ...o }), re);
const unchanged = (p, bytes) => assert.deepEqual(fs.readFileSync(p), bytes);

test('refusals leave the file byte-identical: FAIL, INCOMPLETE, forged role, partial, wrong id/path, stale hash', () => project(root => {
  const p = writeTodo(root, fixture());
  const bytes = fs.readFileSync(p);
  refused(root, p, resultFor(root, { verdict: 'FAIL', id: 'role-f' }), /not PASS|FAIL/);
  refused(root, p, resultFor(root, { verdict: 'INCOMPLETE', id: 'role-i' }), /not PASS|INCOMPLETE/);
  refused(root, p, resultFor(root, { role: 'coder', id: 'role-c' }), /role/);
  refused(root, p, resultFor(root, { completeness: 'partial', id: 'role-p' }), /complete/);
  refused(root, p, resultFor(root, { task: 'T8', id: 'role-w' }), /task/);
  refused(root, p, resultFor(root, { todo: 'Artifacts/Plans/Y.md', id: 'role-y' }), /todo/);
  refused(root, p, resultFor(root, { hash: 'd'.repeat(64), id: 'role-h' }), /stale|hash/);
  refused(root, p, resultFor(root, { line: TARGET + ' edited', id: 'role-e' }), /stale|hash/);
  unchanged(p, bytes);
}));

test('already [x], other markers, missing task, duplicate ids and fenced lookalikes are refused', () => project(root => {
  const r = resultFor(root);
  let p = writeTodo(root, fixture({ target: TARGET.replace('[ ]', '[x]') }));
  refused(root, p, resultFor(root, { line: TARGET, id: 'role-x' }), /marker|already/);
  p = writeTodo(root, fixture({ target: TARGET.replace('[ ]', '[~]') }));
  refused(root, p, r, /marker|task line|not found/);
  p = writeTodo(root, fixture({ target: 'prose only' }));
  refused(root, p, r, /not found/);
  p = writeTodo(root, fixture({ extra: ['- [ ] [coder] T7: a duplicate'] }));
  const b = fs.readFileSync(p);
  refused(root, p, r, /duplicate|ambiguous/);
  unchanged(p, b);
  p = writeTodo(root, fixture({ extra: ['```', '- [ ] [coder] T7: inside a fence', '```'] }));
  refused(root, p, r, /duplicate|ambiguous|fence/);
  p = writeTodo(root, fixture({ extra: ['> - [ ] [coder] T7: quoted'] }));
  refused(root, p, r, /duplicate|ambiguous|lookalike/);
  p = writeTodo(root, fixture({ extra: ['```', 'unterminated'] }));
  refused(root, p, r, /fence|ambiguous/);
}));

test('a target inside a fence is never edited even when it is the only match', () => project(root => {
  const t = fixture({ target: 'x', extra: ['```', TARGET, '```'] });
  const p = writeTodo(root, t);
  refused(root, p, resultFor(root), /fence|ambiguous|not found/);
  unchanged(p, Buffer.from(t, 'utf8'));
}));

test('the top-level TODO and files outside the project are refused', () => project(root => {
  const top = path.join(root, 'Artifacts', 'TODO.md');
  fs.writeFileSync(top, fixture());
  const r = resultFor(root, { todo: 'Artifacts/TODO.md' });
  assert.throws(() => run(root, top, r, { apply: true }), /eligible|top-level/);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-out-'));
  try {
    const o = path.join(outside, 'X-TODO.md'); fs.writeFileSync(o, fixture());
    assert.throws(() => run(root, o, resultFor(root, { id: 'role-o' }), { apply: true }), /outside|project/);
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
}));

test('an uncorroborated result needs explicit acceptance to apply; dry run does not', () => project(root => {
  const p = writeTodo(root, fixture());
  const r = resultFor(root);
  assert.throws(() => run(root, p, r, { apply: true, accept: false }), /uncorroborated/);
  assert.equal(run(root, p, r, { apply: false, accept: false }).evidence, 'uncorroborated');
  assert.ok(!fs.readFileSync(p, 'utf8').includes('[x] [coder] T7'));
}));

test('a background job result with a settlement applies without the acceptance flag', () => project(root => {
  const p = writeTodo(root, fixture());
  const r = resultFor(root, { id: 'job-9' });
  fs.writeFileSync(path.join(root, 'Artifacts', '.agent', 'pi-results', 'job-9.settlement.json'), JSON.stringify({
    version: 1, dispatchId: 'job-9', role: 'auditor', state: 'succeeded', outcome: 'ok', cost: null,
    receipt: { ref: r.ref, sha256: r.sha256, bytes: r.bytes, completeness: 'complete' } }));
  const out = run(root, p, r, { apply: true, accept: false });
  assert.equal(out.evidence, 'settlement');
  assert.ok(fs.readFileSync(p, 'utf8').includes('verdict=job-9'));
}));

test('a file changed between planning and writing is not overwritten', () => project(root => {
  const p = writeTodo(root, fixture());
  const r = resultFor(root);
  assert.throws(() => markVerified({
    root, todo: p, taskId: 'T7', resultRef: r.ref, apply: true, acceptUncorroborated: true, today: TODAY,
    _beforeWrite: () => fs.appendFileSync(p, 'concurrent edit\n'),
  }), /changed/);
  assert.ok(fs.readFileSync(p, 'utf8').endsWith('concurrent edit\n'));
  assert.ok(!fs.readFileSync(p, 'utf8').includes('Auditor-verified'));
  assert.deepEqual(fs.readdirSync(path.dirname(p)), ['X-TODO.md']);
}));

test('a symlinked todo is refused', () => project(root => {
  const real = writeTodo(root, fixture());
  const link = path.join(root, 'Artifacts', 'Plans', 'L-TODO.md');
  try { fs.symlinkSync(real, link); } catch { return; }
  assert.throws(() => run(root, link, resultFor(root, { todo: 'Artifacts/Plans/L-TODO.md' }), { apply: true }), /regular|link/);
}));

test('CLI: dry run by default (exit 0), --apply writes, refusal exits 1, usage exits 2', () => project(root => {
  const p = writeTodo(root, fixture());
  const r = resultFor(root);
  const cli = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8' });
  const dry = cli(p, 'T7', r.ref, '--root', root);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout + dry.stderr, /uncorroborated/);
  const dry2 = cli(p, 'T7', r.ref, '--root', root, '--accept-uncorroborated');
  assert.equal(dry2.status, 0, dry2.stderr);
  assert.ok(!fs.readFileSync(p, 'utf8').includes('Auditor-verified'));
  const bad = cli(p, 'T8', r.ref, '--root', root, '--accept-uncorroborated', '--apply');
  assert.equal(bad.status, 1);
  assert.ok(!fs.readFileSync(p, 'utf8').includes('Auditor-verified'));
  const ok = cli(p, 'T7', r.ref, '--root', root, '--accept-uncorroborated', '--apply');
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(fs.readFileSync(p, 'utf8').includes('Auditor-verified'));
  assert.equal(cli().status, 2);
  assert.equal(cli(p, 'T7', r.ref, '--bogus').status, 2);
}));

// ---- T5 mutation-pass additions (survivors turned into tests)
test('T5: an invalid task id is refused as such, before any lookup', () => project(root => {
  const p = writeTodo(root, fixture()); const r = resultFor(root);
  for (const taskId of ['', 'T 7', 'T7;', 'a'.repeat(41)]) assert.throws(() => run(root, p, r, { taskId }), /invalid task id/);
}));

test('T5: ~~~ fences count as fences; a quoted lookalike alone is not a task line', () => project(root => {
  const r = resultFor(root);
  let p = writeTodo(root, fixture({ extra: ['~~~', 'unterminated'] }));
  refused(root, p, r, /unbalanced code fence/);
  p = writeTodo(root, fixture({ target: 'x', extra: ['> ' + TARGET] }));
  refused(root, p, r, /lookalike/);
}));

test('T5: the default date is the local calendar date', () => project(root => {
  const p = writeTodo(root, fixture()); const r = resultFor(root);
  const d = new Date(); const pad = n => String(n).padStart(2, '0');
  const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const out = markVerified({ root, todo: p, taskId: 'T7', resultRef: r.ref, apply: false, acceptUncorroborated: true });
  assert.ok(out.newLine.includes(`Auditor-verified ${today} (PASS`), out.newLine);
}));

test('T5: a directory is refused as a todo with the regular-file reason', () => project(root => {
  const r = resultFor(root);
  const dir = path.join(root, 'Artifacts', 'Plans', 'D-TODO.md'); fs.mkdirSync(dir);
  assert.throws(() => run(root, dir, r, { apply: true }), /not a regular file/);
}));

test('T5: a project root reached through a junction still works', () => project(root => {
  const p = writeTodo(root, fixture()); const r = resultFor(root);
  const link = root + '-junction';
  try { fs.symlinkSync(root, link, 'junction'); } catch { return; }
  try {
    const out = markVerified({ root: link, todo: p, taskId: 'T7', resultRef: r.ref, apply: false, acceptUncorroborated: true, today: TODAY });
    assert.equal(out.todo, TODO);
  } finally { fs.rmdirSync(link); }
}));

test('T5: file mode is preserved on POSIX (not observable on Windows)', { skip: process.platform === 'win32' }, () => project(root => {
  const p = writeTodo(root, fixture()); fs.chmodSync(p, 0o640);
  run(root, p, resultFor(root), { apply: true });
  assert.equal(fs.statSync(p).mode & 0o777, 0o640);
}));

test('T5: CLI rejects extra positionals and resolves a relative result path against the cwd', () => project(root => {
  const p = writeTodo(root, fixture()); const r = resultFor(root);
  const cli = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd: root, encoding: 'utf8' });
  assert.equal(cli(p, 'T7', r.ref, 'extra', '--root', root, '--accept-uncorroborated').status, 2);
  const rel = path.relative(root, r.ref);
  const out = cli(p, 'T7', rel, '--root', root, '--accept-uncorroborated');
  assert.equal(out.status, 0, out.stderr);
}));
