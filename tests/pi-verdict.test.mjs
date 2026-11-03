import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalTaskHash, parseVerdictText, parseResultBytes, verifyVerdictFile } from '../pi/lib/verdict.mjs';
import { persistFullResult } from '../pi/lib/result-contract.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const TASK = '- [ ] [coder] T1: `pi/lib/verdict.mjs` — Success: RED first — Mode: AFK';
const H = sha(Buffer.from(TASK, 'utf8'));
const TODO = 'Artifacts/Plans/PI-8-TODO.md';
const line = (v = 'PASS', o = {}) =>
  `VERDICT: ${v} task=${o.task ?? 'T1'} todo=${o.todo ?? TODO} taskSha256=${o.hash ?? H}`;
const withDir = fn => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-verdict-'));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
const persist = (dir, { text = `Report.\n${line()}\n`, role = 'auditor', completeness = 'complete', id = 'role-aaa' } = {}) =>
  persistFullResult({ dir, dispatchId: id, role, completeness, text, meta: { role } });
const expected = { task: 'T1', todo: TODO, taskLine: TASK };

// ---- canonical task hash
test('hash is sha256 of the UTF-8 task line; stable across marker change and line endings', () => {
  assert.equal(canonicalTaskHash(TASK), H);
  assert.equal(canonicalTaskHash(TASK.replace('[ ]', '[x]')), H);
  assert.equal(canonicalTaskHash(TASK.replace('[ ]', '[-]')), H);
  assert.equal(canonicalTaskHash(TASK + '\r\n'), H);
  assert.equal(canonicalTaskHash(TASK + '\n'), H);
  assert.equal(canonicalTaskHash('\uFEFF' + TASK), H);
});
test('hash drops a prior review suffix but any other edit changes it', () => {
  const done = TASK.replace('[ ]', '[x]') + ' — Auditor-verified 2026-11-03 (PASS; verdict=role-aaa; sha256=' + 'a'.repeat(64) + ')';
  assert.equal(canonicalTaskHash(done), H);
  assert.equal(canonicalTaskHash(TASK.replace('T1', 'T2')), canonicalTaskHash(TASK.replace('T1', 'T2')));
  assert.notEqual(canonicalTaskHash(TASK.replace('RED first', 'RED second')), H);
  assert.notEqual(canonicalTaskHash(TASK + ' extra'), H);
  assert.notEqual(canonicalTaskHash(TASK.replace('Mode', 'Mode ')), H);
});
test('hash handles unicode and does not use code-unit shortcuts', () => {
  const u = '- [ ] [coder] T1: café 🚀 雪 — Mode: AFK';
  assert.equal(canonicalTaskHash(u), sha(Buffer.from(u, 'utf8')));
});
test('hash rejects a non-task line, an interior newline or a non-string', () => {
  assert.throws(() => canonicalTaskHash('not a task'));
  assert.throws(() => canonicalTaskHash(TASK + '\nsecond'));
  assert.throws(() => canonicalTaskHash(undefined));
  assert.throws(() => canonicalTaskHash(42));
});
test('only a trailing review suffix is removed, not one in the middle', () => {
  const mid = '- [ ] [coder] T1: a — Auditor-verified 2026-11-03 (PASS; x) — Mode: AFK';
  assert.notEqual(canonicalTaskHash(mid), canonicalTaskHash('- [ ] [coder] T1: a'));
});

