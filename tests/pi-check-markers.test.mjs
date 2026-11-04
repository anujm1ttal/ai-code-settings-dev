import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkMarkers } from '../scripts/check-markers.mjs';
import { buildAuditorRecording } from '../pi/lib/todo-ownership.mjs';
import { canonicalTaskHash } from '../pi/lib/verdict.mjs';
import { persistFullResult } from '../pi/lib/result-contract.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, '..', 'scripts', 'check-markers.mjs');
const TODO = 'Artifacts/Plans/X-TODO.md';
const L = id => `- [ ] [coder] ${id}: task ${id} — Success: x — Mode: AFK`;
const RES = 'Artifacts/.agent/pi-results';

function project(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-check-'));
  fs.mkdirSync(path.join(root, 'Artifacts', 'Plans'), { recursive: true });
  fs.mkdirSync(path.join(root, RES), { recursive: true });
  try { return fn(root); } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
const put = (root, rel, text) => { const p = path.join(root, rel); fs.writeFileSync(p, Buffer.from(text, 'utf8')); return p; };
const result = (root, { id, task, line, todo = TODO, verdict = 'PASS', role = 'auditor', completeness = 'complete', hash }) =>
  persistFullResult({
    dir: path.join(root, RES), dispatchId: id, role, completeness, meta: { role },
    text: `Report.\nVERDICT: ${verdict} task=${task} todo=${todo} taskSha256=${hash ?? canonicalTaskHash(line)}\n`,
  });
const settle = (root, r) => fs.writeFileSync(path.join(root, RES, `${path.basename(r.ref, '.result')}.settlement.json`), JSON.stringify({
  version: 1, dispatchId: path.basename(r.ref, '.result'), role: 'auditor', state: 'succeeded', outcome: 'ok', cost: null,
  receipt: { ref: r.ref, sha256: r.sha256, bytes: r.bytes, completeness: 'complete' } }));
// Build the same bytes as the bound Auditor recorder, without invoking retired apply.
function verified(root, { id = 'T1', rid = 'role-a', eol = '\n', bom = false, others = [], verdict = 'PASS', resultVerdict = verdict } = {}) {
  const p = put(root, TODO, (bom ? '\uFEFF' : '') + [L(id), ...others].join(eol) + eol);
  const r = result(root, { id: rid, task: id, line: L(id), verdict: resultVerdict });
  if (rid.startsWith('job-')) settle(root, r);
  const built = buildAuditorRecording(fs.readFileSync(p), { taskId: id, verdict, date: '2026-11-03', ref: `${verdict}; verdict=${rid}; sha256=${r.sha256}` });
  assert.equal(built.ok, true, built.reasons.join('; '));
  fs.writeFileSync(p, built.candidate);
  return { p, r };
}
const one = (root, opts = {}) => checkMarkers({ root, todos: [path.join(root, TODO)], ...opts });
const status = (out, i = 0) => out.findings[i]?.status;

test('C03: a checked verified FAIL with matching settled FAIL is invalid', () => project(root => {
  const { p } = verified(root, { verdict: 'FAIL', rid: 'job-fail' });
  assert.equal(status(one(root)), 'reviewed'); // valid settled FAIL control
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('[ ]', '[x]').replace('Auditor-reviewed', 'Auditor-verified'));
  const out = one(root);
  assert.equal(status(out), 'invalid');
  assert.equal(out.exit, 1);
}));

test('C04: a valid settled PASS with an impossible calendar date is invalid', () => project(root => {
  const { p } = verified(root, { rid: 'job-date' });
  assert.equal(status(one(root)), 'valid');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('2026-11-03', '2026-02-30'));
  const out = one(root);
  assert.equal(status(out), 'invalid');
  assert.equal(out.exit, 1);
}));

test('duplicate unchecked task ids make the whole file ineligible', () => project(root => {
  put(root, TODO, L('T1') + '\n' + L('T1') + '\n');
  const out = one(root);
  assert.equal(status(out), 'ineligible'); assert.equal(out.exit, 1);
}));

test('a FAIL recording on an unchecked task is reviewed', () => project(root => {
  const r = result(root, { id: 'role-fail', task: 'T1', line: L('T1'), verdict: 'FAIL' });
  put(root, TODO, L('T1') + ` — Auditor-reviewed 2026-11-03 (FAIL; verdict=role-fail; sha256=${r.sha256})\n`);
  const out = one(root);
  assert.equal(status(out), 'reviewed'); assert.equal(out.exit, 0);
}));

