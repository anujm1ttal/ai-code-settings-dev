import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { markVerified } from '../scripts/mark-verified.mjs';
import { canonicalTaskHash } from '../pi/lib/verdict.mjs';
import { parseTodo, buildAuditorRecording } from '../pi/lib/todo-ownership.mjs';
import { persistFullResult } from '../pi/lib/result-contract.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/mark-verified.mjs', import.meta.url));
const TODO = 'Artifacts/Plans/X-TODO.md';
const TARGET = '- [ ] [coder] T7: target task — Success: x — Mode: AFK';
const TODAY = '2026-11-03';
function project(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-mark-'));
  fs.mkdirSync(path.join(root, 'Artifacts', 'Plans'), { recursive: true });
  fs.mkdirSync(path.join(root, 'Artifacts', '.agent', 'pi-results'), { recursive: true });
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const put = (root, text, rel = TODO) => { const p = path.join(root, rel); fs.writeFileSync(p, text); return p; };
const resultFor = (root, { line = TARGET, task = 'T7', todo = TODO, verdict = 'PASS', id = 'role-t7', role = 'auditor', completeness = 'complete', hash } = {}) => persistFullResult({
  dir: path.join(root, 'Artifacts', '.agent', 'pi-results'), dispatchId: id, role, completeness, meta: { role },
  text: `Report.\nVERDICT: ${verdict} task=${task} todo=${todo} taskSha256=${hash ?? canonicalTaskHash(line)}\n`,
});
const run = (root, todo, r, options = {}) => markVerified({ root, todo, taskId: 'T7', resultRef: r.ref, today: TODAY, ...options });

test('apply is retired for API and CLI without writing; acceptance option is removed', () => project(root => {
  const p = put(root, TARGET + '\n'); const r = resultFor(root); const before = fs.readFileSync(p);
  assert.throws(() => run(root, p, r, { apply: true }), /apply retired.*bound Auditor recorder/i);
  const cli = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd: root, encoding: 'utf8' });
  const out = cli(p, 'T7', r.ref, '--root', root, '--apply');
  assert.equal(out.status, 2); assert.match(out.stderr, /apply retired.*bound Auditor recorder/i);
  const oldInvocation = cli(p, 'T7', r.ref, '--accept-uncorroborated', '--apply');
  assert.equal(oldInvocation.status, 2); assert.match(oldInvocation.stderr, /apply retired.*bound Auditor recorder/i);
  assert.equal(cli(p, 'T7', r.ref, '--accept-uncorroborated').status, 2);
  assert.deepEqual(fs.readFileSync(p), before);
  const source = fs.readFileSync(SCRIPT, 'utf8');
  assert.doesNotMatch(source, /_beforeWrite|\b(?:writeFileSync|renameSync|unlinkSync)\b/);
  assert.match('fs.writeFileSync(x)', /\bwriteFileSync\b/);
}));

test('dry run uses exact recorder line, without writes (LF, CRLF, BOM, mixed, no final newline)', () => {
  for (const text of [TARGET + '\n', TARGET + '\r\n', '\ufeff' + TARGET + '\r\n', '# Head\r\n' + TARGET + '\n\nprose']) project(root => {
    const p = put(root, text); const r = resultFor(root); const before = fs.readFileSync(p);
    const out = run(root, p, r);
    const built = buildAuditorRecording(before, { taskId: 'T7', verdict: 'PASS', date: TODAY, ref: `PASS; verdict=role-t7; sha256=${r.sha256}` });
    assert.equal(built.ok, true, built.reasons.join('; '));
    const parsed = parseTodo(built.candidate); const t = parsed.tasks.find(x => x.id === 'T7');
    assert.equal(out.newLine, parsed.lines[t.lineIndex].text);
    assert.equal(out.oldLine, TARGET); assert.equal(out.evidence, 'uncorroborated'); assert.equal(out.applied, false);
    assert.deepEqual(fs.readFileSync(p), before);
  });
});

test('blocked and previously reviewed tasks get a single proposed PASS suffix', () => project(root => {
  const line = TARGET.replace('[ ]', '[-]') + ` — Auditor-reviewed 2026-11-01 (FAIL; verdict=role-old; sha256=${'a'.repeat(64)})`;
  const p = put(root, line); const out = run(root, p, resultFor(root));
  assert.match(out.newLine, /^- \[x\]/); assert.equal((out.newLine.match(/Auditor-/g) ?? []).length, 1);
}));

test('dry run refuses malformed, duplicate, fenced, indented, and lone-CR files', () => project(root => {
  const r = resultFor(root);
  for (const text of [TARGET + '\n' + TARGET, '```\n' + TARGET + '\n```', TARGET + '\n  ' + TARGET.replace('T7:', 'T8:'), TARGET + '\r', TARGET + '\n- [ ] malformed']) {
    const p = put(root, text); assert.throws(() => run(root, p, r), /ineligible/); assert.equal(fs.readFileSync(p, 'utf8'), text);
  }
  const p = put(root, TARGET.replace('T7:', 'T8:')); assert.throws(() => run(root, p, r), /not found/);
  put(root, TARGET.replace('[ ]', '[x]')); assert.throws(() => run(root, p, r), /already/);
}));

test('verdict must be a complete auditor PASS for this task, todo, and current definition', () => project(root => {
  const p = put(root, TARGET + '\n'); const before = fs.readFileSync(p);
  for (const [id, args] of Object.entries({ f: { verdict: 'FAIL' }, i: { verdict: 'INCOMPLETE' }, c: { role: 'coder' }, p: { completeness: 'partial' }, t: { task: 'T8' }, d: { todo: 'other' }, h: { hash: 'd'.repeat(64) } })) {
    assert.throws(() => run(root, p, resultFor(root, { id: `role-${id}`, ...args })));
  }
  assert.deepEqual(fs.readFileSync(p), before);
}));

test('top-level, outside project, directory, and symlink todos are refused', () => project(root => {
  const r = resultFor(root); const top = put(root, TARGET, 'Artifacts/TODO.md');
  assert.throws(() => run(root, top, r), /top-level/);
  assert.throws(() => run(root, path.dirname(top), r), /regular file/);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-out-'));
  try { const p = path.join(outside, 'todo'); fs.writeFileSync(p, TARGET); assert.throws(() => run(root, p, r), /outside/); }
  finally { fs.rmSync(outside, { recursive: true, force: true }); }
  const p = put(root, TARGET); const link = path.join(root, 'Artifacts', 'Plans', 'link');
  try { fs.symlinkSync(p, link); } catch { return; }
  assert.throws(() => run(root, link, r), /link|regular/);
}));

test('CLI dry run, usage and refusal exit codes; default date and invalid task id', () => project(root => {
  const p = put(root, TARGET + '\n'); const r = resultFor(root);
  const cli = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd: root, encoding: 'utf8' });
  const out = cli(p, 'T7', path.relative(root, r.ref), '--root', root);
  assert.equal(out.status, 0, out.stderr); assert.match(out.stdout, /DRY RUN.*uncorroborated/);
  assert.equal(cli(p, 'T8', r.ref, '--root', root).status, 1);
  assert.equal(cli().status, 2); assert.equal(cli(p, 'T7', r.ref, 'extra').status, 2);
  assert.throws(() => run(root, p, r, { taskId: 'bad id' }), /invalid task id/);
  const d = new Date(); const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assert.ok(markVerified({ root, todo: p, taskId: 'T7', resultRef: r.ref }).newLine.includes(date));
}));
