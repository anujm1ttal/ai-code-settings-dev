// Read-only verdict parsing for the PI-8 mechanical gate. Nothing here writes. A persisted result
// file is a discipline aid, not proof of authorship: a shell can write a fake file. Background
// auditor jobs (`job-*`) must also have a matching settlement; synchronous audits (`role-*`)
// leave only the `.result` file, so they are reported as `uncorroborated`.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const VALID_ID = /^[A-Za-z0-9._-]{1,80}$/;
const VERDICT = /^VERDICT: (PASS|FAIL|INCOMPLETE) task=(\S+) todo=(\S+) taskSha256=([0-9a-f]{64})$/;
const TASK_MARKER = /^(\s*- \[)[ x\-X](\] )/;
const REVIEW_SUFFIX = / — Auditor-(?:verified|reviewed) \d{4}-\d{2}-\d{2} \([^\r\n]*\)$/;
const HEADER_KEYS = ['version', 'dispatchId', 'role', 'completeness', 'meta'];

// The marker character is normalised to a space so `[ ]` -> `[x]` does not change the hash.
export function canonicalTaskHash(taskLine) {
  if (typeof taskLine !== 'string') throw new Error('task line must be a string');
  let text = taskLine.replace(/^\uFEFF/, '').replace(/\r?\n$/, '');
  if (/[\r\n]/.test(text)) throw new Error('task line must be a single line');
  if (!TASK_MARKER.test(text)) throw new Error('not a task line');
  text = text.replace(TASK_MARKER, '$1 $2').replace(REVIEW_SUFFIX, '');
  return sha256(Buffer.from(text, 'utf8'));
}

// Identity the auditor must echo: exactly task, todo and taskSha256, each well formed.
export function validateVerdictIdentity(value, label = 'verdict') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} identity must be an object`);
  const keys = Object.keys(value);
  if (keys.length !== 3 || !['task', 'todo', 'taskSha256'].every(k => keys.includes(k))) {
    throw new Error(`${label} identity needs exactly task, todo and taskSha256`);
  }
  if (typeof value.task !== 'string' || !/^[A-Za-z0-9._-]{1,40}$/.test(value.task)) throw new Error(`${label} task is invalid`);
  if (typeof value.todo !== 'string' || !/^\S+$/.test(value.todo)) throw new Error(`${label} todo is invalid`);
  if (typeof value.taskSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(value.taskSha256)) throw new Error(`${label} taskSha256 is invalid`);
  return { task: value.task, todo: value.todo, taskSha256: value.taskSha256 };
}

// Returns undefined when `text` ends in exactly one VERDICT line for `expected`, else the reason.
export function checkExpectedVerdict(text, expected) {
  try {
    const v = parseVerdictText(text);
    if (v.task !== expected.task) return 'VERDICT task does not match the requested task';
    if (v.todo !== expected.todo) return 'VERDICT todo does not match the requested todo';
    if (v.taskSha256 !== expected.taskSha256) return 'VERDICT taskSha256 does not match the requested hash';
    return undefined;
  } catch (error) { return error.message; }
}

export const stripReviewSuffix = line => line.replace(REVIEW_SUFFIX, '');

export function parseVerdictText(text) {
  if (typeof text !== 'string') throw new Error('verdict text must be a string');
  const lines = text.split(/\r?\n/);
  const at = lines.flatMap((l, i) => (l.includes('VERDICT:') ? [i] : []));
  if (at.length !== 1) throw new Error(at.length ? 'duplicate or quoted VERDICT line' : 'no VERDICT line');
  const match = VERDICT.exec(lines[at[0]]);
  if (!match) throw new Error('malformed VERDICT line');
  if (lines.slice(at[0] + 1).some(l => l.trim() !== '')) throw new Error('text after the VERDICT line');
  return { verdict: match[1], task: match[2], todo: match[3], taskSha256: match[4] };
}

export function parseResultBytes(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error('result bytes required');
  const end = bytes.indexOf(10);
  if (end < 0) throw new Error('result has no header line');
  const headerText = bytes.subarray(0, end).toString('utf8');
  let header;
  try { header = JSON.parse(headerText); } catch { throw new Error('result header is not JSON'); }
  if (!header || typeof header !== 'object' || Array.isArray(header)) throw new Error('result header is not an object');
  // The writer emits JSON.stringify of a fixed key order; any other shape is tampering.
  if (JSON.stringify(header) !== headerText) throw new Error('result header is not canonical');
  if (Object.keys(header).some(k => !HEADER_KEYS.includes(k))) throw new Error('result header has unknown keys');
  if (header.version !== 1) throw new Error('unsupported result version');
  if (typeof header.dispatchId !== 'string' || !VALID_ID.test(header.dispatchId) || header.dispatchId === '.' || header.dispatchId === '..') {
    throw new Error('invalid dispatch id');
  }
  if (header.role !== 'auditor') throw new Error('result role is not auditor');
  if (header.completeness !== 'complete') throw new Error('result completeness is not complete');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(end + 1)); }
  catch { throw new Error('result text is not valid UTF-8'); }
  return { header, text, sha256: sha256(bytes) };
}

function checkSettlement(directory, header, resultHash, resultBytes) {
  const fail = why => { throw new Error(`settlement missing or invalid: ${why}`); };
  const file = path.join(directory, `${header.dispatchId}.settlement.json`);
  let settlement;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('not a regular file');
    settlement = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) { fail(error.message); }
  const r = settlement?.receipt;
  if (!settlement || settlement.version !== 1 || settlement.dispatchId !== header.dispatchId) fail('identity');
  if (settlement.role !== 'auditor' || settlement.state !== 'succeeded') fail('role or state');
  if (!r || r.sha256 !== resultHash || r.bytes !== resultBytes || r.completeness !== 'complete') fail('receipt does not match the result file');
}

export function verifyVerdictFile({ ref, expected }) {
  if (typeof ref !== 'string' || !path.isAbsolute(ref)) throw new Error('result reference must be an absolute path');
  if (!expected || typeof expected.task !== 'string' || typeof expected.todo !== 'string') throw new Error('expected task and todo required');
  const stat = fs.lstatSync(ref);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('result is not a regular file');
  const bytes = fs.readFileSync(ref);
  const parsed = parseResultBytes(bytes);
  if (path.basename(ref) !== `${parsed.header.dispatchId}.result`) throw new Error('result file name does not match its dispatch id');
  const isJob = parsed.header.dispatchId.startsWith('job-');
  if (isJob) checkSettlement(path.dirname(ref), parsed.header, parsed.sha256, bytes.length);
  const verdict = parseVerdictText(parsed.text);
  if (verdict.task !== expected.task) throw new Error('task id mismatch');
  if (verdict.todo !== expected.todo) throw new Error('todo path mismatch');
  if (verdict.taskSha256 !== canonicalTaskHash(expected.taskLine)) throw new Error('stale task: task hash does not match the current line');
  return { ...verdict, sha256: parsed.sha256, dispatchId: parsed.header.dispatchId, evidence: isJob ? 'settlement' : 'uncorroborated' };
}
