import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { loadRolePolicy } from '../lib/role-policy.mjs';
import { runRole } from '../lib/role-runner.mjs';
import { runCouncilPerspective } from '../lib/council-perspective.mjs';
import { runCouncilSession } from '../lib/council-session.mjs';
import { registerExplorerJobs } from '../lib/explorer-jobs.mjs';
import { createExpensiveGate, withExpensiveGate } from '../lib/expensive-gate.mjs';
import { prepareResultDir, buildEnvelope, buildIncompleteEnvelope } from '../lib/result-contract.mjs';
import { getActiveTaskUsage } from '../lib/task-usage.mjs';
import { withJobAccounting, currentJobAccounting } from '../lib/job-manager.mjs';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = process.env.PI_ROLE_POLICY_PATH;
if (!policyPath || !path.isAbsolute(policyPath)) {
  throw new Error('PI_ROLE_POLICY_PATH must point to an absolute private role-policy JSON file');
}
const policy = loadRolePolicy(policyPath);

export default function (pi: ExtensionAPI) {
  const gate = createExpensiveGate();
  const ledgerFor = (ctx) => typeof getActiveTaskUsage === 'function'
    ? getActiveTaskUsage(ctx.cwd, ctx.sessionManager?.getSessionId?.()) : undefined;
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const dispatchKeyFor = (dispatchId) => digest(Buffer.from(JSON.stringify(['dispatch', dispatchId])));
  async function accounted(ctx, toolCallId, dispatchId, run) {
    const ledger = ledgerFor(ctx);
    if (!ledger) return run({});
    const sessionId = ctx.sessionManager?.getSessionId?.();
    const { dispatchKey } = ledger.admit({ dispatchId, toolCallId: JSON.stringify([sessionId ?? null, String(toolCallId)]) });
    const accountingCursor: { next: number; lastStop?: string } = { next: 0 };
    let state = 'failed';
    try {
      const value = await run({ ledger, dispatchKey, accountingCursor });
      state = 'succeeded';
      return value;
    } catch (error) {
      if (ledger.isEnabled?.() === false) throw error;
      // Compatibility for injected runners that return readings only on failure. Real runners
      // increment the shared cursor as each call arrives, so never replay their in-memory rows.
      if (accountingCursor.next === 0) {
        const groups = [...(Array.isArray(error?.perspectives) ? error.perspectives : []), error];
        for (const group of groups) for (const call of Array.isArray(group?.usageCalls) ? group.usageCalls : []) {
          ledger.record({ type: 'child', dispatchKey, callOrdinal: accountingCursor.next++,
            model: policy.roles[group?.perspective]?.model, usage: call.usage, stopReason: call.stopReason });
          accountingCursor.lastStop = call.stopReason;
        }
      }
      if (!['error', 'aborted'].includes(accountingCursor.lastStop)) {
        ledger.record({ type: 'child', dispatchKey, callOrdinal: accountingCursor.next++, usage: null, stopReason: 'error' });
      }
      throw error;
    } finally {
      if (ledger.isEnabled?.() !== false) {
        const bytes = Buffer.from(JSON.stringify({ version: 1, dispatchId, state }));
        ledger.reconcile({ dispatchId, bytes, sha256: digest(bytes) });
      }
    }
  }
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
      const dispatchId = `council-${randomUUID()}`;
      const result = await withExpensiveGate(gate, 'council', () => accounted(ctx, _id, dispatchId, accounting =>
        runCouncilSession(policy, params, ctx.cwd,
          path.join(sourceRoot, 'agents', 'council-perspectives.md'),
          path.join(sourceRoot, 'agents', 'council-synthesis.md'),
          { signal, ...accounting })));
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
      'Auditor is report-only by default; the separate record profile records one parent-bound settled verdict. ' +
      'The role policy selects one explicitly configured model and thinking level; inspect the returned evidence.',
    parameters: Type.Object({
      role: Type.Union([Type.Literal('strategist'), Type.Literal('coder'), Type.Literal('auditor'), Type.Literal('scribe'), Type.Literal('explorer'), Type.Literal('council-perspective')]),
      task: Type.String({ minLength: 1, description: 'Specific bounded task and expected output' }),
      profile: Type.Optional(Type.Union([Type.Literal('read-only'), Type.Literal('record')])),
      todo: Type.Optional(Type.String({ minLength: 1, description: 'Record profile only.' })),
      taskId: Type.Optional(Type.String({ minLength: 1, description: 'Record profile only.' })),
      taskSha256: Type.Optional(Type.String({ minLength: 1, description: 'Record profile only.' })),
      verdictRef: Type.Optional(Type.String({ minLength: 1, description: 'Record profile only.' })),
      verdictSha256: Type.Optional(Type.String({ minLength: 1, description: 'Record profile only.' })),
      manifestPath: Type.Optional(Type.String({ minLength: 1, description: 'Record profile only.' })),
      manifestSha256: Type.Optional(Type.String({ minLength: 1, description: 'Record profile only.' })),
      perspective: Type.Optional(Type.Union([Type.Literal('strategist'), Type.Literal('coder'), Type.Literal('auditor')])),
      evidencePath: Type.Optional(Type.String({ description: 'Council only: absolute synthetic evidence under project Artifacts/Temp' })),
      evidenceSha256: Type.Optional(Type.String({ description: 'Council only: one common SHA-256 for all perspective calls' })),
    }, { additionalProperties: false }),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const council = params.role === 'council-perspective';
      if (params.profile !== undefined && !(
        (params.profile === 'read-only' && ['strategist', 'coder', 'auditor', 'scribe'].includes(params.role)) ||
        (params.profile === 'record' && params.role === 'auditor')
      )) throw new Error('Invalid role profile');
      const recordKeys = ['todo', 'taskId', 'taskSha256', 'verdictRef', 'verdictSha256', 'manifestPath', 'manifestSha256'];
      if (Object.hasOwn(params, 'date')) {
        throw new Error('Invalid record binding parameters: caller-supplied date is not allowed');
      }
      if (params.profile === 'record') {
        const missing = recordKeys.filter(key => typeof params[key] !== 'string' || !params[key]);
        if (missing.length) throw new Error(`Invalid record binding parameters: profile "record" requires non-empty ${missing.join(', ')}`);
      } else {
        const present = recordKeys.filter(key => Object.hasOwn(params, key));
        if (present.length) {
          const [verb, pronoun] = present.length === 1 ? ['is', 'it'] : ['are', 'them'];
          throw new Error(`Invalid record binding parameters: ${present.join(', ')} ${verb} record-only; omit ${pronoun} unless profile is "record"`);
        }
      }
      let recordBinding;
      if (params.profile === 'record') {
        const now = new Date();
        const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        recordBinding = { ...Object.fromEntries(recordKeys.map(key => [key, params[key]])), date };
      }
      const promptPath = path.join(sourceRoot, 'agents', council ? 'council-perspectives.md' : `${params.role}.md`);
      const identity = { dispatchId: `role-${randomUUID()}`, role: (council ? params.perspective : params.role) ?? params.role };
      let resultStore;
      try { resultStore = { dir: prepareResultDir(ctx.cwd), dispatchId: identity.dispatchId, meta: { role: identity.role } }; }
      catch {
        const envelope = buildIncompleteEnvelope({ identity, reason: 'Project result store unavailable.' });
        throw new Error(envelope);
      }
      const run = () => accounted(ctx, _toolCallId, identity.dispatchId, accounting => council
        ? runCouncilPerspective(policy, { perspective: params.perspective, question: params.task,
          evidencePath: params.evidencePath, evidenceSha256: params.evidenceSha256 }, ctx.cwd, promptPath,
          { signal, resultStore, ...accounting })
        : runRole(policy, params.role, params.task, ctx.cwd, promptPath,
          { signal, resultStore, profile: params.profile, ...(recordBinding ? { recordBinding } : {}), ...accounting }));
      let result;
      try {
        result = ['strategist', 'auditor', 'council-perspective'].includes(params.role)
          ? await withExpensiveGate(gate, params.role, run) : await run();
      } catch (caught) {
        const error = caught instanceof Error || Object.prototype.toString.call(caught) === '[object Error]'
          ? caught : new Error('Role dispatch failed');
        try { error.envelope = buildIncompleteEnvelope({ identity, persisted: error.persisted,
          partialText: error.partialText, reason: error.message }); }
        catch { error.envelope = buildIncompleteEnvelope({ identity, reason: 'Result receipt unavailable or invalid.',
          referenceUnavailable: Boolean(error.persisted) }); }
        error.message = error.envelope;
        throw error;
      }
      let envelope;
      try { envelope = buildEnvelope({ status: 'COMPLETE', persisted: result.persisted, identity,
        summarySource: result.text, next: 'Inspect the persisted result.' }); }
      catch { envelope = buildIncompleteEnvelope({ identity, reason: 'Result receipt missing, invalid, or unavailable.' }); }
      // Per-call readings stay on runner results/errors (and detached jobs in memory), not in sync result files.
      // Expose only fixed numeric aggregate fields to the model; unknown usage remains explicitly incomplete.
      const numericFields = (source, keys) => Object.fromEntries(keys.flatMap(key =>
        typeof source?.[key] === 'number' && Number.isFinite(source[key]) && source[key] >= 0 ? [[key, source[key]]] : []));
      const usageSummary = { complete: result.usage != null,
        ...numericFields(result.usage, ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens', 'reasoning', 'cacheWrite1h']),
        ...(result.usage?.cost ? { cost: numericFields(result.usage.cost, ['input', 'output', 'cacheRead', 'cacheWrite', 'total']) } : {}) };
      return {
        content: [{ type: 'text', text: envelope }],
        details: { role: result.role, model: result.model, thinking: result.thinking,
          ...(result.toolCounts !== undefined ? { toolCounts: result.toolCounts } : {}),
          ...(result.successfulReads !== undefined ? { successfulReads: result.successfulReads } : {}),
          usage: usageSummary, usageComplete: result.usage != null, runtimeVerified: result.runtimeVerified,
          ...(council ? { perspective: result.perspective, evidenceSha256: result.evidenceSha256 } : {}) },
        ...(result.usage ? { usage: result.usage } : {}),
      };
    },
  });

  // Detached read-only role jobs, registered when an eligible role is configured.
  const jobPi = new Proxy(pi, { get(target, property) {
    if (property === 'registerTool') return (tool) => target.registerTool({ ...tool,
      execute: (id, params, signal, onUpdate, ctx) => withJobAccounting(ledgerFor(ctx),
        () => tool.execute(id, params, signal, onUpdate, ctx), id) });
    return Reflect.get(target, property, target);
  } });
  {
    const pi = jobPi;
    registerExplorerJobs(pi, { Type, policy, gate,
      runRoleImpl: (rolePolicy, role, task, cwd, promptPath, options) => {
        const ledger = currentJobAccounting();
        return runRole(rolePolicy, role, task, cwd, promptPath,
          ledger && options.dispatchId ? { ...options, ledger, dispatchKey: dispatchKeyFor(options.dispatchId) } : options);
      },
      promptPaths: Object.fromEntries(['explorer', 'strategist', 'auditor'].map(role =>
        [role, path.join(sourceRoot, 'agents', `${role}.md`)])) });
  }
}
