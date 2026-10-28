import { runCouncilPerspective } from './council-perspective.mjs';
import { validateCouncilEvidence } from './council-evidence.mjs';
import { runRole } from './role-runner.mjs';

const CHILD_LIMIT_MS = 10 * 60 * 1000;
const SESSION_LIMIT_MS = 40 * 60 * 1000;
const MAX_RESPONSE_BYTES = 16 * 1024;
const VIEWPOINTS = ['strategist', 'coder', 'auditor'];

export async function runCouncilSession(policy, input, cwd, perspectivePrompt, synthesisPrompt, options = {}) {
  const { question, evidencePath, evidenceSha256 } = input ?? {};
  if (typeof question !== 'string' || !question.trim() || Buffer.byteLength(question) > 4096) {
    throw new Error('Council requires a bounded nonempty question');
  }
  if (!policy?.roles?.strategist || !policy.roles.coder || !policy.roles.auditor) {
    throw new Error('Council requires three configured viewpoints');
  }
  const evidence = validateCouncilEvidence(cwd, evidencePath, evidenceSha256);
  const { runPerspectiveImpl = runCouncilPerspective, runRoleImpl = runRole, signal, ...roleOptions } = options;
  if (signal?.aborted) throw new Error('Council session aborted');
  const deadline = Date.now() + SESSION_LIMIT_MS;
  const perspectives = [];
  const childOptions = () => {
    const remaining = deadline - Date.now();
    if (signal?.aborted || remaining <= 0) throw new Error('Council session aborted or exceeded 40 minutes');
    return { ...roleOptions, signal, timeoutMs: Math.min(CHILD_LIMIT_MS, remaining) };
  };
  for (const perspective of VIEWPOINTS) {
    validateCouncilEvidence(cwd, evidence.path, evidence.sha256);
    const result = await runPerspectiveImpl(policy,
      { perspective, question, evidencePath: evidence.path, evidenceSha256: evidence.sha256 },
      cwd, perspectivePrompt, childOptions());
    if (result.perspective !== perspective || result.evidenceSha256 !== evidence.sha256 ||
        result.model !== policy.roles[perspective].model || result.thinking !== policy.roles[perspective].thinking ||
        typeof result.text !== 'string' || !result.text.trim() ||
        Buffer.byteLength(result.text) > MAX_RESPONSE_BYTES) {
      throw new Error(`Invalid or oversized council ${perspective} response`);
    }
    validateCouncilEvidence(cwd, evidence.path, evidence.sha256);
    perspectives.push(result);
  }
  const collected = perspectives.map(p => `[${p.perspective}]\n${p.text}`).join('\n\n');
  const task = `Read the synthetic evidence file ${JSON.stringify(evidence.path)} (SHA-256 ${evidence.sha256}).\n` +
    `Question: ${question}\nCompare these three independent outputs, cite each by [strategist], [coder], [auditor], ` +
    `and explicitly state Disagreement: (or none, with reasons). Begin with Advisory: GO or Advisory: NO-GO; ` +
    `do not write, execute, authorize implementation or change a task marker.\n\n${collected}`;
  const synthesis = await runRoleImpl(policy, 'strategist', task, cwd, synthesisPrompt,
    { ...childOptions(), profile: 'council-read-only', requiredReadPath: evidence.path });
  validateCouncilEvidence(cwd, evidence.path, evidence.sha256);
  const verdict = /^\s*(?:\*\*)?Advisory:[ \t]*(NO-GO(?![\w-])|GO(?=(?:\*\*)?[ \t]*(?:\r?\n|$)))/i.exec(synthesis.text)?.[1].toUpperCase();
  if (synthesis.role !== 'strategist' || synthesis.model !== policy.roles.strategist.model ||
      synthesis.thinking !== policy.roles.strategist.thinking || typeof synthesis.text !== 'string' ||
      Buffer.byteLength(synthesis.text) > MAX_RESPONSE_BYTES ||
      !verdict || !/Disagreement\s*:/i.test(synthesis.text) ||
      !VIEWPOINTS.every(name => synthesis.text.includes(`[${name}]`))) {
    throw new Error('Council synthesis lacks bounded advisory verdict, three citations or disagreement');
  }
  return { evidenceSha256: evidence.sha256, perspectives, synthesis, verdict };
}