// ---- verdict line grammar
test('a single valid verdict line parses for PASS, FAIL and INCOMPLETE', () => {
  for (const v of ['PASS', 'FAIL', 'INCOMPLETE']) {
    assert.deepEqual(parseVerdictText(`Findings...\n${line(v)}\n`), { verdict: v, task: 'T1', todo: TODO, taskSha256: H });
  }
});
test('trailing blank space or CRLF after the verdict is fine; trailing content is not', () => {
  assert.equal(parseVerdictText(`x\r\n${line()}\r\n`).verdict, 'PASS');
  assert.equal(parseVerdictText(`x\n${line()}\n\n  \n`).verdict, 'PASS');
  assert.throws(() => parseVerdictText(`${line()}\nMore text\n`));
  assert.throws(() => parseVerdictText(`${line()} trailing`));
});
test('missing, duplicate and quoted verdict lines are refused', () => {
  assert.throws(() => parseVerdictText('no verdict here\n'));
  assert.throws(() => parseVerdictText(`${line()}\n${line('FAIL')}\n`));
  assert.throws(() => parseVerdictText(`${line()}\n${line()}\n`));
  assert.throws(() => parseVerdictText(`The format is ${line()} ok\n${line()}\n`));
  assert.throws(() => parseVerdictText(`> ${line()}\n`));
  assert.throws(() => parseVerdictText(` ${line()}\n`));
});
test('malformed fields are refused', () => {
  for (const bad of [
    line('pass'), line('PASSED'), line('MAYBE'),
    line('PASS', { hash: 'A'.repeat(64) }), line('PASS', { hash: 'a'.repeat(63) }), line('PASS', { hash: 'a'.repeat(65) }),
    line('PASS', { task: '' }), line('PASS', { todo: '' }),
    'VERDICT: PASS task=T1 taskSha256=' + H, `VERDICT: PASS todo=${TODO} task=T1 taskSha256=${H}`,
    `VERDICT:  PASS task=T1 todo=${TODO} taskSha256=${H}`,
  ]) assert.throws(() => parseVerdictText(`x\n${bad}\n`), undefined, bad);
});
test('non-string text is refused', () => {
  assert.throws(() => parseVerdictText(undefined));
  assert.throws(() => parseVerdictText(Buffer.from('x')));
});

// ---- persisted result parsing
test('a complete auditor result parses with header, text and file hash', () => withDir(dir => {
  const r = persist(dir);
  const parsed = parseResultBytes(fs.readFileSync(r.ref));
  assert.equal(parsed.header.role, 'auditor');
  assert.equal(parsed.header.dispatchId, 'role-aaa');
  assert.equal(parsed.sha256, r.sha256);
  assert.equal(parseVerdictText(parsed.text).verdict, 'PASS');
}));
test('forged role, partial completeness and tampered headers are refused', () => withDir(dir => {
  const bytes = id => fs.readFileSync(path.join(dir, `${id}.result`));
  persist(dir, { role: 'coder', id: 'r-coder' });
  persist(dir, { completeness: 'partial', id: 'r-partial' });
  persist(dir, { id: 'r-ok' });
  assert.throws(() => parseResultBytes(bytes('r-coder')), /role/);
  assert.throws(() => parseResultBytes(bytes('r-partial')), /complete/);
  const ok = bytes('r-ok').toString('utf8');
  const tamper = s => Buffer.from(s, 'utf8');
  assert.throws(() => parseResultBytes(tamper(ok.replace('"version":1', '"version":2'))));
  assert.throws(() => parseResultBytes(tamper(ok.replace('"complete"', '"complete","extra":1'))));
  assert.throws(() => parseResultBytes(tamper(ok.replace('"dispatchId":"r-ok"', '"dispatchId":"../x"'))));
  assert.throws(() => parseResultBytes(tamper(ok.replace('"dispatchId":"r-ok"', '"dispatchId":"r-ok","dispatchId":"other"'))));
  assert.throws(() => parseResultBytes(tamper('not json\n' + 'text')));
  assert.throws(() => parseResultBytes(tamper('{"version":1}')));
  assert.throws(() => parseResultBytes(Buffer.alloc(0)));
  assert.throws(() => parseResultBytes('string'));
}));
test('invalid UTF-8 text is refused', () => {
  const head = Buffer.from('{"version":1,"dispatchId":"r1","role":"auditor","completeness":"complete"}\n');
  assert.throws(() => parseResultBytes(Buffer.concat([head, Buffer.from([0xff, 0xfe, 10])])));
});

