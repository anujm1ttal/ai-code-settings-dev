import { randomUUID } from 'node:crypto';

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);
const DEFAULT_LIMITS = { maxActive: 2, maxRetained: 16, maxTaskBytes: 4096, maxTextBytes: 64 * 1024, maxErrorBytes: 2048 };

function truncateText(text, maxBytes) {
  const bytes = Buffer.from(text, 'utf8');
  if (bytes.length <= maxBytes) return { text, truncated: false };
  const kept = bytes.subarray(0, maxBytes).toString('utf8').replace(/\uFFFD+$/, '');
  return { text: `${kept}\n[truncated: ${bytes.length - Buffer.byteLength(kept)} bytes omitted]`, truncated: true };
}

/**
 * Session-local registry of detached jobs. Each admitted job owns its AbortController, so the
 * lifetime of a job is independent of the tool call that started it. `run(task, { signal })`
 * must settle only after its child process is cleaned up; a rejection that reports unconfirmed
 * cleanup quarantines the slot so capacity is never released for a possibly-live child.
 */
export function createJobManager({ run, ...overrides } = {}) {
  if (typeof run !== 'function') throw new TypeError('A job runner function is required');
  const limits = { ...DEFAULT_LIMITS, ...overrides };
  const jobs = new Map();
  const keys = new Map();
  let closed = false;
  let draining = false;

  const isTerminal = (job) => TERMINAL.has(job.state);
  const isActive = (job) => !isTerminal(job) || job.quarantined;
  const summary = (job) => ({ id: job.id, state: job.state, createdAt: job.createdAt,
    ...(job.quarantined ? { quarantined: true } : {}), ...(job.collected ? { collected: true } : {}) });
  const get = (id) => {
    const job = typeof id === 'string' ? jobs.get(id) : undefined;
    if (!job) throw new Error('Unknown or expired job id');
    return job;
  };

  function finish(job, outcome, value) {
    if (isTerminal(job)) return; // exactly one terminal transition
    if (job.discarded) {
      // No result is ever published for a discarded job, but an unconfirmed cleanup must still hold its slot.
      const reason = value instanceof Error ? value.message : String(value);
      if (outcome === 'err' && /cleanup unconfirmed/i.test(reason)) {
        job.error = truncateText(reason, limits.maxErrorBytes).text;
        job.quarantined = true;
        job.state = 'failed';
      }
      return;
    }
    if (outcome === 'ok') {
      const { text, truncated } = truncateText(String(value?.text ?? ''), limits.maxTextBytes);
      job.result = { text, truncated, model: value?.model, thinking: value?.thinking, usage: value?.usage ?? null,
        toolCounts: value?.toolCounts, successfulReads: value?.successfulReads };
      job.state = 'succeeded';
      return;
    }
    const message = value instanceof Error ? value.message : String(value);
    job.error = truncateText(message, limits.maxErrorBytes).text;
    job.quarantined = /cleanup unconfirmed/i.test(message);
    job.state = job.cancelRequested && !job.quarantined ? 'cancelled' : 'failed';
  }

  function start(task, { key, context } = {}) {
    if (closed) throw new Error('Job manager is closed');
    if (draining) throw new Error('Job manager is draining; retry after cancellation completes');
    if (key !== undefined && keys.has(key)) return summary(jobs.get(keys.get(key)));
    if (typeof task !== 'string' || !task.trim() || Buffer.byteLength(task) > limits.maxTaskBytes) {
      throw new Error(`Invalid task: a nonempty string of at most ${limits.maxTaskBytes} bytes is required`);
    }
    const active = [...jobs.values()].filter(isActive).length;
    if (active >= limits.maxActive) {
      const quarantined = [...jobs.values()].some((job) => job.quarantined);
      throw new Error(`Active job limit (${limits.maxActive}) reached${quarantined ? '; a quarantined job holds a slot' : ''}`);
    }
    if (jobs.size >= limits.maxRetained) {
      const evictable = [...jobs.values()].find((job) => isTerminal(job) && job.collected && !job.quarantined);
      if (!evictable) throw new Error(`Retained job limit (${limits.maxRetained}) reached: collect or cancel uncollected jobs`);
      remove(evictable);
    }
    const controller = new AbortController();
    const job = { id: `job-${randomUUID()}`, state: 'running', createdAt: new Date().toISOString(), controller,
      key, cancelRequested: false, quarantined: false, collected: false, usageReported: false };
    jobs.set(job.id, job);
    if (key !== undefined) keys.set(key, job.id);
    let pending;
    try { pending = Promise.resolve(run(task, { signal: controller.signal, context })); }
    catch (error) { pending = Promise.reject(error); }
    job.settled = pending.then((value) => finish(job, 'ok', value), (error) => finish(job, 'err', error));
    return summary(job);
  }

  function remove(job) {
    jobs.delete(job.id);
    if (job.key !== undefined) keys.delete(job.key);
  }

  function status(id) {
    return id === undefined ? [...jobs.values()].map(summary) : summary(get(id));
  }

  function collect(id) {
    const job = get(id);
    if (!isTerminal(job)) return { id: job.id, state: job.state, ready: false };
    job.collected = true;
    if (job.state !== 'succeeded') {
      return { id: job.id, state: job.state, ready: true, error: job.error, usage: null, usageUnknown: true,
        usageReported: false, ...(job.quarantined ? { quarantined: true } : {}) };
    }
    const first = !job.usageReported;
    job.usageReported = true;
    const { usage, ...rest } = job.result;
    return { id: job.id, state: job.state, ready: true, ...rest,
      ...(first ? { usage } : {}), usageReported: first };
  }

  function cancel(id) {
    const job = get(id);
    if (!isTerminal(job) && !job.cancelRequested) {
      job.cancelRequested = true;
      job.state = 'cancelling';
      job.controller.abort();
    }
    return summary(job);
  }

  async function drain({ keepQuarantined }) {
    const all = [...jobs.values()];
    for (const job of all) {
      job.discarded = true;
      if (!isTerminal(job) && !job.cancelRequested) {
        job.cancelRequested = true;
        job.controller.abort();
      }
    }
    await Promise.allSettled(all.map((job) => job.settled));
    for (const job of all) {
      if (keepQuarantined && job.quarantined) continue;
      remove(job);
    }
  }

  return {
    start, status, collect, cancel,
    // Session end, reload or replacement: cancel everything, wait for cleanup, refuse new work.
    async shutdown() { closed = true; await drain({ keepQuarantined: false }); },
    // Successful tree navigation: cancel and discard, then accept new jobs on the new branch.
    async discardAll() {
      draining = true;
      try { await drain({ keepQuarantined: true }); }
      finally { draining = false; }
    },
  };
}
