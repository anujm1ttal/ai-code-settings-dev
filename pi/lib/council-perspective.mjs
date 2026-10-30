import { validateCouncilEvidence } from './council-evidence.mjs';
import { runRole } from './role-runner.mjs';
import { buildIncompleteEnvelope } from './result-contract.mjs';

const VIEWPOINTS = Object.freeze({
  strategist: 'Evaluate value, scope and dependency tradeoffs. Cite the evidence; state uncertainty.',
  coder: 'Evaluate implementation feasibility, failure modes and minimal tests. Do not modify code.',
  auditor: 'Challenge unsupported claims, security boundaries and missing controls. Return findings only.',
});

export async function runCouncilPerspective(policy, input, cwd, promptPath, options = {}) {
  const { perspective, question, evidencePath, evidenceSha256 } = input ?? {};
  if (!Object.hasOwn(VIEWPOINTS, perspective) || !policy.roles[perspective]) {
    throw new Error('Invalid council perspective viewpoint');
  }
  if (typeof question !== 'string' || !question.trim()) throw new Error('Council viewpoint question is required');
  const evidence = validateCouncilEvidence(cwd, evidencePath, evidenceSha256);
  const task = `Council ${perspective} perspective only. ${VIEWPOINTS[perspective]}\n` +
    `Question: ${question}\nRead the same synthetic evidence file ${JSON.stringify(evidence.path)} ` +
    `with SHA-256 ${evidence.sha256}; cite it and do not write or run shell.`;
  const { runRoleImpl = runRole, ...roleOptions } = options;
  const result = await runRoleImpl(policy, perspective, task, cwd, promptPath,
    { ...roleOptions, profile: 'council-read-only', requiredReadPath: evidence.path });
  try { validateCouncilEvidence(cwd, evidence.path, evidence.sha256); }
  catch (error) {
    error.message = `INCOMPLETE: council evidence revalidation failed: ${error.message}`;
    for (const key of ['persisted', 'usage', 'usageCalls', 'runtimeVerified', 'model', 'thinking', 'toolCounts', 'successfulReads']) {
      if (result[key] !== undefined) error[key] = result[key];
    }
    if (roleOptions.resultStore) {
      const identity = { dispatchId: roleOptions.resultStore.dispatchId, role: perspective };
      try { error.envelope = buildIncompleteEnvelope({ identity, persisted: result.persisted, reason: error.message, partialText: result.text }); }
      catch { error.envelope = buildIncompleteEnvelope({ identity, reason: error.message, referenceUnavailable: Boolean(result.persisted) }); }
    }
    throw error;
  }
  return { ...result, perspective, evidenceSha256: evidence.sha256 };
}