// ---- end-to-end verification against the expected task
test('verifyVerdictFile accepts a matching PASS and labels a synchronous result uncorroborated', () => withDir(dir => {
  const r = persist(dir);
  const out = verifyVerdictFile({ ref: r.ref, expected });
  assert.equal(out.verdict, 'PASS');
  assert.equal(out.sha256, r.sha256);
  assert.equal(out.dispatchId, 'role-aaa');
  assert.equal(out.evidence, 'uncorroborated');
}));
test('wrong id, path or hash and stale task line are refused', () => withDir(dir => {
  const r = persist(dir);
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected: { ...expected, task: 'T2' } }), /task/);
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected: { ...expected, todo: 'Artifacts/Plans/Other.md' } }), /todo/);
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected: { ...expected, taskLine: TASK + ' edited' } }), /hash|stale/);
  const bad = persist(dir, { id: 'r-bad', text: `x\n${line('PASS', { hash: 'b'.repeat(64) })}\n` });
  assert.throws(() => verifyVerdictFile({ ref: bad.ref, expected }), /hash|stale/);
}));
test('verification of the same task line with a changed marker still matches', () => withDir(dir => {
  const r = persist(dir);
  assert.equal(verifyVerdictFile({ ref: r.ref, expected: { ...expected, taskLine: TASK.replace('[ ]', '[-]') } }).verdict, 'PASS');
}));
test('FAIL and INCOMPLETE are returned as such, never as PASS', () => withDir(dir => {
  for (const v of ['FAIL', 'INCOMPLETE']) {
    const r = persist(dir, { id: `r-${v}`, text: `x\n${line(v)}\n` });
    assert.equal(verifyVerdictFile({ ref: r.ref, expected }).verdict, v);
  }
}));
test('file-level refusals: forged role, partial, missing file, symlink, name/header mismatch', () => withDir(dir => {
  const forged = persist(dir, { role: 'coder', id: 'r-forged' });
  assert.throws(() => verifyVerdictFile({ ref: forged.ref, expected }), /role/);
  const partial = persist(dir, { completeness: 'partial', id: 'r-part' });
  assert.throws(() => verifyVerdictFile({ ref: partial.ref, expected }), /complete/);
  assert.throws(() => verifyVerdictFile({ ref: path.join(dir, 'nope.result'), expected }));
  assert.throws(() => verifyVerdictFile({ ref: 'relative.result', expected }));
  const ok = persist(dir, { id: 'r-real' });
  const moved = path.join(dir, 'r-other.result');
  fs.copyFileSync(ok.ref, moved);
  assert.throws(() => verifyVerdictFile({ ref: moved, expected }), /name|dispatch/);
  const link = path.join(dir, 'r-link.result');
  try { fs.symlinkSync(ok.ref, link); } catch { return; }
  assert.throws(() => verifyVerdictFile({ ref: link, expected }), /regular|link/);
}));
test('a background job result needs a matching settlement', () => withDir(dir => {
  const r = persist(dir, { id: 'job-1' });
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement/);
  const sfile = path.join(dir, 'job-1.settlement.json');
  const settle = o => fs.writeFileSync(sfile, JSON.stringify({
    version: 1, dispatchId: 'job-1', role: 'auditor', state: 'succeeded', outcome: 'ok', cost: null,
    receipt: { ref: r.ref, sha256: r.sha256, bytes: r.bytes, completeness: 'complete' }, ...o }));
  settle({});
  const out = verifyVerdictFile({ ref: r.ref, expected });
  assert.equal(out.evidence, 'settlement');
  assert.equal(out.verdict, 'PASS');
  settle({ state: 'failed' });
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement/);
  settle({ role: 'coder' });
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement/);
  settle({ dispatchId: 'job-2' });
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement/);
  settle({ receipt: { ref: r.ref, sha256: 'c'.repeat(64), bytes: r.bytes, completeness: 'complete' } });
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement/);
  settle({ receipt: { ref: r.ref, sha256: r.sha256, bytes: r.bytes, completeness: 'partial' } });
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement/);
  fs.writeFileSync(sfile, 'not json');
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement/);
}));
test('a result edited after persistence no longer matches its settlement hash', () => withDir(dir => {
  const r = persist(dir, { id: 'job-3' });
  fs.writeFileSync(path.join(dir, 'job-3.settlement.json'), JSON.stringify({
    version: 1, dispatchId: 'job-3', role: 'auditor', state: 'succeeded', outcome: 'ok', cost: null,
    receipt: { ref: r.ref, sha256: r.sha256, bytes: r.bytes, completeness: 'complete' } }));
  fs.writeFileSync(r.ref, fs.readFileSync(r.ref, 'utf8').replace('Report.', 'Edited.'));
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement|hash/);
}));
test('the verifier never writes: directory listing is unchanged', () => withDir(dir => {
  const r = persist(dir);
  const before = fs.readdirSync(dir).join();
  verifyVerdictFile({ ref: r.ref, expected });
  assert.equal(fs.readdirSync(dir).join(), before);
}));

// ---- T5 mutation-pass additions (survivors turned into tests)
import { validateVerdictIdentity, checkExpectedVerdict, parseResultBytes as parseBytes2 } from '../pi/lib/verdict.mjs';

