import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateApprovalRecord } from './bulk-admission.mjs';

// Convenience routing, not isolation: a shell, an interpreter, a pipe, a sed/awk/grep read or a series of
// bounded offset/limit reads can still read an approved file. Those bypasses are asserted by tests.
export const APPROVAL_FILE = 'bulk-read-approval.json';
const PROTECTED_STATE = new Set([APPROVAL_FILE, 'bulk-read-ledger.jsonl', 'bulk-read-ledger.lock']);
const WHOLE_FILE_READERS = new Set(['cat', 'less', 'more']);
const win = process.platform === 'win32';

// Mirrors guard.ts: Pi maps /c/x, /mnt/c/x and /cygdrive/c/x to C:\\x on Windows and normalises Unicode spaces.
function windowsShellPath(filePath) {
  if (!win || !filePath.startsWith('/') || filePath.startsWith('//') || filePath.includes('\\')) return filePath;
  const match = filePath.match(/^\/(?:mnt\/|cygdrive\/)?([a-z])(?:\/(.*))?$/i);
  if (!match) return filePath;
  return `${match[1].toUpperCase()}:\\${(match[2] ?? '').replaceAll('/', '\\')}`;
}

function resolveTarget(raw, cwd) {
  if (typeof raw !== 'string' || !raw.trim() || typeof cwd !== 'string' || !path.isAbsolute(cwd)) return undefined;
  let requested = windowsShellPath(raw.replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ').replace(/^@/, ''));
  if (requested === '~' || requested.startsWith('~/') || requested.startsWith('~\\')) requested = path.join(os.homedir(), requested.slice(2));
  if (requested.startsWith('file://')) { try { requested = fileURLToPath(requested); } catch { return undefined; } }
  const resolved = path.resolve(cwd, requested);
  // UNC and device paths are never touched here: the guard must not reach a network share (B1).
  return resolved.startsWith('\\\\') ? undefined : resolved;
}
function realFile(target) {
  try { const real = fs.realpathSync.native(target); return fs.statSync(real).isFile() ? real : undefined; } catch { return undefined; }
}

// Hash each file only when its size or mtime changed: this runs on every Parent read and bash call.
const hashCache = new Map();
function matchesHash(real, expected) {
  try {
    const stat = fs.statSync(real);
    const cached = hashCache.get(real);
    let sha;
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) sha = cached.sha;
    else { sha = createHash('sha256').update(fs.readFileSync(real)).digest('hex'); hashCache.set(real, { mtimeMs: stat.mtimeMs, size: stat.size, sha }); }
    return typeof expected === 'string' && sha === expected.toLowerCase();
  } catch { return false; }
}

// Returns { approved: Set of real paths } for a currently valid approval, otherwise undefined (no interception).
export function loadInterceptState({ cwd, loadPolicy, now = new Date() } = {}) {
  try {
    if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) return undefined;
    const record = JSON.parse(fs.readFileSync(path.join(cwd, 'Artifacts', '.agent', APPROVAL_FILE), 'utf8'));
    const policy = loadPolicy?.();
    if (!policy || !validateApprovalRecord(record, { policy, now }).ok) return undefined;
    // pi_bulk_read refuses without a policy rate, so redirecting toward it would strand the Parent.
    if (!policy.jobBudget?.rates?.[record.worker]) return undefined;
    const base = fs.realpathSync.native(cwd);
    const approved = new Set();
    for (const p of record.approvedPaths) {
      const real = realFile(path.join(base, ...String(p).split('/')));
      // A file changed since approval would be refused on its hash, so it is no longer redirected.
      if (real && matchesHash(real, record.approvedSha256?.[p])) approved.add(real);
    }
    return approved.size ? { approved } : undefined;
  } catch { return undefined; }
}

const reason = file => `Whole-file read of approved file ${file} is redirected. Call pi_bulk_read with paths and a question, or read a bounded range with offset and limit.`;
const isApproved = (state, raw, cwd) => {
  const target = resolveTarget(raw, cwd); const real = target && realFile(target);
  return real !== undefined && state.approved.has(real);
};

function tokens(command) {
  // Any shell metacharacter means this is not one simple command; it is left alone (documented bypass).
  if (/[;&|<>()`$*?\[\]{}\n\r\\]/.test(command.replace(/"[^"]*"|'[^']*'/g, m => m.replace(/[;&|<>()`$*?\[\]{}\\]/g, '_')))) return undefined;
  return (command.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map(t => t.replace(/^["']|["']$/g, ''));
}

export function interceptRead({ toolName, input, cwd, state } = {}) {
  if (!state?.approved) return undefined;
  if (toolName === 'read') {
    const limit = input?.limit;
    if (Number.isInteger(limit) && limit > 0) return undefined;
    return isApproved(state, input?.path, cwd) ? reason(String(input.path)) : undefined;
  }
  if (toolName === 'bash' && typeof input?.command === 'string') {
    const parts = tokens(input.command.trim());
    if (!parts?.length || !WHOLE_FILE_READERS.has(parts[0])) return undefined;
    const operands = parts.slice(1).filter(part => !/^-[A-Za-z]+$/.test(part));
    const hit = operands.find(operand => isApproved(state, operand, cwd));
    return hit === undefined ? undefined : reason(hit);
  }
  return undefined;
}

// Blocks Parent write/edit to the approval, ledger and lock files (a convenience rule; a shell can still forge them).
export function approvalWriteDenial({ toolName, input, cwd } = {}) {
  if (toolName !== 'write' && toolName !== 'edit') return undefined;
  const target = resolveTarget(input?.path, cwd);
  if (!target) return undefined;
  // An existing file is compared by its real name (resolves case and 8.3 aliases); otherwise by a normalised spelling.
  let named = target;
  try { named = fs.realpathSync.native(target); } catch { /* new file */ }
  let name = path.basename(named);
  if (win) name = name.split(':')[0].replace(/[ .]+$/, '').toLowerCase();
  if (!PROTECTED_STATE.has(name)) return undefined;
  let dir = path.dirname(named);
  try { dir = fs.realpathSync.native(dir); } catch { /* directory may not exist yet */ }
  let agent = path.join(path.resolve(cwd), 'Artifacts', '.agent');
  try { agent = fs.realpathSync.native(agent); } catch { /* not created yet */ }
  const same = win ? dir.toLowerCase() === agent.toLowerCase() : dir === agent;
  return same ? `Writing ${name} is blocked: the bulk-read approval and ledger are written only by the user script and the service.` : undefined;
}
