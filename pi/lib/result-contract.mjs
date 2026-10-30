// Persistence requires filesystem hard-link support and is not fsync-durable. Receipts are
// process-local: T4 must pass the receipt object, not rely on serialization. Directory checks
// have a TOCTOU race; SHA-256 covers the header plus text. Summary and Findings truncate silently.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

const LIMIT = 2048;
// Receipts are issued only after successful read-back; filesystem hashes alone are forgeable.
const receipts = new WeakSet();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const validId = id => typeof id === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(id) && id !== '.' && id !== '..';

export function checkedDir(dir) {
  if (typeof dir !== 'string' || !path.isAbsolute(dir)) throw new Error('result directory must be absolute');
  const resolved = path.resolve(dir);
  const root = path.parse(resolved).root;
  let current = root;
  for (const segment of resolved.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('result directory contains a link or non-directory');
  }
  if (!fs.statSync(resolved).isDirectory()) throw new Error('result directory is not a directory');
  return resolved;
}

export function prepareResultDir(cwd) {
  if (typeof cwd !== 'string' || !cwd) throw new Error('project directory required');
  const dir = path.join(path.resolve(cwd), 'Artifacts', '.agent', 'pi-results');
  const root = path.parse(dir).root;
  let current = root;
  for (const segment of dir.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try { fs.mkdirSync(current); } catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('result directory contains a link or non-directory');
  }
  return checkedDir(dir);
}

export function persistFullResult({ dir, dispatchId, role, completeness, text, meta }) {
  let temp;
  try {
    if (!validId(dispatchId) || !['complete', 'partial'].includes(completeness) || typeof text !== 'string') {
      throw new Error('invalid result identity, completeness, or text');
    }
    const directory = checkedDir(dir);
    const ref = path.join(directory, `${dispatchId}.result`);
    const header = JSON.stringify({ version: 1, dispatchId, role, completeness, meta });
    const data = Buffer.from(`${header}\n${text}`, 'utf8');
    temp = path.join(directory, `.result-${randomBytes(16).toString('hex')}.tmp`);
    fs.writeFileSync(temp, data, { flag: 'wx', mode: 0o600 });
    // A hard-link publishes atomically and, unlike rename, cannot replace an existing destination.
    fs.linkSync(temp, ref);
    fs.unlinkSync(temp); temp = undefined;
    const received = fs.readFileSync(ref);
    if (!received.equals(data)) throw new Error('result read-back mismatch');
    const receipt = Object.freeze({ ref, sha256: hash(received), bytes: received.length, completeness });
    receipts.add(receipt);
    return receipt;
  } catch (cause) {
    if (temp) { try { fs.unlinkSync(temp); } catch { /* retain original failure */ } }
    const error = new Error(`Result persistence failed: ${cause.message}`, { cause });
    error.code = 'PERSIST_FAILED'; error.partialText = text;
    throw error;
  }
}

function requireIdentity(identity) {
  if (!identity || typeof identity.dispatchId !== 'string' || typeof identity.role !== 'string' || !identity.role) {
    throw new Error('dispatch and role identity required');
  }
}

export function verifyPersisted(persisted, identity) {
  requireIdentity(identity);
  if (!persisted || !receipts.has(persisted) || typeof persisted.ref !== 'string' || !path.isAbsolute(persisted.ref) ||
      !/^[a-f0-9]{64}$/.test(persisted.sha256 ?? '') || !['complete', 'partial'].includes(persisted.completeness)) {
    throw new Error('verified persisted result required');
  }
  const stat = fs.lstatSync(persisted.ref);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('persisted result is not a regular file');
  const bytes = fs.readFileSync(persisted.ref);
  if (hash(bytes) !== persisted.sha256 || bytes.length !== persisted.bytes) throw new Error('persisted result hash mismatch');
  const end = bytes.indexOf(10);
  const header = JSON.parse(bytes.subarray(0, end).toString('utf8'));
  if (end < 0 || header.completeness !== persisted.completeness || !validId(header.dispatchId) ||
      identity.dispatchId !== header.dispatchId || identity.role !== header.role) throw new Error('persisted identity mismatch');
  return header.dispatchId;
}

