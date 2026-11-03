import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

const digest = (data) => createHash('sha256').update(data).digest('hex');
async function api() {
  const file = new URL('../pi/lib/audit-evidence.mjs', import.meta.url);
  assert.ok(fs.existsSync(file), 'audit evidence validator must exist');
  return import(file.href);
}
function fixture(t) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'pi-audit-')));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'Artifacts', 'Evidence');
  fs.mkdirSync(dir, { recursive: true });
  const capture = path.join(dir, 'capture.txt');
  const manifest = path.join(dir, 'manifest.json');
  fs.writeFileSync(capture, 'capture data');
  const entry = { path: path.relative(root, capture), sha256: digest(fs.readFileSync(capture)) };
  function write(value = { version: 1, captures: [entry] }) {
    const bytes = typeof value === 'string' ? value : JSON.stringify(value);
    fs.writeFileSync(manifest, bytes);
    return digest(bytes);
  }
  return { root, dir, capture, manifest, entry, write };
}

test('valid manifest and captures yield a deeply frozen canonical snapshot and unchanged recheck', async (t) => {
  const { validateAuditManifest, recheckAuditManifest } = await api();
  const f = fixture(t);
  const sha = f.write({ version: 1, captures: [f.entry], extra: true });
  const snapshot = validateAuditManifest(f.root, f.manifest, sha);
  assert.deepEqual(snapshot, { manifestPath: fs.realpathSync.native(f.manifest), manifestSha256: sha,
    captures: [{ path: fs.realpathSync.native(f.capture), sha256: f.entry.sha256 }] });
  assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.captures) && Object.isFrozen(snapshot.captures[0]));
  assert.doesNotThrow(() => recheckAuditManifest(snapshot));
});

test('rejects malformed digests, invalid absolute paths and manifest content', async (t) => {
  const { validateAuditManifest: validate } = await api();
  const f = fixture(t); const sha = f.write();
  for (const bad of ['a'.repeat(63), 'A'.repeat(64), '0'.repeat(64), undefined]) {
    assert.throws(() => validate(f.root, f.manifest, bad), /sha|digest/i);
  }
  assert.throws(() => validate('.', f.manifest, sha), /absolute/i);
  assert.throws(() => validate(f.root, 'relative', sha), /absolute/i);
  assert.throws(() => validate(f.root, f.manifest, f.write('{broken')), /json/i);
  for (const value of [{ version: 2, captures: [f.entry] }, { version: 1, captures: [] },
    { version: 1, captures: Array(65).fill(f.entry) }]) {
    assert.throws(() => validate(f.root, f.manifest, f.write(value)), /version|captures/i);
  }
});

test('rejects outside, duplicate, invalid, mismatched or missing capture paths', async (t) => {
  const { validateAuditManifest: validate } = await api(); const f = fixture(t);
  const outside = path.join(f.root, 'x'); fs.writeFileSync(outside, 'outside');
  const evil = path.join(f.root, 'Artifacts-evil'); fs.mkdirSync(evil);
  const sibling = path.join(evil, 'x'); fs.writeFileSync(sibling, 'outside');
  for (const name of ['../x', outside, sibling]) {
    assert.throws(() => validate(f.root, f.manifest, f.write({ version: 1, captures: [{ path: name, sha256: digest('outside') }] })), /artifacts|outside/i);
  }
  assert.throws(() => validate(f.root, f.manifest, f.write({ version: 1, captures: [f.entry, { ...f.entry, path: f.capture }] })), /duplicate/i);
  for (const entry of [{ ...f.entry, sha256: '0'.repeat(64) }, { ...f.entry, sha256: 'A'.repeat(64) },
    { ...f.entry, path: path.join(f.dir, 'missing') }]) {
    assert.throws(() => validate(f.root, f.manifest, f.write({ version: 1, captures: [entry] })), /sha|digest|missing|enoent|file/i);
  }
  assert.throws(() => validate(f.root, outside, digest('outside')), /artifacts|outside/i);
});

