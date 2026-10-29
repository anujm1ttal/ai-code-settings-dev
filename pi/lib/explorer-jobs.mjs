import { createJobManager } from './job-manager.mjs';
import { runRole } from './role-runner.mjs';

const ACTIONS = ['start', 'status', 'collect', 'cancel'];

function describeCollected(out) {
  if (!out.ready) return `Job ${out.id} is ${out.state}; not ready. Call collect again later.`;
  if (out.state !== 'succeeded') {
    return `Job ${out.id} ${out.state}: ${out.error ?? 'no details'}${out.quarantined ? ' (cleanup unconfirmed; its slot stays occupied)' : ''}\n` +
      'Usage for this job is unknown and was not added to session totals.';
  }
  return `explorer (${out.model}, ${out.thinking}) job ${out.id}\n\n${out.text}` +
    (out.truncated ? '\n\n(Result truncated to the retained limit.)' : '') +
    (out.usageReported ? '' : '\n\n(Usage for this job was already reported on first collection.)');
}

/**
 * Registers the detached read-only explorer job tool and its two lifecycle hooks. The manager is
 * created per call, i.e. per extension runtime, so a reload or session replacement never shares jobs.
 * Jobs survive ordinary run boundaries; only session shutdown and a successful tree navigation end them.
 */
export function registerExplorerJobs(pi, { Type, policy, promptPath, invocation, runRoleImpl = runRole }) {
  if (!policy?.roles?.explorer) return undefined;
  const jobs = createJobManager({
    run: (task, { signal, context }) =>
      runRoleImpl(policy, 'explorer', task, context.cwd, promptPath, { signal, invocation }),
  });

  pi.registerTool({
    name: 'pi_explorer_job',
    label: 'Pi explorer job (detached, read-only)',
    description: 'Start, inspect, collect or cancel a detached read-only explorer job (read, grep, find, ls only). ' +
      'start returns a job id immediately; the job keeps running while you continue. At most two jobs run at once; ' +
      'a third start is rejected. Results are held in memory by the job manager, and are discarded on session end or ' +
      'tree navigation. Usage is added to session totals when a result is first collected; uncollected or failed ' +
      'jobs may be missing from those totals. Reads are not confined to the project: use trusted, non-secret projects.',
    parameters: Type.Object({
      action: Type.Union(ACTIONS.map((action) => Type.Literal(action))),
      task: Type.Optional(Type.String({ description: 'start only: bounded read-only exploration task (max 4 KiB)' })),
      jobId: Type.Optional(Type.String({ description: 'status (optional), collect, cancel: the id returned by start' })),
    }),
    async execute(toolCallId, params, signal, _onUpdate, ctx) {
      const action = params?.action;
      if (!ACTIONS.includes(action)) throw new Error(`Unknown action; expected one of ${ACTIONS.join(', ')}`);
      if (action === 'start') {
        if (signal?.aborted) throw new Error('Job start aborted before admission');
        if (typeof params.task !== 'string') throw new Error('start requires a task');
        // Plain value only: the tool context must not be retained by a detached job.
        const job = jobs.start(params.task, { key: toolCallId, context: { cwd: ctx.cwd } });
        return { content: [{ type: 'text', text: `Started ${job.id} (${job.state}). Continue working; call collect with this id later.` }],
          details: { action, job, limits: { maxActive: 2, retained: 16, taskBytes: 4096, resultBytes: 65536 } } };
      }
      if (action === 'status') {
        const status = jobs.status(params.jobId);
        const text = Array.isArray(status)
          ? (status.length ? status.map((job) => `${job.id}: ${job.state}`).join('\n') : 'No jobs.')
          : `${status.id}: ${status.state}`;
        return { content: [{ type: 'text', text }], details: { action, ...(Array.isArray(status) ? { jobs: status } : { job: status }) } };
      }
      if (typeof params.jobId !== 'string' || !params.jobId) throw new Error(`${action} requires a jobId`);
      if (action === 'cancel') {
        const job = jobs.cancel(params.jobId);
        return { content: [{ type: 'text', text: `${job.id}: ${job.state}` }], details: { action, job } };
      }
      const out = jobs.collect(params.jobId);
      const { usage, text: _text, ...details } = out;
      return { content: [{ type: 'text', text: describeCollected(out) }],
        details: { action, ...details }, ...(usage ? { usage } : {}) };
    },
  });

  pi.on('session_shutdown', async () => { await jobs.shutdown(); });
  pi.on('session_tree', async () => { await jobs.discardAll(); });
  return jobs;
}
