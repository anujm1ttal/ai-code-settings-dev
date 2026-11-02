import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, linkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const load = () => import('../pi/lib/bulk-admission.mjs');
const hash = b => createHash('sha256').update(b).digest('hex');
const now = new Date('2026-11-02T12:00:00.000Z');
const policy = { allowedModels: ['pilot/model'], roles: { explorer: { model: 'pilot/model' } } };
function fixture(t, bytes = Buffer.from('one\r\ntwo\r\nlast')) {
  const root = mkdtempSync(path.join(tmpdir(), 'pi-admit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(path.join(root, 'a.txt'), bytes);
  const approval = { version: 1, approvalId: 'id', approvedAt: '2026-11-02T11:00:00.000Z', expiresAt: '2026-11-02T13:00:00.000Z', worker: 'pilot/model', rates: { inputPerMTok: 1, outputPerMTok: 2 }, maxOutputTokens: 256, maxCostUsd: 0.5, maxTotalUsd: 2, systemPromptSha256: hash('prompt'), approvedPaths: ['a.txt'], approvedSha256: { 'a.txt': hash(bytes) } };
  return { root, approval, policy, now, paths: ['a.txt'] };
}
async function admitted(args) { return (await load()).validateAdmission(args); }
function refuses(result) { assert.equal(result.ok, false); assert.equal(typeof result.reason, 'string'); assert.ok(result.reason.length); }

test('valid bytes, CRLF counts, and exact hash are returned', async t => {
  const f = fixture(t); const result = await admitted(f);
  assert.equal(result.ok, true); assert.equal(result.files[0].lineCount, 3);
  assert.equal(result.files[0].sha256, f.approval.approvedSha256['a.txt']);
  assert.deepEqual(result.files[0].bytes, Buffer.from('one\r\ntwo\r\nlast'));
});
test('approval validates schema, limits, timestamps and worker fail-closed', async t => {
  const f = fixture(t); const { validateApprovalRecord } = await load();
  assert.equal(validateApprovalRecord(f.approval, f).ok, true);
  const mutations = [
    { extra: true }, { approvedAt: '2026-11-02T12:00:00.001Z' },
    { expiresAt: '2026-11-03T12:00:00.000Z' }, { expiresAt: f.approval.approvedAt },
    { worker: 'wrong' }, { rates: { inputPerMTok: 1, outputPerMTok: 1, extra: 1 } },
    { maxOutputTokens: 8193 }, { maxCostUsd: 0.51 }, { maxTotalUsd: 2.01 },
    { approvedSha256: { 'other': hash('x') } }, { approvedPaths: ['a.txt', 'a.txt'] },
    { approvedAt: '2026-11-02T11:00:00+00:00' }, { systemPromptSha256: 'x' },
  ];
  for (const m of mutations) refuses(validateApprovalRecord({ ...f.approval, ...m }, f));
  refuses(validateApprovalRecord(f.approval, { ...f, policy: { ...policy, allowedModels: [] } }));
  refuses(validateApprovalRecord(null, f)); refuses(validateApprovalRecord(f.approval, {}));
});
test('path set, mutations, size, invalid UTF-8, and malformed inputs refuse', async t => {
  const f = fixture(t);
  refuses(await admitted({ ...f, paths: ['other'] }));
  refuses(await admitted({ ...f, paths: ['a.txt', 'a.txt'] }));
  writeFileSync(path.join(f.root, 'a.txt'), 'changed'); refuses(await admitted(f));
  const big = Buffer.alloc(400 * 1024 + 1); writeFileSync(path.join(f.root, 'a.txt'), big); f.approval.approvedSha256['a.txt'] = hash(big); refuses(await admitted(f));
  const bad = Buffer.from([0xc3, 0x28]); writeFileSync(path.join(f.root, 'a.txt'), bad); f.approval.approvedSha256['a.txt'] = hash(bad); refuses(await admitted(f));
  refuses(await admitted({ ...f, root: null })); refuses(await admitted({ ...f, paths: null }));
});
test('denylist and path normalization are case insensitive and segment based', async t => {
  const f = fixture(t);
  for (const p of ['nested/.ENV.local', 'nested/SecretS-old/x', 'sub/CREDENTIALS-prod', 'a/ID_RSA.bak', 'a/.NPMRC', 'a/x.PEM', 'a/x.KEY', 'a/x.PFX', 'a/x.P12', 'a/x.TOKEN', 'ARTIFACTS/.AGENT/x', '../a.txt', '/absolute', 'a/../a.txt', 'a\\b']) {
    const approval = { ...f.approval, approvedPaths: [p], approvedSha256: { [p]: hash('x') } };
    const result = await admitted({ ...f, approval, paths: [p] });
    refuses(result);
    assert.equal(result.reason, p.includes('..') || p.startsWith('/') || p.includes('\\') ? 'invalid-path' : 'denied-path');
  }
});
test('Windows path aliases with trailing dots or spaces are refused', async t => {
  const f = fixture(t);
  for (const p of ['Artifacts./.agent/x', 'Artifacts /file', 'folder /x']) {
    const approval = { ...f.approval, approvedPaths: [p], approvedSha256: { [p]: hash('x') } };
    assert.equal((await admitted({ ...f, approval, paths: [p] })).reason, 'invalid-path');
  }
});
test('symlinks, symlink directories, and hardlinks refuse', async t => {
  const f = fixture(t); mkdirSync(path.join(f.root, 'dir'));
  let symlink = true, hardlink = true;
  try { symlinkSync('a.txt', path.join(f.root, 'sym')); symlinkSync('dir', path.join(f.root, 'symdir'), 'dir'); } catch (e) { symlink = false; t.diagnostic(`SKIP symlink fixture: ${e.code}`); }
  if (symlink) for (const p of ['sym', 'symdir/a.txt']) {
    const approval = { ...f.approval, approvedPaths: [p], approvedSha256: { [p]: f.approval.approvedSha256['a.txt'] } };
    refuses(await admitted({ ...f, approval, paths: [p] }));
  }
  try { linkSync(path.join(f.root, 'a.txt'), path.join(f.root, 'hard')); } catch (e) { hardlink = false; t.diagnostic(`SKIP hardlink fixture: ${e.code}`); }
  if (hardlink) assert.equal((await admitted(f)).reason, 'file-identity');
  try {
    symlinkSync(path.join(f.root, 'dir'), path.join(f.root, 'junction'), 'junction');
    const p = 'junction/a.txt'; const approval = { ...f.approval, approvedPaths: [p], approvedSha256: { [p]: hash('x') } };
    assert.equal((await admitted({ ...f, approval, paths: [p] })).reason, 'symlink-path');
  } catch (e) { if (e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'ENOTSUP') t.diagnostic(`SKIP junction fixture: ${e.code}`); else throw e; }
});
test('UTF-8 BOM alone is one unterminated line', async t => {
  const f = fixture(t, Buffer.from([0xef, 0xbb, 0xbf]));
  const result = await admitted(f); assert.equal(result.ok, true); assert.equal(result.files[0].lineCount, 1);
});
test('path order may differ, aggregate cap is enforced, and final newline counts once', async t => {
  const f = fixture(t, Buffer.from('one\r\n')); writeFileSync(path.join(f.root, 'b.txt'), 'two');
  f.approval.approvedPaths = ['a.txt', 'b.txt']; f.approval.approvedSha256['b.txt'] = hash('two'); f.paths = ['b.txt', 'a.txt'];
  const result = await admitted(f); assert.equal(result.ok, true); assert.equal(result.files[1].lineCount, 1);
  const big = Buffer.alloc(350 * 1024, 65); writeFileSync(path.join(f.root, 'a.txt'), big); writeFileSync(path.join(f.root, 'b.txt'), big);
  f.approval.approvedSha256 = { 'a.txt': hash(big), 'b.txt': hash(big) };
  assert.equal((await admitted(f)).reason, 'total-size');
});
test('Artifacts admission in git repos requires git check-ignore confirmation', async t => {
  const f = fixture(t); execFileSync('git', ['init', '-q', f.root]);
  mkdirSync(path.join(f.root, 'Artifacts')); writeFileSync(path.join(f.root, 'Artifacts', 'safe.txt'), 'x');
  f.paths = ['Artifacts/safe.txt']; f.approval.approvedPaths = f.paths; f.approval.approvedSha256 = { [f.paths[0]]: hash('x') };
  refuses(await admitted(f));
  writeFileSync(path.join(f.root, '.gitignore'), 'Artifacts/\n');
  assert.equal((await admitted(f)).ok, true);
});
test('boundaries: exact caps pass and one over fails (file, total, count)', async t => {
  const KiB = 1024; const f = fixture(t); const files = {};
  const put = (name, bytes) => { writeFileSync(path.join(f.root, name), bytes); files[name] = hash(bytes); };
  const run = names => admitted({ ...f, paths: names, approval: { ...f.approval, approvedPaths: names, approvedSha256: Object.fromEntries(names.map(n => [n, files[n]])) } });
  put('exact.txt', Buffer.alloc(400 * KiB, 65)); assert.equal((await run(['exact.txt'])).ok, true);
  put('over.txt', Buffer.alloc(400 * KiB + 1, 65)); assert.equal((await run(['over.txt'])).reason, 'file-size');
  put('h1.txt', Buffer.alloc(300 * KiB, 66)); put('h2.txt', Buffer.alloc(300 * KiB, 67)); assert.equal((await run(['h1.txt', 'h2.txt'])).ok, true);
  put('one.txt', 'x'); assert.equal((await run(['h1.txt', 'h2.txt', 'one.txt'])).reason, 'total-size');
  const { validateApprovalRecord } = await load(); const many = n => Array.from({ length: n }, (_, i) => `d/f${i}.txt`);
  const rec = n => ({ ...f.approval, approvedPaths: many(n), approvedSha256: Object.fromEntries(many(n).map(p => [p, hash(p)])) });
  assert.equal(validateApprovalRecord(rec(40), f).ok, true); assert.equal(validateApprovalRecord(rec(41), f).reason, 'path-count');
});
test('boundaries: time, token and rate limits', async t => {
  const f = fixture(t); const { validateApprovalRecord } = await load();
  assert.equal(validateApprovalRecord({ ...f.approval, approvedAt: now.toISOString() }, f).ok, true);
  assert.equal(validateApprovalRecord({ ...f.approval, expiresAt: now.toISOString() }, f).reason, 'approval-time');
  assert.equal(validateApprovalRecord({ ...f.approval, maxOutputTokens: 255 }, f).reason, 'approval-limits');
  assert.equal(validateApprovalRecord({ ...f.approval, maxOutputTokens: 8192 }, f).ok, true);
  assert.equal(validateApprovalRecord({ ...f.approval, rates: { inputPerMTok: 0, outputPerMTok: 2 } }, f).reason, 'approval-rates');
  assert.equal(validateApprovalRecord({ ...f.approval, rates: { inputPerMTok: 1, outputPerMTok: 0 } }, f).reason, 'approval-rates');
});
test('path set must equal the approved set exactly and never throws', async t => {
  const f = fixture(t); writeFileSync(path.join(f.root, 'b.txt'), 'two');
  f.approval.approvedPaths = ['a.txt', 'b.txt']; f.approval.approvedSha256['b.txt'] = hash('two');
  assert.equal((await admitted({ ...f, paths: ['a.txt'] })).reason, 'path-mismatch');
  const one = { ...f.approval, approvedPaths: ['a.txt'], approvedSha256: { 'a.txt': f.approval.approvedSha256['a.txt'] } };
  assert.equal((await admitted({ ...f, approval: one, paths: ['b.txt'] })).reason, 'path-mismatch');
});
test('case alias of an existing file is refused on case-insensitive Windows', { skip: process.platform !== 'win32' && 'win32 only' }, async t => {
  const f = fixture(t); const p = 'A.TXT';
  const approval = { ...f.approval, approvedPaths: [p], approvedSha256: { [p]: f.approval.approvedSha256['a.txt'] } };
  const result = await admitted({ ...f, approval, paths: [p] }); refuses(result); assert.equal(result.reason, 'path-alias');
});
test('duplicate request paths cannot hide an unrequested approved file', async t => {
  const f = fixture(t); writeFileSync(path.join(f.root, 'b.txt'), 'two');
  f.approval.approvedPaths = ['a.txt', 'b.txt']; f.approval.approvedSha256['b.txt'] = hash('two');
  assert.equal((await admitted({ ...f, paths: ['a.txt', 'a.txt'] })).reason, 'duplicate-path');
});
test('worker must be the explorer model even when another model is allowlisted', async t => {
  const f = fixture(t); const wide = { allowedModels: ['pilot/model', 'other/model'], roles: { explorer: { model: 'pilot/model' } } };
  assert.equal((await admitted({ ...f, policy: wide, approval: { ...f.approval, worker: 'other/model' } })).reason, 'approval-worker');
});
test('Artifacts paths outside any git worktree are admitted; lone CR is not a line break', async t => {
  const f = fixture(t); mkdirSync(path.join(f.root, 'Artifacts')); writeFileSync(path.join(f.root, 'Artifacts', 'safe.txt'), 'x\ry');
  f.paths = ['Artifacts/safe.txt']; f.approval.approvedPaths = f.paths; f.approval.approvedSha256 = { [f.paths[0]]: hash('x\ry') };
  const result = await admitted(f); assert.equal(result.ok, true); assert.equal(result.files[0].lineCount, 1);
});