function clip(value, budget) {
  let out = '';
  let used = 0;
  for (const c of String(value ?? '')) {
    const size = Buffer.byteLength(c);
    if (used + size > budget) break;
    out += c; used += size;
  }
  return out;
}

function format({ status, summary, artifacts, findings, blockers, next, maxBytes = LIMIT }) {
  const singleLine = value => String(value ?? '').replace(/[\r\n\u0085\u2028\u2029]/g, ' ');
  if (/[\r\n\u0085\u2028\u2029]/.test(artifacts)) throw new Error('recovery reference cannot be represented');
  status = singleLine(status);
  summary = singleLine(summary); findings = singleLine(findings);
  blockers = singleLine(blockers); next = singleLine(next);
  const base = `Status: ${status}\nSummary: \nArtifacts: ${artifacts}\nFindings: \nBlockers: \nNext action: `;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0 || maxBytes > LIMIT) throw new Error('invalid envelope limit');
  let budget = maxBytes - Buffer.byteLength(base);
  if (budget < 0) throw new Error('recovery reference exceeds envelope limit');
  // Reserve the fixed reference first, then blocking data and findings before narrative.
  const take = (value, cap) => { const result = clip(value, Math.min(budget, cap)); budget -= Buffer.byteLength(result); return result; };
  const b = take(blockers, 500);
  const f = take(findings, 700);
  const n = take(next, 300);
  const s = take(summary, budget);
  return `Status: ${status}\nSummary: ${s}\nArtifacts: ${artifacts}\nFindings: ${f}\nBlockers: ${b}\nNext action: ${n}`;
}

export function buildEnvelope({ status, persisted, identity, summarySource, findingsSource, blockers, next, maxBytes }) {
  const id = verifyPersisted(persisted, identity);
  if (persisted.completeness === 'partial' && status !== 'INCOMPLETE') {
    throw new Error('partial results require INCOMPLETE status');
  }
  const source = String(findingsSource ?? summarySource ?? '');
  const lines = source.split(/[\r\n\u0085\u2028\u2029]+/).filter(line => /\b(?:PASS|FAIL|INCOMPLETE|verdict|blocking|critical)\b/i.test(line));
  const severity = line => /\b(?:FAIL|INCOMPLETE|critical)\b/i.test(line) ? 0 :
    /\bblocking\b/i.test(line) && !/^\s*blocking\s*:\s*(?:none|no|n\/a)\s*[.!]?\s*$/i.test(line) ? 1 : 2;
  const finalVerdict = String(summarySource ?? '').split(/[\r\n\u0085\u2028\u2029]+/)
    .filter(line => /\bverdict\b/i.test(line)).at(-1);
  const findings = [ ...(finalVerdict ? [finalVerdict] : []),
    ...lines.map((line, index) => ({ line, index, rank: severity(line) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(({ line }) => line).filter(line => line !== finalVerdict) ]
    .map(line => clip(line, 300)).join('\n');
  return format({ status: clip(status ?? 'COMPLETE', 64), summary: summarySource,
    artifacts: `full result persisted at ${persisted.ref} sha256 ${persisted.sha256} completeness ${status === 'INCOMPLETE' && persisted.completeness === 'complete' ? 'not asserted' : persisted.completeness} dispatch ${id}`,
    findings, blockers, next, maxBytes });
}

export function buildIncompleteEnvelope({ reason, partialText, persisted, identity, referenceUnavailable = false, maxBytes }) {
  requireIdentity(identity);
  if (persisted) {
    return buildEnvelope({ status: 'INCOMPLETE', persisted, identity, summarySource: partialText,
      findingsSource: partialText, blockers: reason, next: 'Inspect the persisted partial result.', maxBytes });
  }
  return format({ status: 'INCOMPLETE', summary: partialText,
    artifacts: referenceUnavailable ? 'Persisted reference cannot be represented in this envelope.' :
      'Persistence failed; no full-text copy exists.',
    findings: '', blockers: reason, next: 'Recover retained partial text via collect with recoveryOffset.', maxBytes });
}