test('rejects empty and oversized files and hard links', async (t) => {
  const { validateAuditManifest: validate } = await api(); const f = fixture(t);
  fs.writeFileSync(f.capture, '');
  assert.throws(() => validate(f.root, f.manifest, f.write()), /empty|size/i);
  fs.writeFileSync(f.capture, Buffer.alloc(4 * 1024 * 1024 + 1, 1));
  assert.throws(() => validate(f.root, f.manifest, f.write()), /size|limit/i);
  fs.writeFileSync(f.capture, 'capture data');
  const hard = path.join(f.dir, 'hard.txt'); fs.linkSync(f.capture, hard);
  assert.throws(() => validate(f.root, f.manifest, f.write()), /link|regular/i);
  fs.unlinkSync(hard);
  const tooBig = JSON.stringify({ version: 1, captures: [f.entry], extra: 'x'.repeat(64 * 1024) });
  assert.throws(() => validate(f.root, f.manifest, f.write(tooBig)), /size|limit/i);
  fs.writeFileSync(f.manifest, '');
  assert.throws(() => validate(f.root, f.manifest, digest('')), /empty|size/i);
});

test('out-of-tree paths are rejected lexically before any filesystem access (nonexistent and UNC-shaped)', async (t) => {
  const { validateAuditManifest: validate } = await api(); const f = fixture(t);
  const sha = f.write();
  const lexical = /must be inside project Artifacts/;
  const missingOutside = path.join(f.root, 'not-artifacts', 'missing.json');
  const unc = process.platform === 'win32' ? '\\\\pi-audit-no-such-host\\share\\m.json' : '//pi-audit-no-such-host/share/m.json';
  for (const manifest of [missingOutside, unc]) assert.throws(() => validate(f.root, manifest, sha), lexical);
  const escaping = f.write({ version: 1, captures: [{ path: '../../missing-outside.txt', sha256: 'a'.repeat(64) }] });
  assert.throws(() => validate(f.root, f.manifest, escaping), lexical);
  const sibling = f.write({ version: 1, captures: [{ path: path.join(f.root, 'Artifacts-evil', 'x.txt'), sha256: 'a'.repeat(64) }] });
  assert.throws(() => validate(f.root, f.manifest, sibling), lexical);
});

test('a differently-cased manifest path is accepted on Windows and canonicalised to the on-disk spelling', async (t) => {
  if (process.platform !== 'win32') return t.skip('case-insensitive paths are a Windows behaviour');
  const { validateAuditManifest: validate } = await api(); const f = fixture(t);
  const sha = f.write();
  const snapshot = validate(f.root, f.manifest.toUpperCase(), sha);
  assert.equal(snapshot.manifestPath, fs.realpathSync.native(f.manifest));
});

test('rejects symlink capture and manifest', async (t) => {
  const { validateAuditManifest: validate } = await api(); const f = fixture(t);
  const link = path.join(f.dir, 'link');
  try { fs.symlinkSync(f.capture, link, 'file'); }
  catch (error) {
    // Windows needs a privilege to create file symlinks. Skip visibly (never silently); the hard-link and
    // junction tests below still cover the link-rejection paths on such machines.
    if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) return t.skip(`file symlinks cannot be created here (${error.code})`);
    throw error;
  }
  assert.throws(() => validate(f.root, f.manifest, f.write({ version: 1, captures: [{ ...f.entry, path: link }] })), /link|regular/i);
  fs.unlinkSync(link);
  const sha = f.write(); fs.symlinkSync(f.manifest, link, 'file');
  assert.throws(() => validate(f.root, link, sha), /link|regular/i);
});

