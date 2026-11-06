import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validateVerdictIdentity } from './verdict.mjs';

const MANIFEST_LIMIT = 64 * 1024;
const CAPTURE_LIMIT = 4 * 1024 * 1024;
const DIGEST = /^[a-f0-9]{64}$/;
const SHAPE = '{ "version": 1, "captures": [{ "path", "sha256" }] }';
const comparable = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
const samePath = (a, b) => comparable(a) === comparable(b);

function inside(directory, file) {
  const relative = path.relative(comparable(directory), comparable(file));
  return !!relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function readChecked(file, limit, label, expected, directory) {
  if (directory && !inside(directory, file)) throw new Error(`${label} must be inside project Artifacts`);
  let stat, real, bytes;
  try {
    stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.nlink !== 1) throw new Error(`${label} must be a regular single-link file`);
    if (!stat.size || stat.size > limit) throw new Error(`${label} is empty or exceeds its size limit`);
    real = fs.realpathSync.native(file);
    if (directory && !inside(directory, real)) throw new Error(`${label} resolves outside project Artifacts`);
    if (!directory && !samePath(file, real)) throw new Error(`${label} path changed or was replaced by a link`);
    bytes = fs.readFileSync(file);
  } catch (error) {
    throw new Error(`${label} file invalid: ${error.message}`);
  }
  if (!bytes.length || bytes.length > limit || bytes.length !== stat.size) throw new Error(`${label} size changed or exceeds its limit`);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== expected) throw new Error(`${label} SHA-256 digest mismatch`);
  return { path: real, sha256, bytes };
}

// Source identity is only as strong as the listed captures (e.g. a diff); this module does not run git.
export function validateAuditManifest(root, manifestPath, expectedSha256) {
  if (typeof expectedSha256 !== 'string' || !DIGEST.test(expectedSha256)) throw new Error('Manifest requires an exact lowercase SHA-256 digest');
  if (typeof root !== 'string' || typeof manifestPath !== 'string' || !path.isAbsolute(root) || !path.isAbsolute(manifestPath)) {
    throw new Error('Audit evidence requires absolute project and manifest paths');
  }
  root = path.resolve(root);
  try {
    if (!samePath(root, fs.realpathSync.native(root))) throw new Error('project root must equal its real path');
  } catch (error) { throw new Error(`Invalid audit project root: ${error.message}`); }
  const directory = path.join(root, 'Artifacts');
  const manifest = readChecked(path.resolve(manifestPath), MANIFEST_LIMIT, 'Manifest', expectedSha256, directory);
  let parsed;
  try { parsed = JSON.parse(manifest.bytes.toString('utf8')); }
  catch { throw new Error('Manifest must contain valid JSON'); }
  if (!parsed || parsed.version !== 1) throw new Error(`Manifest version must be 1; expected ${SHAPE}`);
  if (!Array.isArray(parsed.captures) || parsed.captures.length < 1 || parsed.captures.length > 64) {
    throw new Error('Manifest captures must contain 1 to 64 entries, each { path, sha256 }; other keys (for example "evidence") are ignored');
  }
  const seen = new Set();
  const captures = parsed.captures.map((entry) => {
    if (!entry || typeof entry.path !== 'string' || !entry.path.trim()) throw new Error('Capture entry must be an object with a non-empty string "path" and a lowercase "sha256"');
    if (typeof entry.sha256 !== 'string' || !DIGEST.test(entry.sha256)) throw new Error('Capture requires an exact lowercase SHA-256 digest in "sha256"');
    const capture = readChecked(path.resolve(root, entry.path), CAPTURE_LIMIT, 'Capture', entry.sha256, directory);
    const key = comparable(capture.path);
    if (seen.has(key)) throw new Error('Duplicate capture path');
    seen.add(key);
    return Object.freeze({ path: capture.path, sha256: capture.sha256 });
  });
  const verdict = Object.hasOwn(parsed, 'verdict') ? Object.freeze(validateVerdictIdentity(parsed.verdict, 'Manifest verdict')) : undefined;
  return Object.freeze({ manifestPath: manifest.path, manifestSha256: manifest.sha256, captures: Object.freeze(captures),
    ...(verdict ? { verdict } : {}) });
}

export function recheckAuditManifest(snapshot) {
  readChecked(snapshot.manifestPath, MANIFEST_LIMIT, 'Manifest', snapshot.manifestSha256);
  for (const capture of snapshot.captures) readChecked(capture.path, CAPTURE_LIMIT, 'Capture', capture.sha256);
}