test('T5: an uppercase [X] marker hashes like the others; text before the dash is not a task line', () => {
  assert.equal(canonicalTaskHash(TASK.replace('[ ]', '[X]')), H);
  assert.throws(() => canonicalTaskHash('note ' + TASK), /not a task line/);
});
test('T5: only a trailing, well-formed review suffix is removed', () => {
  const mid = '- [ ] [coder] T1: a — Auditor-verified 2026-11-03 (PASS; x) — Mode: AFK';
  assert.equal(canonicalTaskHash(mid), sha(Buffer.from(mid, 'utf8')));
  const oddDate = TASK + ' — Auditor-verified 2026-1-3 (PASS; x)';
  assert.equal(canonicalTaskHash(oddDate), sha(Buffer.from(oddDate, 'utf8')));
  assert.notEqual(canonicalTaskHash(oddDate), H);
});
test('T5: validateVerdictIdentity bounds the task length and returns a copy', () => {
  const ok = { task: 'T4', todo: 'a/b.md', taskSha256: 'a'.repeat(64) };
  assert.throws(() => validateVerdictIdentity({ ...ok, task: 'a'.repeat(41) }), /task/);
  assert.doesNotThrow(() => validateVerdictIdentity({ ...ok, task: 'a'.repeat(40) }));
  const out = validateVerdictIdentity(ok);
  assert.deepEqual(out, ok); assert.notEqual(out, ok);
  assert.throws(() => validateVerdictIdentity({ ...ok, extra: 1 }));
});
test('T5: checkExpectedVerdict reports each mismatch with its own reason', () => {
  const exp = { task: 'T1', todo: TODO, taskSha256: H };
  assert.equal(checkExpectedVerdict(`x\n${line()}\n`, exp), undefined);
  assert.match(checkExpectedVerdict(`${line('PASS', { task: 'T2' })}\n`, exp), /task/);
  assert.match(checkExpectedVerdict(`${line('PASS', { todo: 'z.md' })}\n`, exp), /todo/);
  assert.match(checkExpectedVerdict(`${line('PASS', { hash: 'b'.repeat(64) })}\n`, exp), /taskSha256/);
  assert.match(checkExpectedVerdict('nothing', exp), /no VERDICT line/);
});
test('T5: dispatch ids "." and ".." are refused in a hand-built header', () => {
  for (const id of ['.', '..']) {
    const bytes = Buffer.from(`{"version":1,"dispatchId":"${id}","role":"auditor","completeness":"complete"}\nx`);
    assert.throws(() => parseBytes2(bytes), /dispatch/);
  }
});
test('T5: a directory or relative path is refused with a specific reason', () => withDir(dir => {
  const r = persist(dir);
  const asDir = path.join(dir, 'role-dir.result'); fs.mkdirSync(asDir);
  assert.throws(() => verifyVerdictFile({ ref: asDir, expected }), /regular file/);
  assert.throws(() => verifyVerdictFile({ ref: path.relative(process.cwd(), r.ref), expected }), /absolute/);
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected: undefined }), /expected/);
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected: { task: 'T1', todo: 5, taskLine: TASK } }), /expected/);
}));
test('T5: settlement shape errors are each refused with the settlement reason', () => withDir(dir => {
  const r = persist(dir, { id: 'job-s' });
  const file = path.join(dir, 'job-s.settlement.json');
  const good = { version: 1, dispatchId: 'job-s', role: 'auditor', state: 'succeeded', outcome: 'ok', cost: null,
    receipt: { ref: r.ref, sha256: r.sha256, bytes: r.bytes, completeness: 'complete' } };
  const put = o => fs.writeFileSync(file, JSON.stringify(o));
  put(good); assert.equal(verifyVerdictFile({ ref: r.ref, expected }).evidence, 'settlement');
  put({ ...good, version: 2 }); assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement missing or invalid/);
  const { receipt: _r, ...noReceipt } = good;
  put(noReceipt); assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement missing or invalid/);
  put({ ...good, receipt: { ...good.receipt, bytes: r.bytes + 1 } });
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement missing or invalid/);
  put(null); assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /settlement missing or invalid/);
  fs.rmSync(file); fs.mkdirSync(file);
  assert.throws(() => verifyVerdictFile({ ref: r.ref, expected }), /not a regular file/);
}));