test('rejects a junction resolving outside Artifacts and a non-real project root', async (t) => {
  const { validateAuditManifest: validate } = await api(); const f = fixture(t);
  const external = path.join(f.root, 'external'); fs.mkdirSync(external);
  fs.writeFileSync(path.join(external, 'capture'), 'external');
  const junction = path.join(f.dir, 'outside'); fs.symlinkSync(external, junction, 'junction');
  const entry = { path: path.join(junction, 'capture'), sha256: digest('external') };
  assert.throws(() => validate(f.root, f.manifest, f.write({ version: 1, captures: [entry] })), /outside|artifacts/i);
  const alias = path.join(f.root, 'root-alias'); fs.symlinkSync(f.root, alias, 'junction');
  assert.throws(() => validate(alias, f.manifest, f.write()), /root|real/i);
  fs.unlinkSync(alias); fs.unlinkSync(junction);
});

test('recheck rejects a replaced parent junction even with identical capture bytes', async (t) => {
  const { validateAuditManifest: validate, recheckAuditManifest: recheck } = await api(); const f = fixture(t);
  const parent = path.join(f.dir, 'sub'); fs.mkdirSync(parent);
  const capture = path.join(parent, 'capture'); fs.writeFileSync(capture, 'identical');
  const snapshot = validate(f.root, f.manifest, f.write({ version: 1, captures: [{ path: capture, sha256: digest('identical') }] }));
  const other = path.join(f.root, 'other'); fs.mkdirSync(other); fs.writeFileSync(path.join(other, 'capture'), 'identical');
  fs.renameSync(parent, path.join(f.dir, 'old-sub'));
  fs.symlinkSync(other, parent, 'junction');
  assert.throws(() => recheck(snapshot), /link|changed/i);
  fs.unlinkSync(parent);
});

test('recheck detects edits, deletion, same-size replacement and manifest changes', async (t) => {
  const { validateAuditManifest: validate, recheckAuditManifest: recheck } = await api();
  for (const mutation of ['edit', 'delete', 'replace', 'manifest']) {
    const f = fixture(t); const snapshot = validate(f.root, f.manifest, f.write());
    assert.doesNotThrow(() => recheck(snapshot));
    if (mutation === 'edit') fs.writeFileSync(f.capture, 'changed');
    if (mutation === 'delete') fs.unlinkSync(f.capture);
    if (mutation === 'replace') { fs.unlinkSync(f.capture); fs.writeFileSync(f.capture, 'CAPTURE DATA'); }
    if (mutation === 'manifest') fs.appendFileSync(f.manifest, ' ');
    assert.throws(() => recheck(snapshot), /sha|digest|missing|enoent|file|size/i, mutation);
  }
});

// ---- PI-8 T4: manifest carries the verdict identity
test('manifest verdict identity is validated and carried in the frozen snapshot', async (t) => {
  const { validateAuditManifest } = await api();
  const f = fixture(t);
  const verdict = { task: 'T4', todo: 'Artifacts/Plans/X-TODO.md', taskSha256: 'c'.repeat(64) };
  const sha = f.write({ version: 1, captures: [f.entry], verdict });
  const snapshot = validateAuditManifest(f.root, f.manifest, sha);
  assert.deepEqual(snapshot.verdict, verdict);
  assert.ok(Object.isFrozen(snapshot.verdict));
  const plain = validateAuditManifest(f.root, f.manifest, f.write());
  assert.ok(!('verdict' in plain), 'no verdict key when the manifest has none');
});

test('malformed manifest verdict identities are rejected', async (t) => {
  const { validateAuditManifest } = await api();
  const f = fixture(t);
  const ok = { task: 'T4', todo: 'Artifacts/Plans/X-TODO.md', taskSha256: 'c'.repeat(64) };
  for (const bad of [
    null, 'T4', [], {}, { ...ok, task: '' }, { ...ok, task: 'has space' }, { ...ok, todo: '' }, { ...ok, todo: 'a b' },
    { ...ok, taskSha256: 'C'.repeat(64) }, { ...ok, taskSha256: 'c'.repeat(63) }, { ...ok, extra: 1 },
    { task: 'T4', todo: ok.todo }, { ...ok, task: 4 },
  ]) {
    const sha = f.write({ version: 1, captures: [f.entry], verdict: bad });
    assert.throws(() => validateAuditManifest(f.root, f.manifest, sha), /verdict/i, JSON.stringify(bad));
  }
});
