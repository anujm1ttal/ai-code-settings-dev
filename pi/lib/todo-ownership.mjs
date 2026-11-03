// Pure byte-preserving phase TODO validation. No filesystem or authorization operations.
import { createHash } from 'node:crypto';
import { canonicalTaskHash, stripReviewSuffix } from './verdict.mjs';

const ID = '[A-Za-z0-9._-]{1,80}'; // verdict.mjs VALID_ID
const TASK = new RegExp(`^- \\[([ x-])\\] \\[(strategist|coder|auditor|scribe|user|explorer)\\] (${ID}): (.+?) — Success: (.+?) — Mode: (HITL|AFK)(?: — Blocked by: (${ID}(?:, ${ID})*))?$`);
const LOOKALIKE = /^\s*(?:>\s*)*(?:[-*+]\s*\[|\d+[.)]\s*\[)/;
const HEADING = /^ {0,3}#{1,6}(?:\s|$)/;
const sha = s => createHash('sha256').update(s).digest('hex');
const frozen = value => {
  if (value && typeof value === 'object' && !Buffer.isBuffer(value) && !Object.isFrozen(value)) {
    for (const v of Object.values(value)) frozen(v);
    Object.freeze(value);
  }
  return value;
};
const answer = (allow, reasons) => frozen({ allow, reasons });
const validOptions = opts => opts && typeof opts === 'object' && !Array.isArray(opts) &&
  Array.isArray(opts.approvalLinePrefixes) && Array.from(opts.approvalLinePrefixes).every(p => typeof p === 'string' && p.length > 0 && !/[\r\n]/.test(p)) &&
  new Set(opts.approvalLinePrefixes).size === opts.approvalLinePrefixes.length &&
  !opts.approvalLinePrefixes.some((p, i, all) => all.some((q, j) => i !== j && (p.includes(q) || q.includes(p))));

function parse(buffer, opts, strictTasks) {
  const errors = [], lines = [], tasks = [], approvals = [];
  let bom = false, finalNewline = false;
  const result = () => frozen({ eligible: errors.length === 0, errors, bom, finalNewline, lines, tasks, approvals });
  if (!Buffer.isBuffer(buffer)) { errors.push('expected a Buffer'); return result(); }
  if (!validOptions(opts)) { errors.push('invalid approvalLinePrefixes'); return result(); }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer); }
  catch { errors.push('invalid UTF-8'); return result(); }
  bom = text.startsWith('\uFEFF');
  if (bom) text = text.slice(1);
  finalNewline = text.endsWith('\n');
  // Lone CR has no unambiguous supported line-ending interpretation.
  if (/\r(?!\n)/.test(text)) errors.push('unsupported lone CR');
  const lineRe = /([^\n]*?)(\r\n|\n|$)/g;
  let m;
  while ((m = lineRe.exec(text)) && (m[0].length > 0)) lines.push({ text: m[1], eol: m[2] });
  const prefixes = opts.approvalLinePrefixes;
  const seen = new Set();
  let fence = null, afterTask = false, approval = null;
  const error = (i, message) => errors.push(`line ${i + 1}: ${message}`);
  const finishApproval = end => {
    if (!approval) return;
    const bytes = Buffer.from((bom && approval.start === 0 ? '\uFEFF' : '') + lines.slice(approval.start, end + 1).map(l => l.text + l.eol).join(''), 'utf8');
    approvals.push({ start: approval.start, end, bytesSha256: sha(bytes) });
    approval = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].text;
    if (approval && !line.trim()) finishApproval(i - 1);
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    const occurrences = prefixes.flatMap(p => {
      const found = []; let at = line.indexOf(p);
      while (at !== -1) { found.push({ p, at }); at = line.indexOf(p, at + 1); }
      return found;
    });
    const taskLike = LOOKALIKE.test(line);
    if (fence) {
      if (strictTasks && taskLike) error(i, 'task lookalike in fence');
      if (occurrences.length) error(i, 'approval prefix in fence');
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (marker) {
      if (approval) error(i, 'fence inside approval block');
      if (afterTask) error(i, 'continuation after task');
      if (occurrences.length) error(i, 'approval prefix on fence');
      fence = marker[1];
      continue;
    }
    if (taskLike) {
      if (approval) error(i, 'task inside approval block');
      if (occurrences.length) error(i, 'approval prefix in task');
      if (!strictTasks) continue;
      const base = stripReviewSuffix(line);
      const suffix = base === line ? null : line.slice(base.length);
      const match = TASK.exec(base);
      const fieldsBad = match && [match[4], match[5]].some(s => !s.trim() || s !== s.trim() || / — (?:Success|Mode|Blocked by|Auditor-)/.test(s));
      const suffixMatch = suffix && /^ — Auditor-(?:verified|reviewed) \d{4}-\d{2}-\d{2} \(([^()\r\n]+)\)$/.exec(suffix);
      const suffixBad = suffix && (!suffixMatch || !suffixMatch[1].trim());
      if (!match || fieldsBad || suffixBad || base.includes(' — Auditor-')) {
        error(i, 'malformed or indented task');
      } else {
        const [, mark, role, id, title, success, mode, blocked] = match;
        if (seen.has(id)) error(i, `duplicate task ID ${id}`);
        seen.add(id);
        canonicalTaskHash(line); // Use the verdict module's canonical task identity implementation.
        tasks.push({ id, role, marker: mark, title, success, mode, blockedBy: blocked ? blocked.split(', ') : [], suffix, lineIndex: i });
      }
      afterTask = true;
      continue;
    }
    if (afterTask && line.trim() && !HEADING.test(line)) error(i, 'continuation after task');
    if (!line.trim() || HEADING.test(line)) afterTask = false;
    if (occurrences.length) {
      // A single occurrence must begin the line, or follow exactly one Markdown prefix.
      const { at } = occurrences[0];
      if (approval || occurrences.length !== 1 || !['', '**', '> '].includes(line.slice(0, at))) error(i, 'ambiguous approval prefix');
      else approval = { start: i };
    }
    if (approval && HEADING.test(line)) error(i, 'heading inside approval block');
  }
  if (fence) errors.push('unclosed fence');
  finishApproval(lines.length - 1);
  return result();
}

