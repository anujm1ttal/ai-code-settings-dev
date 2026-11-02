import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildReviewRequest, validateReviewRequest } from './review-packet.mjs';
import { buildAgentArgs } from './role-policy.mjs';
import { runRole } from './role-runner.mjs';

export const STAGE_INSTRUCTIONS = Object.freeze({
  comprehension: 'Read the design packet and explain the architecture, intent, scope and failure behaviour in your own words, then list anything ambiguous.',
  antagonistic: 'Act as a skeptical technical reviewer. List BLOCKING and NON-BLOCKING issues, each with an id (B1.., N1..), quoting the packet text concerned. Do not propose rewrites of unrelated parts.',
  readiness: 'Give a strict go/no-go on implementation readiness. The FIRST line must be exactly Readiness: GO or Readiness: NO-GO. Then name every file path, data structure, function signature and verification command the packet specifies and list unresolved blockers.',
});
export const ANTAGONISTIC_VIEWPOINTS = Object.freeze(['strategist', 'coder', 'auditor']);
const sha256 = text => createHash('sha256').update(text, 'utf8').digest('hex');
const bytes = text => Buffer.byteLength(text, 'utf8');
const MAX_ARGV_PROMPT_BYTES = 24 * 1024; // the whole prompt travels on the child command line (Windows allows about 32K characters)

function freezeCopy(value) {
  if (value === undefined || value === null || typeof value !== 'object') return value;
  const copy = structuredClone(value);
  const freeze = item => {
    if (item && typeof item === 'object' && !Object.isFrozen(item)) {
      for (const child of Object.values(item)) freeze(child);
      Object.freeze(item);
    }
    return item;
  };
  return freeze(copy);
}

function checkRequest(request, approved) {
  const validation = validateReviewRequest(request, approved);
  if (!validation.ok) throw new Error(`Review request validation failed: ${validation.reason}`);
}

export async function runReviewSession(policy, input, cwd, options = {}) {
  if (!ANTAGONISTIC_VIEWPOINTS.every(role => policy?.roles?.[role])) {
    throw new Error('Review requires configured strategist, coder and auditor roles');
  }
  const { systemPromptPath, runRoleImpl = runRole, resultStoreFor, signal, timeoutMs, ledger, dispatchKeyFor } = options;
  if (Boolean(ledger) !== Boolean(dispatchKeyFor)) throw new Error('Review ledger and dispatchKeyFor must be supplied together');
  if (typeof systemPromptPath !== 'string' || !path.isAbsolute(systemPromptPath)) {
    throw new Error('Review systemPromptPath must be an absolute string');
  }
  let systemPromptSha256;
  try { systemPromptSha256 = sha256(fs.readFileSync(systemPromptPath)); } catch { throw new Error('Review system prompt file is unreadable'); }
  const sessionId = randomUUID();
  const { packet, constraints, approved, instructionsByStage = STAGE_INSTRUCTIONS,
    viewpoints = ANTAGONISTIC_VIEWPOINTS } = input ?? {};
  if (!Array.isArray(viewpoints) || viewpoints.length === 0 || new Set(viewpoints).size !== viewpoints.length ||
      !viewpoints.every(viewpoint => ANTAGONISTIC_VIEWPOINTS.includes(viewpoint))) {
    throw new Error('Invalid review viewpoints');
  }
  const plan = [
    { stage: 'comprehension', role: 'auditor', callId: 'comprehension' },
    ...viewpoints.map(viewpoint => ({ stage: 'antagonistic', role: viewpoint, viewpoint, callId: `antagonistic-${viewpoint}` })),
    { stage: 'readiness', role: 'auditor', callId: 'readiness' },
  ];
  // Reject any unapproved stage before dispatching even the first child.
  for (const call of plan) {
    call.request = buildReviewRequest({ packet, constraints, stage: call.stage, instructions: instructionsByStage?.[call.stage] });
    checkRequest(call.request, approved);
    if (bytes(call.request.prompt) > MAX_ARGV_PROMPT_BYTES) throw new Error('Review prompt too large for the command line');
  }
  const calls = [];
  for (const { stage, role, viewpoint, callId, request } of plan) {
    try {
      checkRequest(request, approved);
      const argv = buildAgentArgs(policy, role, systemPromptPath, request.prompt, { profile: 'packet-only-review' });
      if (!argv.includes('--no-tools') || ['--tools', '--extension', '-e'].some(flag => argv.includes(flag))) {
        throw new Error('Invalid packet-only review argv');
      }
      const uniqueId = `${sessionId}-${callId}`;
      const resultStore = resultStoreFor?.(uniqueId);
      checkRequest(request, approved);
      const result = await runRoleImpl(policy, role, request.prompt, cwd, systemPromptPath,
        { profile: 'packet-only-review', signal, timeoutMs, resultStore,
          ...(ledger ? { ledger, dispatchKey: dispatchKeyFor(uniqueId) } : {}) });
      const counts = result?.toolCounts;
      if (result?.role !== role || result.model !== policy.roles[role].model ||
          result.thinking !== policy.roles[role].thinking || typeof result.text !== 'string' || !result.text.trim() ||
          (counts !== undefined && (counts === null || typeof counts !== 'object' || Array.isArray(counts) ||
            Object.values(counts).some(count => count !== 0)))) {
        throw new Error(`Invalid packet-only review ${stage} response`);
      }
      const summary = result.envelope === undefined ? undefined : /^Summary:[ \t]*(.*)$/m.exec(result.envelope)?.[1].trim();
      const singleLine = result.text.replace(/[\r\n\u0085\u2028\u2029]/g, ' ').trim();
      const omission = { fullBytes: bytes(result.text),
        ...(result.envelope === undefined ? {} : { envelopeBytes: bytes(result.envelope) }),
        clipped: result.envelope === undefined ? null : summary !== singleLine };
      calls.push(Object.freeze({ stage, role, ...(viewpoint === undefined ? {} : { viewpoint }),
        model: result.model, thinking: result.thinking, packetSha256: request.packetSha256,
        constraintsSha256: request.constraintsSha256, instructionsSha256: request.instructionsSha256,
        requestPromptSha256: sha256(request.prompt), systemPromptSha256, argv: Object.freeze(argv),
        toolCounts: freezeCopy(counts ?? {}), text: result.text, usage: freezeCopy(result.usage),
        ...(result.persisted ? { persistedRef: result.persisted.ref, persistedSha256: result.persisted.sha256 } : {}),
        omission: Object.freeze(omission) }));
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error(String(caught));
      error.stage = stage;
      error.partialCalls = Object.freeze([...calls]);
      throw error;
    }
  }
  const first = calls.at(-1).text.split(/[\r\n\u0085\u2028\u2029]+/).find(line => line.trim());
  const verdict = /^\s*(?:\*\*)?Readiness:[ \t]*(NO-GO(?![\w-])|GO(?![\w-]))(?:\*\*)?[ \t]*$/i.exec(first)?.[1].toUpperCase();
  if (!verdict) {
    const error = new Error('Readiness output lacks a first-line Readiness: GO or NO-GO verdict');
    error.stage = 'readiness'; error.partialCalls = Object.freeze([...calls]);
    throw error;
  }
  return Object.freeze({ advisory: true, authorizesImplementation: false, taskMarkerChange: false,
    readiness: verdict, omissionVerified: calls.every(call => call.omission.clipped !== null), calls: Object.freeze(calls) });
}
