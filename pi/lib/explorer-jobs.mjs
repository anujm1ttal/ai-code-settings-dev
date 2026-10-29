import { accessSync, constants } from 'node:fs';
import { createJobManager } from './job-manager.mjs';
import { runRole } from './role-runner.mjs';

const ACTIONS = ['start', 'status', 'collect', 'cancel'];
const ROLES = ['explorer', 'strategist', 'auditor'];
const omitEmpty = (value) => typeof value === 'string' && !value.trim() ? undefined : value;

function describeCollected(out) {
  if (!out.ready) return `Job ${out.id} is ${out.state}; not ready. Call collect again later.`;
  if (out.state !== 'succeeded') {
    return `Job ${out.id} ${out.state}: ${out.error ?? 'no details'}${out.quarantined ? ' (cleanup unconfirmed; its slot stays occupied)' : ''}\n` +
      'Usage for this job is unknown and was not added to session totals.';
  }
  return `${out.role} (${out.model}, ${out.thinking}) job ${out.id}\n\n${out.text}` +
    (out.truncated ? '\n\n(Result truncated to the retained limit.)' : '') +
    (out.usageReported ? '' : '\n\n(Usage for this job was already reported on first collection.)');
}

/**
 * Registers the detached role job tool and its two lifecycle hooks. The manager is
 * created per call, i.e. per extension runtime, so a reload or session replacement never shares jobs.
 * Jobs survive ordinary run boundaries; only session shutdown and a successful tree navigation end them.
 */
export function registerExplorerJobs(pi, { Type, policy, promptPath, promptPaths, invocation,
  runRoleImpl = runRole, accessImpl = accessSync }) {
  if (!ROLES.some((role) => Object.hasOwn(policy?.roles ?? {}, role) && policy.roles[role])) return undefined;
  const paths = { ...promptPaths, explorer: promptPaths?.explorer ?? promptPath };
  const jobs = createJobManager({
    run: (task, { signal, context, role }) =>
      runRoleImpl(policy, role, task, context.cwd, paths[role], { signal, invocation }),
  });

  pi.registerTool({
    name: 'pi_explorer_job',
    label: 'Pi role job (detached, read-only)',
    description: 'Start, inspect, collect or cancel a detached explorer or strategist job (read, grep, find, ls only). ' +
      'Auditor jobs are not enabled until evidence support is added. ' +
      'start returns a job id immediately; the job keeps running while you continue. At most two jobs run at once; ' +
      'a third start is rejected. Results are held in memory by the job manager, and are discarded on session end or ' +
      'tree navigation. Usage is added to session totals when a result is first collected; uncollected or failed ' +
      'jobs may be missing from those totals. Reads are not confined to the project: use trusted, non-secret projects.',
    parameters: Type.Object({
      action: Type.Union(ACTIONS.map((action) => Type.Literal(action))),
      role: Type.Optional(Type.String({ description: 'start only: explorer (default), strategist, or auditor (not enabled yet)' })),
      task: Type.Optional(Type.String({ description: 'start only: bounded read-only task (max 4 KiB)' })),
      jobId: Type.Optional(Type.String({ description: 'status (optional), collect, cancel: the id returned by start' })),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const action = params?.action;
      const task = omitEmpty(params?.task);
      const jobId = omitEmpty(params?.jobId);
      const role = omitEmpty(params?.role) ?? 'explorer';
      if (!ACTIONS.includes(action)) throw new Error(`Unknown action; expected one of ${ACTIONS.join(', ')}`);
      if (action === 'start') {
        if (signal?.aborted) throw new Error('Job start aborted before admission');
        if (typeof task !== 'string') throw new Error('start requires a task');
        if (!ROLES.includes(role)) throw new Error('Unknown job role');
        if (role === 'auditor') throw new Error('auditor jobs are not enabled until evidence support is added');
        if (!Object.hasOwn(policy.roles, role) || !policy.roles[role]) throw new Error(`Job role ${role} is not configured`);
        if (typeof paths[role] !== 'string' || !paths[role].trim()) throw new Error(`Prompt path for ${role} is missing`);
        accessImpl(paths[role], constants.R_OK);
        // Plain value only: the tool context must not be retained by a detached job.
        const job = jobs.start(task, { key: toolCallId, context: { cwd: ctx.cwd }, role });
        return { content: [{ type: 'text', text: `Started ${job.id} (${job.state}). Continue working; call collect with this id later.` }],
          details: { action, job, limits: { maxActive: 2, retained: 16, taskBytes: 4096, resultBytes: 65536 } } };
      }
      if (action === 'status') {
        const status = jobs.status(jobId);
        const text = Array.isArray(status)
          ? (status.length ? status.map((job) => `${job.id}: ${job.state}`).join('\n') : 'No jobs.')
          : `${status.id}: ${status.state}`;
        return { content: [{ type: 'text', text }], details: { action, ...(Array.isArray(status) ? { jobs: status } : { job: status }) } };
      }
      if (typeof jobId !== 'string') throw new Error(`${action} requires a jobId`);
      if (action === 'cancel') {
        const job = jobs.cancel(jobId);
        return { content: [{ type: 'text', text: `${job.id}: ${job.state}` }], details: { action, job } };
      }
      const out = jobs.collect(jobId);
      const { usage, text: _text, ...details } = out;
      return { content: [{ type: 'text', text: describeCollected(out) }],
        details: { action, ...details }, ...(usage ? { usage } : {}) };
    },
  });

  pi.on('session_shutdown', async () => { await jobs.shutdown(); });
  pi.on('session_tree', async () => { await jobs.discardAll(); });
  return jobs;
}
