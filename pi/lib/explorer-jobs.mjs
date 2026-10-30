import { accessSync, constants } from 'node:fs';
import { createJobManager } from './job-manager.mjs';
import { createJobBudget } from './job-budget.mjs';
import { validateAuditManifest, recheckAuditManifest } from './audit-evidence.mjs';
import { runRole } from './role-runner.mjs';

const ACTIONS = ['start', 'status', 'collect', 'cancel'];
const ROLES = ['explorer', 'strategist', 'auditor'];
const omitEmpty = (value) => typeof value === 'string' && !value.trim() ? undefined : value;

function describeCollected(out) {
  if (!out.ready) return `Job ${out.id} is ${out.state}; not ready. Call collect again later.`;
  if (out.envelope) return out.envelope;
  if (out.recoveryOffset !== undefined) return out.text;
  const cost = out.cost ? (out.cost.unknown ? '\nCost: unknown, remains reserved' :
    `\nCost: $${out.cost.usd.toFixed(4)}${out.cost.overBudget ? ' (OVER the per-job budget)' : ''}`) : '';
  if (out.state !== 'succeeded') {
    return `Job ${out.id} ${out.state}: ${out.error ?? 'no details'}${out.quarantined ? ' (cleanup unconfirmed; its slot stays occupied)' : ''}\n` +
      'Usage for this job is unknown and was not added to session totals.' + cost;
  }
  const warning = out.evidence?.status === 'INCOMPLETE'
    ? `INCOMPLETE: evidence changed or became invalid after this job started (${out.evidence.reason}). This output does not apply to current evidence.\n\n` : '';
  return warning + `${out.role} (${out.model}, ${out.thinking}) job ${out.id}\n\n${out.text}` +
    (out.truncated ? '\n\n(Result truncated to the retained limit.)' : '') +
    (out.usageReported ? '' : '\n\n(Usage for this job was already reported on first collection.)') + cost;
}

/**
 * Registers the detached role job tool and its session lifecycle hooks. The manager is
 * created per call, i.e. per extension runtime, so a reload or session replacement never shares jobs.
 * Jobs survive ordinary run boundaries; only session shutdown and a successful tree navigation end them.
 */
