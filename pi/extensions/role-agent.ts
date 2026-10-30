import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { loadRolePolicy } from '../lib/role-policy.mjs';
import { runRole } from '../lib/role-runner.mjs';
import { runCouncilPerspective } from '../lib/council-perspective.mjs';
import { runCouncilSession } from '../lib/council-session.mjs';
import { registerExplorerJobs } from '../lib/explorer-jobs.mjs';
import { createExpensiveGate, withExpensiveGate } from '../lib/expensive-gate.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = process.env.PI_ROLE_POLICY_PATH;
if (!policyPath || !path.isAbsolute(policyPath)) {
  throw new Error('PI_ROLE_POLICY_PATH must point to an absolute private role-policy JSON file');
}
const policy = loadRolePolicy(policyPath);

export default function (pi: ExtensionAPI) {
  const gate = createExpensiveGate();
  // Synchronous strategist/auditor/council spend is in normal session usage, not the background job budget.
  pi.registerTool({
    name: 'pi_council',
    label: 'Pi council (advisory)',
    description: 'Collect three separate read-only perspectives and one read-only synthesis on identical synthetic evidence; no decision or task authority.',
    parameters: Type.Object({
      question: Type.String({ minLength: 1 }),
      evidencePath: Type.String({ description: 'Absolute synthetic evidence under Artifacts/Temp' }),
      evidenceSha256: Type.String({ description: 'SHA-256 of the captured evidence' }),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      const result = await withExpensiveGate(gate, 'council', () => runCouncilSession(policy, params, ctx.cwd,
        path.join(sourceRoot, 'agents', 'council-perspectives.md'),
        path.join(sourceRoot, 'agents', 'council-synthesis.md'),
        { signal }));
      const completeUsage = [...result.perspectives, result.synthesis].every(p => p.usage != null);
      return {
        content: [{ type: 'text', text: `Advisory ${result.verdict}\n\n${result.synthesis.text}` }],
        details: { verdict: result.verdict, evidenceSha256: result.evidenceSha256,
          perspectives: result.perspectives.map(({ perspective, model, thinking, text, usageCalls }) =>
            ({ perspective, model, thinking, text, usageCalls })),
          synthesisUsageCalls: result.synthesis.usageCalls, usageComplete: completeUsage,
          runtimeVerified: [...result.perspectives, result.synthesis].every(p => p.runtimeVerified === true) },
        ...(completeUsage ? { usage: {
          input: result.perspectives.reduce((sum, p) => sum + (p.usage?.input ?? 0), result.synthesis.usage?.input ?? 0),
          output: result.perspectives.reduce((sum, p) => sum + (p.usage?.output ?? 0), result.synthesis.usage?.output ?? 0),
          cacheRead: result.perspectives.reduce((sum, p) => sum + (p.usage?.cacheRead ?? 0), result.synthesis.usage?.cacheRead ?? 0),
          cacheWrite: result.perspectives.reduce((sum, p) => sum + (p.usage?.cacheWrite ?? 0), result.synthesis.usage?.cacheWrite ?? 0),
          totalTokens: result.perspectives.reduce((sum, p) => sum + (p.usage?.totalTokens ?? 0), result.synthesis.usage?.totalTokens ?? 0),
          cost: Object.fromEntries(['input', 'output', 'cacheRead', 'cacheWrite', 'total'].map(key =>
            [key, result.perspectives.reduce((sum, p) => sum + (p.usage?.cost?.[key] ?? 0), result.synthesis.usage?.cost?.[key] ?? 0)])),
        } } : {}),
      };
    },
  });

  pi.registerCommand('pi-roles', {
    description: 'Show configured pilot roles, models, thinking levels, and tool lists',
    handler: async (_args, ctx) => {
      const summary = Object.entries(policy.roles).map(([name, role]) =>
        `${name}: ${role.model} (${role.thinking}); tools: ${role.tools.join(', ')}`).join('\n');
      if (ctx.hasUI) ctx.ui.notify(summary, 'info');
    },
  });

  pi.registerTool({
    name: 'pi_role_agent',
    label: 'Pi role agent',
    description: 'Delegate a bounded task to a configured isolated strategist, coder, report-only auditor, read-only scribe, read-only explorer, or read-only council perspective. ' +
      'The role policy selects one explicitly configured model and thinking level; inspect the returned evidence.',
    parameters: Type.Object({
      role: Type.Union([Type.Literal('strategist'), Type.Literal('coder'), Type.Literal('auditor'), Type.Literal('scribe'), Type.Literal('explorer'), Type.Literal('council-perspective')]),
      task: Type.String({ minLength: 1, description: 'Specific bounded task and expected output' }),
      perspective: Type.Optional(Type.Union([Type.Literal('strategist'), Type.Literal('coder'), Type.Literal('auditor')])),
      evidencePath: Type.Optional(Type.String({ description: 'Council only: absolute synthetic evidence under project Artifacts/Temp' })),
      evidenceSha256: Type.Optional(Type.String({ description: 'Council only: one common SHA-256 for all perspective calls' })),
    }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const council = params.role === 'council-perspective';
      const promptPath = path.join(sourceRoot, 'agents', council ? 'council-perspectives.md' : `${params.role}.md`);
      const run = () => council
        ? runCouncilPerspective(policy, { perspective: params.perspective, question: params.task,
          evidencePath: params.evidencePath, evidenceSha256: params.evidenceSha256 }, ctx.cwd, promptPath,
          { signal })
        : runRole(policy, params.role, params.task, ctx.cwd, promptPath,
          { signal });
      const result = ['strategist', 'auditor', 'council-perspective'].includes(params.role)
        ? await withExpensiveGate(gate, params.role, run) : await run();
      return {
        content: [{ type: 'text', text: `${result.role} (${result.model}, ${result.thinking})\n\n${result.text}` }],
        details: { role: result.role, model: result.model, thinking: result.thinking,
          ...(result.toolCounts !== undefined ? { toolCounts: result.toolCounts } : {}),
          ...(result.successfulReads !== undefined ? { successfulReads: result.successfulReads } : {}),
          usageCalls: result.usageCalls, usageComplete: result.usage != null, runtimeVerified: result.runtimeVerified,
          ...(council ? { perspective: result.perspective, evidenceSha256: result.evidenceSha256 } : {}) },
        ...(result.usage ? { usage: result.usage } : {}),
      };
    },
  });

  // Detached read-only role jobs, registered when an eligible role is configured.
  registerExplorerJobs(pi, { Type, policy, gate,
    promptPaths: Object.fromEntries(['explorer', 'strategist', 'auditor'].map(role =>
      [role, path.join(sourceRoot, 'agents', `${role}.md`)])) });
}