test('FAIL records check verdict, current definition, recorded hash and result presence', () => project(root => {
  let { p, r } = verified(root, { verdict: 'FAIL', resultVerdict: 'PASS', rid: 'role-pass' });
  assert.equal(status(one(root)), 'invalid');
  ({ p, r } = verified(root, { verdict: 'FAIL', rid: 'role-stale' }));
  assert.equal(status(one(root)), 'reviewed');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('Success: x', 'Success: changed'));
  assert.equal(status(one(root)), 'stale-task');
  ({ p, r } = verified(root, { verdict: 'FAIL', rid: 'role-hash' }));
  fs.writeFileSync(r.ref, 'changed'); assert.equal(status(one(root)), 'hash-mismatch');
  ({ p, r } = verified(root, { verdict: 'FAIL', rid: 'role-missing' }));
  fs.unlinkSync(r.ref); assert.equal(status(one(root)), 'missing-file');
}));

test('a PASS recording is valid and exits 0 (LF, CRLF, BOM)', () => {
  for (const o of [{}, { eol: '\r\n' }, { eol: '\r\n', bom: true }]) project(root => {
    verified(root, o);
    const out = one(root);
    assert.deepEqual(out.counts, { valid: 1 });
    assert.equal(out.exit, 0);
  });
});

test('a historical [x] without a suffix is legacy: exit 0 normally, exit 1 under --strict', () => project(root => {
  put(root, TODO, L('T1').replace('[ ]', '[x]') + '\n' + L('T2') + '\n');
  const out = one(root);
  assert.equal(status(out), 'legacy'); assert.equal(out.exit, 0); assert.deepEqual(out.counts, { legacy: 1 });
  assert.equal(one(root, { strict: true }).exit, 1);
}));

test('unchecked [ ] and [-] tasks are not findings', () => project(root => {
  put(root, TODO, L('T1') + '\n' + L('T2').replace('[ ]', '[-]') + '\n');
  const out = one(root);
  assert.deepEqual(out.findings, []); assert.equal(out.exit, 0);
}));

test('missing result file', () => project(root => {
  const { r } = verified(root); fs.unlinkSync(r.ref);
  const out = one(root); assert.equal(status(out), 'missing-file'); assert.equal(out.exit, 1);
}));

test('result file edited after verification: hash-mismatch', () => project(root => {
  const { r } = verified(root);
  fs.writeFileSync(r.ref, fs.readFileSync(r.ref, 'utf8').replace('Report.', 'Edited.'));
  const out = one(root); assert.equal(status(out), 'hash-mismatch'); assert.equal(out.exit, 1);
}));

test('task edited after verification: stale-task', () => project(root => {
  const { p } = verified(root);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('Success: x', 'Success: y'));
  const out = one(root); assert.equal(status(out), 'stale-task'); assert.equal(out.exit, 1);
}));

test('a marker-only change keeps a verified line valid; hand-flipping an unverified line is legacy not valid', () => project(root => {
  verified(root);
  assert.equal(status(one(root)), 'valid');
  put(root, TODO, L('T1').replace('[ ]', '[x]') + '\n');
  assert.equal(status(one(root)), 'legacy');
}));

test('suffix pointing at a forged-role, FAIL, partial or wrong-task result is invalid', () => project(root => {
  const cases = [
    { id: 'role-c', role: 'coder' }, { id: 'role-f', verdict: 'FAIL' },
    { id: 'role-p', completeness: 'partial' }, { id: 'role-w', task: 'T9' },
    { id: 'role-y', todo: 'Artifacts/Plans/Y-TODO.md' }, { id: 'role-h', hash: 'e'.repeat(64) },
  ];
  for (const c of cases) {
    const r = result(root, { task: 'T1', line: L('T1'), ...c });
    const sha = createHash('sha256').update(fs.readFileSync(r.ref)).digest('hex');
    put(root, TODO, L('T1').replace('[ ]', '[x]') + ` — Auditor-verified 2026-11-03 (PASS; verdict=${c.id}; sha256=${sha})\n`);
    const out = one(root);
    assert.ok(['invalid', 'stale-task'].includes(status(out)), `${c.id}: ${status(out)}`);
    assert.equal(out.exit, 1, c.id);
  }
}));