export function registerExplorerJobs(pi, { Type, policy, promptPath, promptPaths, invocation,
  runRoleImpl = runRole, accessImpl = accessSync, gate }) {
  if (!ROLES.some((role) => Object.hasOwn(policy?.roles ?? {}, role) && policy.roles[role])) return undefined;
  const paths = { ...promptPaths, explorer: promptPaths?.explorer ?? promptPath };
  const budget = policy.jobBudget ? createJobBudget({ ...policy.jobBudget, modelOf: role => policy.roles[role].model }) : undefined;
  let notify = null;
  const jobs = createJobManager({
    gate, budget,
    onTerminal: ({ id, role, state }) => notify?.(`Job ${id} (${role}) ${state}. Use pi_explorer_job collect with this id.`),
    run: (task, { signal, context, role, resultStore, dispatchId }) => {
      const requiredReadPath = context.manifestPath;
      const childTask = requiredReadPath
        ? `${task}\n\nEvidence manifest (read it first, then the captures it lists): ${requiredReadPath}` : task;
      return runRoleImpl(policy, role, childTask, context.cwd, paths[role],
        { signal, invocation, resultStore, dispatchId, ...(requiredReadPath ? { requiredReadPath } : {}) });
    },
  });

  pi.registerTool({
    name: 'pi_explorer_job',
    label: 'Pi role job (detached, read-only)',
    description: 'Start, inspect, collect or cancel a detached explorer, strategist or auditor job (read, grep, find, ls only). ' +
      'Auditor jobs need evidencePath and evidenceSha256. Results are advisory; a collected verdict is never a task completion. ' +
      'start returns a job id immediately; the job keeps running while you continue. At most two jobs run at once; ' +
      'a third start is rejected. In-memory job records are discarded on session end or tree navigation; ' +
      'tree navigation can retain recovery or quarantined records. Successfully persisted result and settlement files are retained. ' +
      'Session totals receive usage on first collect; ' +
      'uncollected or failed jobs may be missing from those totals. Task accounting is separate from session totals and tracks ' +
      'admitted work and settlements independently of collection, with unknown usage where necessary. ' +
      'The user sees a metadata-only notification when a job finishes; it never starts a model turn. ' +
      'This notification is best-effort and appears only with an attached UI; headless and print modes are silent, while RPC may forward it to a client. ' +
      'Reads are not confined to the project: use trusted, non-secret projects.',
    parameters: Type.Object({
      action: Type.Union(ACTIONS.map((action) => Type.Literal(action))),
      role: Type.Optional(Type.String({ description: 'start only: explorer (default), strategist, or auditor' })),
      task: Type.Optional(Type.String({ description: 'start only: bounded read-only task (max 4 KiB)' })),
      evidencePath: Type.Optional(Type.String({ description: 'auditor start: absolute evidence manifest path' })),
      evidenceSha256: Type.Optional(Type.String({ description: 'auditor start: lowercase manifest SHA-256' })),
      jobId: Type.Optional(Type.String({ description: 'status (optional), collect, cancel: the id returned by start' })),
      recoveryOffset: Type.Optional(Type.Integer({ minimum: 0, description: 'collect only: recover retained partial text, starting at this code point offset; use nextRecoveryOffset for subsequent pages' })),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const action = params?.action;
      const task = omitEmpty(params?.task);
      const jobId = omitEmpty(params?.jobId);
      const role = omitEmpty(params?.role) ?? 'explorer';
      const evidencePath = omitEmpty(params?.evidencePath);
      const evidenceSha256 = omitEmpty(params?.evidenceSha256);
      if (!ACTIONS.includes(action)) throw new Error(`Unknown action; expected one of ${ACTIONS.join(', ')}`);
      if (action === 'start') {
        const existing = jobs.lookup(toolCallId);
        const started = (job) => ({ content: [{ type: 'text', text: `Started ${job.id} (${job.state}). Continue working; call collect with this id later.` }],
          details: { action, job, limits: { maxActive: 2, retained: 16, taskBytes: 4096, resultBytes: 65536 } } });
        if (existing) return started(existing);
        if (signal?.aborted) throw new Error('Job start aborted before admission');
        if (typeof task !== 'string') throw new Error('start requires a task');
        if (!ROLES.includes(role)) throw new Error('Unknown job role');
        if (!Object.hasOwn(policy.roles, role) || !policy.roles[role]) throw new Error(`Job role ${role} is not configured`);
        if (typeof paths[role] !== 'string' || !paths[role].trim()) throw new Error(`Prompt path for ${role} is missing`);
        accessImpl(paths[role], constants.R_OK);
        if (role !== 'auditor' && (evidencePath !== undefined || evidenceSha256 !== undefined)) {
          throw new Error('evidence parameters are auditor-only');
        }
        let snapshot;
        if (role === 'auditor') {
          if (evidencePath === undefined || evidenceSha256 === undefined) throw new Error('Auditor requires evidencePath and evidenceSha256');
          snapshot = validateAuditManifest(ctx.cwd, evidencePath, evidenceSha256);
        }
        // Plain value only: the tool context must not be retained by a detached job.
        const job = jobs.start(task, { key: toolCallId, context: { cwd: ctx.cwd,
          ...(snapshot ? { manifestPath: snapshot.manifestPath } : {}) }, role,
          ...(snapshot ? { evidence: { verify: () => recheckAuditManifest(snapshot) } } : {}) });
        return started(job);
      }
      if (action === 'status') {
        const status = jobs.status(jobId);
        let text = Array.isArray(status)
          ? (status.length ? status.map((job) => `${job.id}: ${job.state}`).join('\n') : 'No jobs.')
          : `${status.id}: ${status.state}`;
        const budget = Array.isArray(status) ? jobs.budgetSnapshot() : undefined;
        if (budget) text += `\nBudget: spent $${budget.spentUsd.toFixed(4)}, reserved $${budget.reservedUsd.toFixed(4)}, remaining $${budget.remainingUsd.toFixed(4)}`;
        return { content: [{ type: 'text', text }], details: { action, ...(Array.isArray(status) ? { jobs: status } : { job: status }),
          ...(budget ? { budget } : {}) } };
      }
      if (typeof jobId !== 'string') throw new Error(`${action} requires a jobId`);
      if (action === 'cancel') {
        const job = jobs.cancel(jobId);
        return { content: [{ type: 'text', text: `${job.id}: ${job.state}` }], details: { action, job } };
      }
      const out = jobs.collect(jobId, { recoveryOffset: params?.recoveryOffset });
      const { usage, text: _text, envelope: _envelope, error: _error, usageCalls: _usageCalls, ...details } = out;
      return { content: [{ type: 'text', text: describeCollected(out) }],
        details: { action, ...details }, ...(usage ? { usage } : {}) };
    },
  });

  pi.on('session_start', (_event, ctx) => {
    const ui = ctx.hasUI ? ctx.ui : null;
    notify = ui ? (text) => {
      const result = ui.notify(text, 'info');
      if (result && typeof result.then === 'function') result.then(undefined, () => {});
    } : null;
  });
  pi.on('session_shutdown', async () => { notify = null; await jobs.shutdown(); });
  pi.on('session_tree', async () => { await jobs.discardAll(); });
  return jobs;
}
