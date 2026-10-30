import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prepareResultDir, checkedDir, verifyPersisted, buildEnvelope, buildIncompleteEnvelope } from './result-contract.mjs';

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
 * Recovery jobs remain in this session registry through drains and cannot be evicted; they
 * consume retained capacity until the registry is lost, so recover partial text promptly.
 */
export function createJobManager({ run, gate, budget, onTerminal, expensiveRoles = ['strategist', 'auditor'], ...overrides } = {}) {
  if (typeof run !== 'function') throw new TypeError('A job runner function is required');
  const limits = { ...DEFAULT_LIMITS, ...overrides };
  const jobs = new Map();
  const keys = new Map();
  let closed = false;
  let draining = false;

  const isTerminal = (job) => TERMINAL.has(job.state);
  const isActive = (job) => !isTerminal(job) || job.quarantined;
  const summary = (job) => ({ id: job.id, state: job.state, role: job.role, createdAt: job.createdAt,
    ...(job.quarantined ? { quarantined: true } : {}), ...(job.collected ? { collected: true } : {}) });
  const get = (id) => {
    const job = typeof id === 'string' ? jobs.get(id) : undefined;
    if (!job) throw new Error('Unknown or expired job id');
    return job;
  };

  function verifyEvidence(job) {
    try {
      job.evidence.verify();
      job.evidenceStatus ??= 'VERIFIED';
    } catch (error) {
      job.evidenceStatus = 'INCOMPLETE';
      if (job.evidenceReason === undefined) {
        try { job.evidenceReason = String(error instanceof Error ? error.message : error).slice(0, 512); }
        catch { job.evidenceReason = 'Evidence verification failed'; }
      }
    }
  }

  function verifyReceipt(job) {
    if (job.receiptInvalid) return false;
    try {
      if (!job.resultStore || job.persisted?.ref !== path.join(job.resultStore.dir, `${job.id}.result`)) {
        throw new Error('receipt is not bound to the project result store');
      }
      verifyPersisted(job.persisted, { dispatchId: job.id, role: job.role }); return true;
    } catch { job.receiptInvalid = true; return false; }
  }

  function publishSettlement(job, outcome) {
    const dir = checkedDir(job.resultStore.dir);
    const file = path.join(dir, `${job.id}.settlement.json`);
    const bytes = Buffer.from(JSON.stringify({ version: 1, dispatchId: job.id, role: job.role,
      state: job.state, outcome, cost: job.cost ?? null,
      receipt: job.receiptInvalid ? null : job.persisted ?? null }));
    const temp = path.join(dir, `.settlement-${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(temp, bytes, { flag: 'wx', mode: 0o600 });
      try { fs.linkSync(temp, file); }
      catch (error) {
        if (error.code !== 'EEXIST' || !fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink() ||
            !fs.readFileSync(file).equals(bytes)) throw error;
      }
    } finally { try { fs.unlinkSync(temp); } catch { /* original failure wins */ } }
  }

  function finish(job, outcome, value) {
    if (isTerminal(job)) return;
    const message = outcome === 'err' ? (value instanceof Error ? value.message : String(value)) : '';
    job.quarantined = outcome === 'err' && /cleanup unconfirmed/i.test(message);
    job.state = outcome === 'ok' ? 'succeeded' : job.cancelRequested && !job.quarantined ? 'cancelled' : 'failed';
    job.persisted = value?.persisted; // preserve the WeakSet-backed object, never reconstruct it
    if (job.resultStore) {
      verifyReceipt(job);
      if (value?.code === 'PERSIST_FAILED' || value?.persistenceError) {
        job.recovery = true;
        job.partialText = String(value?.partialText ?? '');
      }
    }
    try {
      if (job.reservation) job.cost = budget.settle(job.reservation, outcome === 'ok' ? value?.usage ?? null : null);
    } catch (error) { job.recovery = true; job.recoveryReason = `Budget settlement failed: ${error.message}`; }
    if (job.resultStore) {
      try { publishSettlement(job, outcome); }
      catch (error) { job.recovery = true; job.recoveryReason = `Settlement persistence failed: ${error.message}`; }
    }
    if (outcome === 'ok') {
      const { text, truncated } = truncateText(String(value?.text ?? ''), limits.maxTextBytes);
      job.result = { text, truncated, model: value?.model, thinking: value?.thinking, usage: value?.usage ?? null,
        ...(value?.usageCalls !== undefined ? { usageCalls: value.usageCalls } : {}),
        ...(value?.runtimeVerified !== undefined ? { runtimeVerified: value.runtimeVerified } : {}),
        toolCounts: value?.toolCounts, successfulReads: value?.successfulReads };
      if (job.evidence) verifyEvidence(job);
    } else {
      if (Array.isArray(value?.usageCalls)) job.usageCalls = value.usageCalls;
      if (typeof value?.runtimeVerified === 'boolean') job.runtimeVerified = value.runtimeVerified;
      job.error = truncateText(message, limits.maxErrorBytes).text;
    }
    if (!job.quarantined) job.release?.();
    if (!job.discarded || job.quarantined) {
      try { onTerminal?.({ id: job.id, role: job.role, state: job.state }); } catch { /* best-effort */ }
    }
  }

  function start(task, { key, context, role = 'explorer', evidence } = {}) {
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
      const evictable = [...jobs.values()].find((job) => isTerminal(job) && job.collected && !job.quarantined && !job.recovery);
      if (!evictable) throw new Error(`Retained job limit (${limits.maxRetained}) reached: collect or cancel uncollected jobs`);
      remove(evictable);
    }
    const id = `job-${randomUUID()}`;
    const resultStore = context?.cwd ? { dir: prepareResultDir(context.cwd), dispatchId: id,
      meta: { role, createdAt: new Date().toISOString() } } : undefined;
    let release, reservation;
    if (expensiveRoles.includes(role)) {
      if (!budget) throw new Error('job budget is not configured; background strategist/auditor jobs are denied');
      if (!gate) throw new Error('expensive gate is required for background strategist/auditor jobs');
      release = gate.tryAcquire(`background ${role} job`);
      try { reservation = budget.reserve(role); }
      catch (error) { release?.(); throw error; }
    }
    const controller = new AbortController();
    const job = { id, state: 'running', createdAt: new Date().toISOString(), controller, resultStore,
      key, role, evidence, reservation, release, cancelRequested: false, quarantined: false, collected: false, usageReported: false };
    jobs.set(job.id, job);
    if (key !== undefined) keys.set(key, job.id);
    let pending;
    try { pending = Promise.resolve(run(task, { signal: controller.signal, context, role, dispatchId: id, resultStore })); }
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

  function collectionEnvelope(job) {
    const identity = { dispatchId: job.id, role: job.role };
    const verified = verifyReceipt(job);
    const reasons = [];
    if (job.reservation) reasons.push(job.cost && !job.cost.unknown ?
      `Cost: $${job.cost.usd.toFixed(4)}${job.cost.overBudget ? ' (OVER the per-job budget)' : ''}` : 'Cost: unknown, remains reserved');
    if (!job.resultStore) reasons.push('Project result store unavailable.');
    if (!verified) reasons.push('Result receipt missing, invalid, or changed.');
    if (job.recovery) reasons.push(job.recoveryReason ?? 'Result persistence failed; retained partial work requires recovery.');
    if (job.evidenceStatus === 'INCOMPLETE') reasons.push(`Evidence INCOMPLETE: ${job.evidenceReason}`);
    if (job.state !== 'succeeded') reasons.push(job.error ?? job.state);
    if (job.quarantined) reasons.push('Cleanup unconfirmed; slot remains occupied.');
    const incomplete = !verified || job.recovery || job.evidenceStatus === 'INCOMPLETE' || job.state !== 'succeeded' || job.persisted?.completeness !== 'complete';
    let summary = job.recovery && job.partialText !== undefined ? job.partialText : '';
    if (!summary && verified) {
      try {
        const bytes = fs.readFileSync(job.persisted.ref);
        const body = bytes.subarray(bytes.indexOf(10) + 1).toString('utf8');
        const finalText = job.result?.text;
        summary = finalText && body.includes(finalText) ? finalText : body;
      } catch { job.receiptInvalid = true; return collectionEnvelope(job); }
    } else if (!summary && !job.persisted) summary = job.result?.text ?? '';
    const evidenceReason = String(job.evidenceReason ?? 'Evidence verification failed').replace(/[\r\n\u0085\u2028\u2029]/g, ' ');
    let reason = evidenceReason || 'Evidence verification failed';
    for (;;) {
      const warning = job.evidenceStatus === 'INCOMPLETE' ?
        `INCOMPLETE: evidence changed or became invalid after this job started (${reason}). This output does not apply to current evidence.\n\n` : '';
      const maxBytes = 2048 - Buffer.byteLength(warning);
      try {
        const envelope = verified ? buildEnvelope({ status: incomplete ? 'INCOMPLETE' : 'COMPLETE', persisted: job.persisted,
          identity, summarySource: summary, blockers: `${job.role} job ${job.id}. ${reasons.join(' ')}`,
          next: incomplete ? 'Inspect retained evidence and resolve the blockers.' : 'Inspect the persisted result.', maxBytes }) :
          buildIncompleteEnvelope({ identity, reason: `${job.role} job ${job.id}. ${reasons.join(' ')}`, partialText: summary, maxBytes });
        return warning + envelope;
      } catch {
        if (warning && reason.length) { reason = Array.from(reason).slice(0, Math.floor(Array.from(reason).length / 2)).join(''); continue; }
        return warning + buildIncompleteEnvelope({ identity, reason: `${job.role} job ${job.id}: result reference unavailable. ${reasons.join(' ')}`,
          partialText: summary, referenceUnavailable: verified, maxBytes });
      }
    }
  }

  function collect(id, { recoveryOffset } = {}) {
    const job = get(id);
    if (!isTerminal(job)) return { id: job.id, state: job.state, role: job.role, ready: false };
    job.collected = true;
    if (recoveryOffset !== undefined) {
      if (!Number.isSafeInteger(recoveryOffset) || recoveryOffset < 0) throw new Error('recoveryOffset must be a nonnegative integer');
      if (!job.recovery || job.partialText === undefined) throw new Error('No retained partial text available for recovery');
      const chars = Array.from(job.partialText);
      if (recoveryOffset > chars.length) throw new Error('recoveryOffset exceeds retained text');
      let page = '', index = recoveryOffset, bytes = 0;
      while (index < chars.length && bytes + Buffer.byteLength(chars[index]) <= 1400) {
        page += chars[index]; bytes += Buffer.byteLength(chars[index++]);
      }
      const next = index < chars.length ? index : null;
      return { id: job.id, state: job.state, role: job.role, ready: true,
        text: `INCOMPLETE: retained partial text, code point offset ${recoveryOffset}; next offset ${next ?? 'end'}.\n${page}`,
        recoveryOffset, nextRecoveryOffset: next };
    }
    if (job.evidence) verifyEvidence(job);
    const envelope = job.resultStore || expensiveRoles.includes(job.role) ? collectionEnvelope(job) : undefined;
    if (job.state !== 'succeeded') {
      return { id: job.id, state: job.state, role: job.role, ready: true, error: job.error, ...(envelope ? { text: envelope, envelope } : {}), usage: null, usageUnknown: true,
        ...(job.usageCalls ? { usageCalls: job.usageCalls } : {}),
        ...(job.runtimeVerified !== undefined ? { runtimeVerified: job.runtimeVerified } : {}),
        usageReported: false, ...(job.reservation ? { cost: job.cost ?? { unknown: true } } : {}),
        ...(job.quarantined ? { quarantined: true } : {}) };
    }
    const first = !job.usageReported;
    job.usageReported = true;
    const { usage, ...rest } = job.result;
    return { id: job.id, state: job.state, role: job.role, ready: true, ...rest,
      ...(envelope ? { text: envelope, envelope } : {}),
      ...(first ? { usage } : {}), usageReported: first,
      ...(usage === null ? { usageUnknown: true } : {}),
      ...(job.reservation ? { cost: job.cost ?? { unknown: true } } : {}),
      ...(job.evidence ? { evidence: job.evidenceStatus === 'VERIFIED' ? { status: 'VERIFIED' } :
        { status: 'INCOMPLETE', reason: job.evidenceReason } } : {}) };
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
      if (job.recovery || (keepQuarantined && job.quarantined)) continue;
      remove(job);
    }
  }

  return {
    start, status, collect, cancel,
    lookup(key) { const job = jobs.get(keys.get(key)); return job ? summary(job) : undefined; },
    budgetSnapshot() { return budget?.snapshot(); },
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