export function parseTodo(buffer, opts = { approvalLinePrefixes: [] }) {
  return parse(buffer, opts, true);
}

// Documents may contain task-shaped text, but it has no TODO authority.
export function parseApprovalBlocks(buffer, opts = { approvalLinePrefixes: [] }) {
  const result = parse(buffer, opts, false);
  return frozen({ ok: result.eligible, errors: result.errors, approvals: result.approvals });
}

export function validateStrategistChange(originalBuf, candidateBuf, opts = { approvalLinePrefixes: [] }) {
  const a = parseTodo(originalBuf, opts), b = parseTodo(candidateBuf, opts), reasons = [];
  if (!a.eligible || !b.eligible) return answer(false, [...a.errors.map(e => `original: ${e}`), ...b.errors.map(e => `candidate: ${e}`)]);
  if (opts.originalAbsent !== undefined && typeof opts.originalAbsent !== 'boolean') return answer(false, ['invalid originalAbsent']);
  if (opts.originalAbsent) {
    if (originalBuf.length !== 0) return answer(false, ['absent original must be empty']);
    for (const t of b.tasks) if (t.marker !== ' ' || t.suffix !== null) reasons.push(`new task ${t.id} has marker or suffix`);
    return answer(reasons.length === 0, reasons);
  }
  if (a.bom !== b.bom) reasons.push('BOM changed');
  if (a.finalNewline !== b.finalNewline) reasons.push('final newline state changed');
  const next = new Map(b.tasks.map(t => [t.id, t]));
  for (const old of a.tasks) {
    const cur = next.get(old.id);
    if (!cur) { reasons.push(`task ${old.id} deleted`); continue; }
    if (old.marker !== cur.marker || old.suffix !== cur.suffix) reasons.push(`task ${old.id} marker or suffix changed`);
    if (old.suffix?.startsWith(' — Auditor-verified ') && a.lines[old.lineIndex].text !== b.lines[cur.lineIndex].text) reasons.push(`verified task ${old.id} changed`);
  }
  const originalIds = new Set(a.tasks.map(t => t.id));
  for (const t of b.tasks) if (!originalIds.has(t.id) && (t.marker !== ' ' || t.suffix !== null)) reasons.push(`new task ${t.id} has marker or suffix`);
  const block = (parsed, x) => parsed.lines.slice(x.start, x.end + 1).map(l => l.text + l.eol).join('');
  if (a.approvals.length !== b.approvals.length || a.approvals.some((x, i) => block(a, x) !== block(b, b.approvals[i]))) reasons.push('approval blocks changed');
  // For each identical line text, preserve the multiset of endings for all surviving copies.
  const counts = parsed => {
    const out = new Map();
    for (const l of parsed.lines) { if (!out.has(l.text)) out.set(l.text, []); out.get(l.text).push(l.eol); }
    return out;
  };
  const ac = counts(a), bc = counts(b);
  for (const [text, old] of ac) {
    const now = bc.get(text); if (!now) continue;
    const overlap = ['','\n','\r\n'].reduce((n, eol) => n + Math.min(old.filter(x => x === eol).length, now.filter(x => x === eol).length), 0);
    if (overlap < Math.min(old.length, now.length)) { reasons.push('unchanged line ending changed'); break; }
  }
  return answer(reasons.length === 0, reasons);
}