test('a background job result without its settlement is invalid; with it, valid', () => project(root => {
  const { r } = verified(root, { rid: 'job-1' });
  assert.equal(status(one(root)), 'valid');
  fs.unlinkSync(path.join(root, RES, 'job-1.settlement.json'));
  const out = one(root); assert.equal(status(out), 'invalid'); assert.match(out.findings[0].reason, /settlement/);
  settle(root, r);
  assert.equal(status(one(root)), 'valid');
}));

test('malformed suffixes, a [x] with only a review suffix, and a non-[x] claiming verification are invalid', () => project(root => {
  const good = ' — Auditor-verified 2026-11-03 (PASS; verdict=role-a; sha256=' + 'a'.repeat(64) + ')';
  for (const text of [
    L('T1').replace('[ ]', '[x]') + ' — Auditor-verified 2026-11-03 (PASS; verdict=role-a)',
    L('T1').replace('[ ]', '[x]') + ' — Auditor-verified 2026-11-03 (PASS; verdict=../x; sha256=' + 'a'.repeat(64) + ')',
    L('T1').replace('[ ]', '[x]') + ' — Auditor-reviewed 2026-11-03 (FAIL; verdict=role-a; sha256=' + 'a'.repeat(64) + ')',
    L('T1').replace('[ ]', '[x]') + good + ' trailing',
    L('T1') + good,
    L('T1').replace('[ ]', '[-]') + good,
    L('T1').replace('[ ]', '[-]') + ' — Auditor-reviewed 2026-11-03 (FAIL; verdict=role-a; sha256=' + 'a'.repeat(64) + ')',
  ]) {
    put(root, TODO, text + '\n');
    const out = one(root);
    assert.equal(status(out), text.endsWith(' trailing') ? 'ineligible' : 'invalid', text); assert.equal(out.exit, 1);
  }
}));

test('duplicate task ids with a [x] are flagged', () => project(root => {
  const { p } = verified(root);
  fs.appendFileSync(p, L('T1') + '\n');
  const out = one(root);
  assert.equal(status(out), 'ineligible'); assert.equal(out.exit, 1);
}));

test('fenced and indented task lookalikes make the file ineligible', () => project(root => {
  for (const text of [['```', L('T1'), '```', L('T2')].join('\n'), '  ' + L('T1')]) {
    put(root, TODO, text + '\n'); assert.equal(status(one(root)), 'ineligible'); assert.equal(one(root).exit, 1);
  }
}));

test('several TODOs aggregate counts and the worst exit', () => project(root => {
  verified(root);
  const q = put(root, 'Artifacts/Plans/Q-TODO.md', L('T5').replace('[ ]', '[x]') + '\n');
  const out = checkMarkers({ root, todos: [path.join(root, TODO), q] });
  assert.deepEqual(out.counts, { valid: 1, legacy: 1 }); assert.equal(out.exit, 0);
  const bad = put(root, 'Artifacts/Plans/B-TODO.md', L('T6').replace('[ ]', '[x]') + ' — Auditor-verified 2026-11-03 (PASS; verdict=role-none; sha256=' + 'a'.repeat(64) + ')\n');
  const out2 = checkMarkers({ root, todos: [path.join(root, TODO), q, bad] });
  assert.equal(out2.counts['missing-file'], 1); assert.equal(out2.exit, 1);
}));

test('an unreadable todo or one outside the project is an error, not a clean result', () => project(root => {
  assert.throws(() => checkMarkers({ root, todos: [path.join(root, 'Artifacts', 'Plans', 'nope.md')] }));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-out-'));
  try { const o = path.join(outside, 'X.md'); fs.writeFileSync(o, L('T1')); assert.throws(() => checkMarkers({ root, todos: [o] }), /outside|project/); }
  finally { fs.rmSync(outside, { recursive: true, force: true }); }
  assert.throws(() => checkMarkers({ root, todos: [] }));
}));

