import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createTaskUsage } from '../lib/task-usage.mjs';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const TASK_LIMIT = 2000;
const LOG_LIMIT = 64 * 1024;
const SAFE_TOOLS = new Set(['read', 'grep', 'find', 'ls', 'bash', 'powershell', 'edit', 'write', 'pi_role_agent']);

function utf8Prefix(buffer: Buffer, limit: number): string {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let end = limit; end > 0; end--) {
    try { return decoder.decode(buffer.subarray(0, end)); } catch { /* Back off a split code point. */ }
  }
  return '';
}

function currentTask(cwd: string): string | undefined {
  const file = path.join(cwd, 'Artifacts/.agent/current_task.md');
  let fd: number | undefined;
  try {
    fd = fs.openSync(file, 'r');
    const buffer = Buffer.alloc(TASK_LIMIT + 1);
    const count = fs.readSync(fd, buffer, 0, buffer.length, 0);
    if (!count) return undefined;
    const text = count > TASK_LIMIT
      ? utf8Prefix(buffer, 1900) + '\n... [truncated; read Artifacts/.agent/current_task.md]'
      : buffer.subarray(0, count).toString('utf8');
    return text.trim() || undefined;
  } catch { return undefined; }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}

// Source-only Pi pilot. No Claude hook payloads or global installation.
export default function sessionObservability(pi: ExtensionAPI) {
  let briefSent = false;
  let ledger: ReturnType<typeof createTaskUsage> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let accountingFailed = false;
  let pendingWarm: { id: string; seen: Set<string> }[] = [];
  const entryType = 'pi-task-binding-v1';
  const rateFields = ['inputPerMTok', 'outputPerMTok', 'cacheReadPerMTok', 'cacheWritePerMTok'];
  const parentSession = (ctx: any) => {
    const manager = ctx.sessionManager;
    const sessionId = manager?.getSessionId?.();
    return manager?.getSessionFile?.() && typeof sessionId === 'string' && sessionId ? sessionId : undefined;
  };
  const validRate = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
  const stopPolling = () => { if (timer) clearInterval(timer); timer = undefined; };
  const failAccounting = () => {
    accountingFailed = true;
    try { ledger?.markIncomplete(); } catch { /* Keep the in-memory failure visible if storage is unavailable. */ }
  };
  // Detach from this branch without disabling ledgers held by in-flight dispatches.
  const resetLedger = () => { stopPolling(); ledger?.deactivate(); ledger = undefined; pendingWarm = []; };
  const harvest = (ctx: any) => {
    if (!ledger || !ledger.isEnabled()) { stopPolling(); return; }
    try {
      const sessionId = parentSession(ctx);
      if (!sessionId) throw new Error('session identity missing');
      const branch = ctx.sessionManager.getBranch();
      const boundary = [...branch].reverse().findIndex((entry: any) => entry.type === 'custom' && entry.customType === entryType);
      if (boundary < 0) throw new Error('binding boundary missing');
      for (const entry of branch.slice(branch.length - boundary)) {
        let usage, kind, model;
        if (entry.type === 'message' && entry.message?.role === 'toolResult') {
          const message = entry.message;
          if (typeof message.toolCallId !== 'string' || !Array.isArray(message.content)) throw new Error('delivery identity missing');
          const text = message.content.filter((part: any) => part.type === 'text' && typeof part.text === 'string')
            .map((part: any) => part.text).join('');
          ledger.record({ type: 'output', destination: 'parent-model',
            deliveryId: JSON.stringify([sessionId, message.toolCallId]), text });
          continue;
        }
        if (entry.type === 'message' && entry.message?.role === 'assistant') {
          usage = entry.message.usage; kind = 'normal'; model = entry.message.model;
        } else if (entry.type === 'compaction' || entry.type === 'branch_summary') {
          // Pi's summary entries generally do not persist a model; never guess from
          // the current model, which may change before a replay or reload.
          usage = entry.usage; kind = entry.type; model = entry.model;
        } else if (entry.type === 'usage') {
          usage = entry.usage; kind = entry.kind === 'cache_warm' ? 'cache-warm' : entry.kind; model = entry.model;
        } else continue; // Tool-result usage is a child-usage mirror, not a parent call.
        if (typeof entry.id !== 'string' || !entry.id) throw new Error('entry identity missing');
        ledger.record({ type: 'parent', sessionId, entryId: entry.id, callOrdinal: 0, kind, model, usage });
        if (entry.type === 'usage' && entry.kind === 'cache_warm') {
          const index = pendingWarm.findIndex(item => !item.seen.has(entry.id));
          if (index >= 0) {
            ledger.record({ type: 'warm-resolved', id: pendingWarm[index].id });
            pendingWarm.splice(index, 1);
            for (const item of pendingWarm) item.seen.add(entry.id);
          }
        }
      }
    } catch { failAccounting(); }
  };
  const startPolling = (ctx: any) => {
    stopPolling();
    if (!ledger?.isEnabled()) return;
    timer = setInterval(() => harvest(ctx), 1000);
    timer.unref?.();
    const current = ledger;
    const record = current.record.bind(current);
    current.record = (event: any) => {
      // Detached-job collect reports an intermediate in-process envelope. It is not a
      // Pi tool delivery; the transformed outer or nested result is counted separately.
      if (event?.type === 'output' && event.destination === 'calling-tool') {
        let identity;
        try { identity = JSON.parse(event.deliveryId); } catch { /* Ordinary delivery id. */ }
        if (Array.isArray(identity) && identity.length === 2 &&
            /^job-[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(identity[0]) && typeof identity[1] === 'string') return;
      }
      return record(event);
    };
    for (const method of ['disable', 'close'] as const) {
      const original = current[method].bind(current);
      current[method] = () => { if (ledger === current) stopPolling(); original(); };
    }
  };
  const reconstruct = (ctx: any) => {
    resetLedger();
    const sessionId = parentSession(ctx);
    if (!sessionId || !fs.existsSync(path.join(ctx.cwd, 'Artifacts'))) return;
    const entries = ctx.sessionManager.getBranch();
    const last = [...entries].reverse().find((entry: any) => entry.type === 'custom' && entry.customType === entryType);
    const data = last?.data;
    if (!data || data.closed) return;
    if (!/^[a-f0-9]{64}$/.test(data.taskUid) || !/^[a-f0-9]{64}$/.test(data.modelKey) ||
        !Array.isArray(data.rates) || data.rates.length !== 4 || !data.rates.every(validRate)) return;
    try {
      const rate = Object.fromEntries(rateFields.map((field, i) => [field, data.rates[i]]));
      const restored = createTaskUsage({ cwd: ctx.cwd, ratesByModelKey: { [data.modelKey]: rate } });
      restored.restore({ taskUid: data.taskUid, sessionId });
      ledger = restored;
      accountingFailed = false;
      startPolling(ctx);
      harvest(ctx);
    } catch { accountingFailed = true; /* A damaged binding is never silently replaced. */ }
  };
  pi.on('session_start', (_event, ctx) => { briefSent = false; reconstruct(ctx); });
  pi.on('session_before_tree', (_event, ctx) => { harvest(ctx); });
  pi.on('turn_end', (_event, ctx) => { harvest(ctx); });
  pi.on('agent_settled', (_event, ctx) => { harvest(ctx); });
  pi.on('session_tree', (event, ctx) => {
    // Pi creates a navigation summary after session_before_tree, on the target branch.
    // If that branch has no binding, charge it to the departing task before detaching.
    if (ledger && event.summaryEntry) try {
      const branch = ctx.sessionManager.getBranch();
      const binding = [...branch].reverse().find((entry: any) => entry.type === 'custom' && entry.customType === entryType);
      if (!binding?.data || binding.data.closed) {
        const sessionId = parentSession(ctx);
        if (!sessionId || !event.summaryEntry.id) throw new Error('summary identity missing');
        ledger.record({ type: 'parent', sessionId, entryId: event.summaryEntry.id, callOrdinal: 0,
          kind: 'branch_summary', model: (event.summaryEntry as any).model, usage: event.summaryEntry.usage });
      }
    } catch { failAccounting(); }
    reconstruct(ctx);
  });
  pi.on('session_shutdown', (_event, ctx) => { if (ctx) harvest(ctx); resetLedger(); });
  pi.on('cache_warming_decision', (_event, ctx) => {
    // A later extension may override either decision; without a final-decision hook,
    // even a proposed stop is a possible request and must not be reported as free.
    if (!ledger?.isEnabled()) return;
    try {
      const id = randomUUID();
      const seen = new Set<string>(ctx.sessionManager.getBranch().map((entry: any) => entry.id));
      ledger.record({ type: 'warm-intent', id });
      pendingWarm.push({ id, seen });
    } catch { failAccounting(); }
  });
  pi.on('tool_execution_end', (event, ctx) => {
    if (!ledger?.isEnabled()) { stopPolling(); return; }
    // Nested calls have no transcript entry; top-level results can still be changed by
    // message_end handlers, so count those only from the persisted final message.
    if (event.parentToolCallId) try {
      const sessionId = parentSession(ctx);
      if (!sessionId || typeof event.toolCallId !== 'string' || !Array.isArray(event.result?.content)) throw new Error('delivery identity missing');
      const text = event.result.content.filter((part: any) => part.type === 'text' && typeof part.text === 'string')
        .map((part: any) => part.text).join('');
      ledger.record({ type: 'output', destination: 'calling-tool',
        deliveryId: JSON.stringify([sessionId, event.toolCallId]), text });
    } catch { failAccounting(); }
    harvest(ctx);
  });
  // Some lightweight hook-only consumers do not expose the command API.
  pi.registerCommand?.('pi-task', {
    description: 'Bind, checkpoint, close or inspect task usage',
    handler: async (args, ctx) => {
      const sessionId = parentSession(ctx);
      if (!sessionId) return;
      const notify = (message: string) => ctx.ui.notify(message, 'info');
      if (!fs.existsSync(path.join(ctx.cwd, 'Artifacts'))) {
        notify('INCOMPLETE: project Artifacts directory required'); return;
      }
      const parts = args.trim().split(/\s+/);
      const command = parts[0];
      try {
        if (command === 'bind') {
          const numberPattern = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
          if (parts.length !== 7 || !parts[1] || !parts[2] ||
              !parts.slice(3).every(value => numberPattern.test(value) && validRate(Number(value)))) {
            notify('Invalid usage: /pi-task bind <task> <model> <input> <output> <cacheRead> <cacheWrite>'); return;
          }
          const rates = parts.slice(3).map(Number);
          const modelKey = createHash('sha256').update(JSON.stringify(['model', parts[2]])).digest('hex');
          const rate = Object.fromEntries(rateFields.map((field, i) => [field, rates[i]]));
          const next = createTaskUsage({ cwd: ctx.cwd, ratesByModelKey: { [modelKey]: rate } });
          const { taskUid } = next.bind({ taskId: parts[1], sessionId, actor: 'parent' });
          harvest(ctx);
          try { pi.appendEntry(entryType, { taskUid, modelKey, rates }); }
          catch (error) { next.disable(); reconstruct(ctx); throw error; }
          resetLedger(); ledger = next; accountingFailed = false; startPolling(ctx);
          notify('INCOMPLETE: task bound; accounting is not acceptance'); return;
        }
        if (parts.length !== 1 || !['status', 'checkpoint', 'close'].includes(command)) {
          notify('Invalid usage: /pi-task bind|checkpoint|close|status'); return;
        }
        if (!ledger?.isEnabled()) { resetLedger(); notify('INCOMPLETE: task unassigned'); return; }
        harvest(ctx);
        const snapshot = ledger.status();
        const admitted = new Set(snapshot.rows.filter((row: any) => row.type === 'admit').map((row: any) => row.dispatchKey));
        for (const row of snapshot.rows) if (row.type === 'settlement') admitted.delete(row.dispatchKey);
        const outstanding = [...admitted] as string[];
        // An empty journal cannot demonstrate observed task usage.
        const state = !accountingFailed && snapshot.rows.some((row: any) => row.type === 'parent') ? snapshot.status : 'INCOMPLETE';
        if (command === 'status') {
          notify(`${state}: outstanding ${outstanding.length}; prompt input ${snapshot.totals.promptInput}; output ${snapshot.totals.output}; total tokens ${snapshot.totals.totalTokens}; estimated USD lower bound ${snapshot.totals.rateUsdLowerBound}; provider USD lower bound ${snapshot.totals.providerUsdLowerBound}`); return;
        }
        ledger.checkpoint();
        if (command === 'checkpoint') { notify(`${state}: checkpoint recorded; outstanding ${outstanding.length}; not acceptance`); return; }
        if (outstanding.length) {
          notify(`INCOMPLETE: outstanding ${outstanding.length}: ${outstanding.slice(0, 20).join(', ')}${outstanding.length > 20 ? ', ...' : ''}; not acceptance`); return;
        }
        pi.appendEntry(entryType, { closed: true });
        ledger.close(); ledger = undefined; pendingWarm = [];
        notify(`${state}: task closed; not acceptance`);
      } catch { failAccounting(); notify('INCOMPLETE: task accounting error; records preserved'); }
    },
  });
  pi.on('before_agent_start', (event, ctx) => {
    if (briefSent || event.messageType !== 'user') return undefined;
    const brief = currentTask(ctx.cwd);
    if (!brief) return undefined;
    briefSent = true;
    return { message: { customType: 'pi-session-state', content: brief, display: false } };
  });
  pi.on('tool_result', (event, ctx) => {
    const artifacts = path.join(ctx.cwd, 'Artifacts');
    if (!fs.existsSync(artifacts)) return;
    try {
      const dir = path.join(artifacts, '.agent');
      fs.mkdirSync(dir, { recursive: true });
      // No input, content, cwd, path, command, toolCallId or provider metadata.
      const row = { ts: new Date().toISOString(),
        tool: SAFE_TOOLS.has(event.toolName) ? event.toolName : 'other',
        outcome: event.isError ? 'error' : 'ok' };
      const file = path.join(dir, 'pi-audit.jsonl');
      const line = JSON.stringify(row) + '\n';
      const priorSize = fs.existsSync(file) ? fs.statSync(file).size : 0;
      const rows: string[] = [];
      if (priorSize) {
        const fd = fs.openSync(file, 'r');
        const tail = Buffer.alloc(Math.min(priorSize, LOG_LIMIT));
        try { fs.readSync(fd, tail, 0, tail.length, priorSize - tail.length); }
        finally { fs.closeSync(fd); }
        rows.push(...tail.toString('utf8').split('\n'));
        if (priorSize > tail.length) rows.shift(); // partial first line
      }
      // Canonicalize every retained row: never preserve legacy command fields,
      // even when the existing file is still below its byte ceiling.
      const kept: string[] = [];
      let bytes = Buffer.byteLength(line);
      const limit = LOG_LIMIT;
      for (const raw of rows.reverse()) {
        let candidate;
        try { candidate = JSON.parse(raw); } catch { continue; }
        let canonical;
        if (typeof candidate?.ts === 'string' &&
            /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(candidate.ts) &&
            (SAFE_TOOLS.has(candidate?.tool) || candidate?.tool === 'other') &&
            ['ok', 'error'].includes(candidate?.outcome)) {
          canonical = { ts: candidate.ts, tool: candidate.tool, outcome: candidate.outcome };
        } else if (candidate?.version === 1 && candidate.type === 'checkpoint' &&
            typeof candidate.ts === 'number' && Number.isFinite(candidate.ts) && candidate.ts >= 0 &&
            /^[a-f0-9]{64}$/.test(candidate.taskUid) && Number.isSafeInteger(candidate.sequence) && candidate.sequence > 0 &&
            /^[a-f0-9]{64}$/.test(candidate.checkpointHash)) {
          canonical = { version: 1, ts: candidate.ts, type: 'checkpoint', taskUid: candidate.taskUid,
            sequence: candidate.sequence, checkpointHash: candidate.checkpointHash };
        } else continue;
        const safe = JSON.stringify(canonical) + '\n';
        if (bytes + Buffer.byteLength(safe) > limit) break;
        kept.unshift(safe);
        bytes += Buffer.byteLength(safe);
      }
      fs.writeFileSync(file, kept.join('') + line);
    } catch { /* Audit feedback is best-effort; never alter a tool result. */ }
  });
}