function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const date = new Date(`${s}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s;
}
export function buildAuditorRecording(originalBuf, args) {
  const reasons = [];
  const fail = why => frozen({ ok: false, candidate: null, reasons: [why] });
  if (!args || typeof args !== 'object' || Array.isArray(args)) return fail('invalid recording arguments');
  if (!['PASS', 'FAIL'].includes(args.verdict)) return fail('invalid verdict');
  if (!validDate(args.date)) return fail('invalid date');
  if (typeof args.ref !== 'string' || !args.ref.trim() || /[()\r\n]/.test(args.ref)) return fail('invalid ref');
  if (typeof args.taskId !== 'string' || !(new RegExp(`^${ID}$`)).test(args.taskId)) return fail('invalid task ID');
  const opts = { approvalLinePrefixes: args.approvalLinePrefixes === undefined ? [] : args.approvalLinePrefixes };
  const parsed = parseTodo(originalBuf, opts);
  if (!parsed.eligible) return frozen({ ok: false, candidate: null, reasons: parsed.errors.map(e => `original: ${e}`) });
  const task = parsed.tasks.find(t => t.id === args.taskId);
  if (!task) return fail('task not found');
  if (args.verdict === 'PASS' && task.marker === 'x') return fail('task already checked');
  const old = parsed.lines[task.lineIndex].text;
  const base = stripReviewSuffix(old);
  const marker = args.verdict === 'PASS' ? 'x' : ' ';
  const suffix = ` — Auditor-${args.verdict === 'PASS' ? 'verified' : 'reviewed'} ${args.date} (${args.ref})`;
  const replacement = base.slice(0, 3) + marker + base.slice(4) + suffix;
  const content = parsed.lines.map((l, i) => (i === task.lineIndex ? replacement : l.text) + l.eol).join('');
  const candidate = Buffer.from((parsed.bom ? '\uFEFF' : '') + content, 'utf8');
  return frozen({ ok: true, candidate, reasons });
}

export function validateAuditorRecording(originalBuf, candidateBuf, args) {
  const built = buildAuditorRecording(originalBuf, args);
  if (!built.ok) return answer(false, built.reasons);
  if (!Buffer.isBuffer(candidateBuf) || !candidateBuf.equals(built.candidate)) return answer(false, ['candidate differs from exact recording']);
  return answer(true, []);
}
