import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { loadOwnership, authorizeMutation } from './role-ownership.mjs';
import { parseApprovalBlocks, validateStrategistChange } from './todo-ownership.mjs';

export class MutationRefused extends Error {
  constructor(reason) { super(`Mutation refused: ${reason}`); this.name = 'MutationRefused'; }
}
const refuse = reason => { throw new MutationRefused(reason); };
const bytesEqual = (a, b) => a === null ? b === null : b !== null && a.equals(b);
// Same segment wildcard grammar as the ownership policy.
function matches(pattern, target) {
  const parts = pattern.toLowerCase().split('/'), segments = target.toLowerCase().split('/');
  function visit(i, j) {
    if (i === parts.length) return j === segments.length;
    if (parts[i] === '**') return visit(i + 1, j) || (j < segments.length && visit(i, j + 1));
    const regex = new RegExp(`^${parts[i].split('*').map(s => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')).join('[\\s\\S]*')}$(?![\\s\\S])`);
    return j < segments.length && regex.test(segments[j]) && visit(i + 1, j + 1);
  }
  return visit(0, 0);
}
function validate(role, decision, policy, original, candidate) {
  if (role === 'coder') return;
  const prefixes = policy.approvalLinePrefixes;
  if (!prefixes.length) refuse('approval prefixes are not configured');
  const options = { approvalLinePrefixes: prefixes };
  const before = original ?? Buffer.alloc(0);
  const taskLike = bytes => /^\s*(?:>\s*)*(?:[-*+]\s*\[|\d+[.)]\s*\[)/m.test(bytes.toString('utf8'));
  if (role === 'strategist' && (taskLike(before) || taskLike(candidate) || policy.roles.strategist.todos.some(p => matches(p, decision.relPath)))) {
    const verdict = validateStrategistChange(before, candidate, { ...options, originalAbsent: original === null });
    if (!verdict.allow) refuse(verdict.reasons.join('; '));
    return;
  }
  // Scribe documents are not authoritative TODOs, even if they contain task-shaped text.
  const a = parseApprovalBlocks(before, options), b = parseApprovalBlocks(candidate, options);
  if (!a.ok || !b.ok) refuse('ineligible or ambiguous content');
  if (!(role === 'strategist' && original === null) && (a.approvals.length !== b.approvals.length || a.approvals.some((block, i) => block.bytesSha256 !== b.approvals[i].bytesSha256))) refuse('approval blocks changed');
}

// Operations are scoped to one tool execution where possible. Native SDK queues by target.
export function createGuardedOperations({ role, projectRoot, globalPath, fs: io = fsp } = {}) {
  const snapshots = new Map();
  function authorize(target, operation) {
    if (!['strategist', 'coder', 'scribe'].includes(role)) refuse('role has no mutation authority');
    const ownership = loadOwnership({ projectRoot, globalPath });
    const decision = authorizeMutation({ ownership, role, projectRoot, requestedPath: target, operation, globalPath });
    if (!decision.allow) refuse(decision.reason);
    return { ownership, decision };
  }
  async function current(target) {
    try { return await io.readFile(target); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  }
  async function commit(target, content, operation) {
    const { ownership, decision } = authorize(target, operation);
    const original = await current(target);
    if (operation === 'edit') {
      const saved = snapshots.get(target); snapshots.delete(target);
      if (!saved || !bytesEqual(saved, original)) refuse('file drift after edit read');
    }
    const candidate = Buffer.from(content, 'utf8');
    validate(role, decision, ownership.policy, original, candidate);
    // Native write calls mkdir before writeFile but does not provide its target there.
    // Defer directory creation until target and final bytes have been checked.
    if (operation === 'write') await io.mkdir(path.dirname(target), { recursive: true });
    const checked = authorize(target, operation);
    if (checked.decision.ownerClass !== decision.ownerClass) refuse('ownership changed');
    validate(role, checked.decision, checked.ownership.policy, original, candidate);
    if (!bytesEqual(original, await current(target))) refuse('file drift before write');
    try { await io.writeFile(target, candidate, decision.ownerClass === 'evidence' ? { flag: 'wx' } : undefined); }
    catch (e) { if (e.code === 'EEXIST') refuse('evidence already exists'); throw e; }
  }
  return {
    authorize,
    edit: {
      access: async target => { authorize(target, 'edit'); await io.access(target, fs.constants.R_OK | fs.constants.W_OK); },
      readFile: async target => { authorize(target, 'edit'); const b = await io.readFile(target); snapshots.set(target, Buffer.from(b)); return b; },
      writeFile: (target, content) => commit(target, content, 'edit'),
    },
    write: { mkdir: async () => {}, writeFile: (target, content) => commit(target, content, 'write') },
  };
}
