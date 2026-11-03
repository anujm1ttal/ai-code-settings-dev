import { constants, openSync, closeSync, fstatSync, lstatSync, realpathSync, readSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { TextDecoder } from 'node:util';

export const MAX_FILES = 40;
export const MAX_FILE_BYTES = 400 * 1024;
export const MAX_TOTAL_BYTES = 600 * 1024;
export const MAX_APPROVAL_MS = 24 * 60 * 60 * 1000;
export const DENYLIST = Object.freeze(['.env*', '*.pem', '*.key', 'id_rsa*', '.npmrc', '*.pfx', '*.p12', 'credentials*', '*.token', 'secrets*', 'Artifacts/.agent/**']);
const FIELDS = ['version', 'approvalId', 'approvedAt', 'expiresAt', 'worker', 'rates', 'maxOutputTokens', 'maxCostUsd', 'maxTotalUsd', 'systemPromptSha256', 'approvedPaths', 'approvedSha256'];
const fail = reason => ({ ok: false, reason });
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const keysAre = (x, keys) => object(x) && Object.keys(x).length === keys.length && keys.every(k => Object.hasOwn(x, k));
const positive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
const hex = x => typeof x === 'string' && /^[a-f\d]{64}$/i.test(x);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function utc(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value)) return NaN;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return NaN;
  const canonical = new Date(time).toISOString();
  const normalized = value.replace(/(?:\.(\d{1,3}))?Z$/, (_, fraction = '') => `.${fraction.padEnd(3, '0')}Z`);
  return canonical === normalized ? time : NaN;
}
function validPath(p) {
  if (typeof p !== 'string' || !p || p.includes('\\') || p.includes('\0') || path.posix.isAbsolute(p) || path.win32.isAbsolute(p) || /^[a-z]:/i.test(p)) return false;
  const parts = p.split('/');
  return parts.every(s => s && s !== '.' && s !== '..' && !s.includes(':') && !/[. ]$/.test(s)) && path.posix.normalize(p) === p;
}
function denied(p) {
  const parts = p.toLowerCase().split('/');
  return parts.some((s, i) => s.startsWith('.env') || s.endsWith('.pem') || s.endsWith('.key') || s.startsWith('id_rsa') || s === '.npmrc' || s.endsWith('.pfx') || s.endsWith('.p12') || s.startsWith('credentials') || s.endsWith('.token') || s.startsWith('secrets') || (s === 'artifacts' && parts[i + 1] === '.agent'));
}
function pathList(paths) {
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > MAX_FILES) return fail('path-count');
  if (!paths.every(validPath)) return fail('invalid-path');
  if (new Set(paths).size !== paths.length) return fail('duplicate-path');
  if (paths.some(denied)) return fail('denied-path');
  return { ok: true };
}
export function validateApprovalRecord(record, options = {}) {
  if (!keysAre(record, FIELDS)) return fail('approval-fields');
  if (record.version !== 1 || typeof record.approvalId !== 'string' || !record.approvalId.trim()) return fail('approval-identity');
  const start = utc(record.approvedAt), end = utc(record.expiresAt);
  const now = options?.now instanceof Date ? options.now.getTime() : typeof options?.now === 'number' ? options.now : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(now) || start > now || now >= end || start >= end || end - start > MAX_APPROVAL_MS) return fail('approval-time');
  const policy = options?.policy;
  if (typeof record.worker !== 'string' || !Array.isArray(policy?.allowedModels) || !policy.allowedModels.includes(record.worker) || record.worker !== policy?.roles?.explorer?.model) return fail('approval-worker');
  if (!keysAre(record.rates, ['inputPerMTok', 'outputPerMTok']) || !positive(record.rates.inputPerMTok) || !positive(record.rates.outputPerMTok)) return fail('approval-rates');
  if (!Number.isInteger(record.maxOutputTokens) || record.maxOutputTokens < 256 || record.maxOutputTokens > 8192 || !positive(record.maxCostUsd) || record.maxCostUsd > 0.5 || !positive(record.maxTotalUsd) || record.maxTotalUsd > 2) return fail('approval-limits');
  if (!hex(record.systemPromptSha256)) return fail('approval-prompt-hash');
  const paths = pathList(record.approvedPaths); if (!paths.ok) return paths;
  if (!keysAre(record.approvedSha256, record.approvedPaths) || !Object.values(record.approvedSha256).every(hex)) return fail('approval-file-hashes');
  return { ok: true };
}
function inside(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}
function artifactsPrivate(root, p) {
  if (p.split('/')[0].toLowerCase() !== 'artifacts') return true;
  // Only invoke git when a worktree or bare metadata marker exists in the ancestor chain.
  let dir = root, found = false;
  while (true) { if (existsSync(path.join(dir, '.git'))) { found = true; break; } const parent = path.dirname(dir); if (parent === dir) break; dir = parent; }
  if (!found) return true;
  const result = spawnSync('git', ['check-ignore', '-q', '--', p], { cwd: root, stdio: 'ignore', windowsHide: true });
  return !result.error && result.status === 0;
}
// Shared by the approval writer so it never hashes paths that admission would refuse.
export function inspectFiles({ root, paths } = {}) {
  const checked = pathList(paths); if (!checked.ok) return checked;
  if (typeof root !== 'string' || !root) return fail('invalid-root');
  let base;
  try { base = realpathSync.native(root); if (!lstatSync(base).isDirectory()) return fail('invalid-root'); } catch { return fail('invalid-root'); }
  let total = 0; const files = [];
  for (const p of paths) {
    if (!artifactsPrivate(base, p)) return fail('artifacts-not-private');
    const full = path.join(base, ...p.split('/'));
    let fd;
    try {
      let current = base;
      for (const segment of p.split('/')) { current = path.join(current, segment); if (lstatSync(current).isSymbolicLink()) return fail('symlink-path'); }
      const real = realpathSync.native(full); if (!inside(base, real)) return fail('outside-root');
      const actual = path.relative(base, real).split(path.sep).join('/');
      if (denied(actual)) return fail('denied-path');
      if (process.platform === 'win32' && actual !== p) return fail('path-alias');
      fd = openSync(full, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
      const st = fstatSync(fd); const target = lstatSync(full);
      if (!st.isFile() || st.nlink !== 1 || !target.isFile() || target.nlink !== 1 || st.dev !== target.dev || st.ino !== target.ino) return fail('file-identity');
      if (st.size > MAX_FILE_BYTES) return fail('file-size');
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1); let length = 0, n;
      while (length < buffer.length && (n = readSync(fd, buffer, length, buffer.length - length, null)) > 0) length += n;
      if (length > MAX_FILE_BYTES) return fail('file-size');
      const after = fstatSync(fd);
      if (!after.isFile() || after.nlink !== 1 || after.size !== length || st.size !== after.size || st.mtimeMs !== after.mtimeMs || st.ctimeMs !== after.ctimeMs) return fail('file-changed');
      total += length; if (total > MAX_TOTAL_BYTES) return fail('total-size');
      const bytes = buffer.subarray(0, length); let text;
      try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { return fail('invalid-utf8'); }
      const lineCount = (text.match(/\n/g) || []).length + (text.length > 0 && !text.endsWith('\n') ? 1 : 0);
      files.push({ path: p, bytes, sha256: hash(bytes), lineCount });
    } catch { return fail('file-access'); } finally { if (fd !== undefined) closeSync(fd); }
  }
  return { ok: true, files };
}
export function validateAdmission(args = {}) {
  if (!object(args)) return fail('invalid-input');
  const approval = validateApprovalRecord(args.approval, { policy: args.policy, now: args.now });
  if (!approval.ok) return approval;
  const checked = pathList(args.paths); if (!checked.ok) return checked;
  if (args.paths.length !== args.approval.approvedPaths.length || args.paths.some(p => !Object.hasOwn(args.approval.approvedSha256, p))) return fail('path-mismatch');
  const inspected = inspectFiles({ root: args.root, paths: args.paths }); if (!inspected.ok) return inspected;
  if (inspected.files.some(f => f.sha256 !== args.approval.approvedSha256[f.path].toLowerCase())) return fail('hash-mismatch');
  return inspected;
}