test('read-only: no file or directory changes, and the source has no write calls (with a presence control)', () => project(root => {
  verified(root); put(root, 'Artifacts/Plans/Q-TODO.md', L('T5').replace('[ ]', '[x]') + '\n');
  const snap = () => fs.readdirSync(root, { recursive: true }).sort().map(f => {
    const p = path.join(root, f); const s = fs.statSync(p);
    return `${f}:${s.isFile() ? createHash('sha256').update(fs.readFileSync(p)).digest('hex') : 'd'}:${s.mtimeMs}`;
  }).join('\n');
  const before = snap();
  checkMarkers({ root, todos: [path.join(root, TODO), path.join(root, 'Artifacts/Plans/Q-TODO.md')], strict: true });
  assert.equal(snap(), before);
  const WRITE = /\b(writeFile|writeFileSync|appendFile|appendFileSync|rename|renameSync|unlink|unlinkSync|rm|rmSync|mkdir|mkdirSync|copyFile|copyFileSync|truncate|createWriteStream|chmod|symlink|link|linkSync)\b/;
  assert.ok(WRITE.test('fs.writeFileSync(x)'), 'presence control');
  const source = fs.readFileSync(SCRIPT, 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!WRITE.test(source), 'check-markers must not call a write API');
}));

test('CLI: exit 0 clean, 1 findings, 2 usage or unreadable; prints one line per finding', () => project(root => {
  verified(root);
  const cli = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { cwd: root, encoding: 'utf8' });
  const p = path.join(root, TODO);
  const ok = cli(p, '--root', root);
  assert.equal(ok.status, 0, ok.stderr); assert.match(ok.stdout, /valid/);
  put(root, TODO, L('T1').replace('[ ]', '[x]') + '\n');
  assert.equal(cli(p, '--root', root).status, 0);
  const strict = cli(p, '--root', root, '--strict');
  assert.equal(strict.status, 1); assert.match(strict.stdout, /legacy/);
  assert.equal(cli().status, 2);
  assert.equal(cli(p, '--bogus').status, 2);
  assert.equal(cli(path.join(root, 'missing.md'), '--root', root).status, 2);
}));

// ---- T5 mutation-pass additions (survivors turned into tests)
test('T5: ~~~ fences, blockquoted lookalikes and unchecked duplicate ids are ineligible', () => project(root => {
  put(root, TODO, ['~~~', L('T1').replace('[ ]', '[x]'), '~~~', '> ' + L('T2').replace('[ ]', '[x]'), L('T3'), L('T3')].join('\n') + '\n');
  assert.equal(status(one(root)), 'ineligible');
}));

test('uppercase [X] is ineligible under the shared task grammar', () => project(root => {
  put(root, TODO, L('T1').replace('[ ]', '[X]') + '\n' + L('T2').replace('[ ]', '[x]') + '\n');
  assert.equal(status(one(root)), 'ineligible');
}));

test('T5: a suffix that says FAIL is malformed even when the stored result says PASS; an 81-character id is invalid', () => project(root => {
  verified(root);
  const p = path.join(root, TODO);
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('(PASS;', '(FAIL;'));
  assert.equal(status(one(root)), 'invalid');
  put(root, TODO, L('T1').replace('[ ]', '[x]') + ` — Auditor-verified 2026-11-03 (PASS; verdict=${'r'.repeat(81)}; sha256=${'a'.repeat(64)})\n`);
  const out = one(root);
  assert.equal(status(out), 'invalid'); assert.match(out.findings[0].reason, /malformed/);
}));

test('T5: a result path that is a directory is invalid with the regular-file reason, not a crash', () => project(root => {
  fs.mkdirSync(path.join(root, RES, 'role-d.result'));
  put(root, TODO, L('T1').replace('[ ]', '[x]') + ` — Auditor-verified 2026-11-03 (PASS; verdict=role-d; sha256=${'a'.repeat(64)})\n`);
  const out = one(root);
  assert.equal(status(out), 'invalid'); assert.match(out.findings[0].reason, /regular file/);
}));

test('T5: the top-level TODO and a directory are refused with specific reasons', () => project(root => {
  const top = put(root, 'Artifacts/TODO.md', L('T1') + '\n');
  assert.throws(() => checkMarkers({ root, todos: [top] }), /not eligible/);
  const dir = path.join(root, 'Artifacts', 'Plans', 'D-TODO.md'); fs.mkdirSync(dir);
  assert.throws(() => checkMarkers({ root, todos: [dir] }), /not a regular file/);
  assert.throws(() => checkMarkers({ root, todos: 'x' }), /at least one/);
}));

test('T5: the evidence kind is carried as the reason of a valid finding', () => project(root => {
  verified(root);
  assert.equal(one(root).findings[0].reason, 'uncorroborated');
  fs.rmSync(path.join(root, TODO));
  verified(root, { rid: 'job-1' });
  assert.equal(one(root).findings[0].reason, 'settlement');
}));
