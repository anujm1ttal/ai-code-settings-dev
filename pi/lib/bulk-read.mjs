import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validateAdmission } from './bulk-admission.mjs';
import { prepareResultDir, persistFullResult, buildEnvelope } from './result-contract.mjs';

const systemDefault = fileURLToPath(new URL('../prompts/bulk-read-system.md', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const nonnegative = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);

export async function bulkRead({ root, paths, question, approval, policy, runWorker, now = new Date(), resultDir, systemPromptPath = systemDefault } = {}) {
  const dispatchId = randomUUID();
  const identity = { dispatchId, role: 'bulk-read', model: typeof approval?.worker === 'string' ? approval.worker : '' };
  const dir = resultDir ?? prepareResultDir(root);
  function finish(status, summary, citations = [], admitted = [], cited = [], unresolved = [], usage = null, text = summary) {
    const refused = status === 'REFUSED';
    const persisted = persistFullResult({ dir, dispatchId, role: identity.role, completeness: status === 'INCOMPLETE' ? 'partial' : 'complete', text,
      meta: { model: identity.model, status } });
    const envelope = buildEnvelope({ status, persisted, identity, summarySource: summary,
      findingsSource: unresolved.join('\n'), blockers: refused ? summary : unresolved.join(' | '),
      next: refused ? 'Inspect the persisted result.' : `Cited ${cited.length} of ${admitted.length} admitted file(s); ${unresolved.length} unresolved item(s). Inspect the persisted result.` });
    const single = summary.replace(/[\r\n\u0085\u2028\u2029]/g, ' ');
    const clipped = !envelope.includes(`Summary: ${single}\n`) || unresolved.some(item =>
      !envelope.includes(item.replace(/[\r\n\u0085\u2028\u2029]/g, ' ')));
    return { status, summary, citations, admitted, cited, unresolved, usage, persisted, envelope, clipped };
  }
  const refuse = reason => finish('REFUSED', reason);
  const admission = validateAdmission({ root, paths, approval, policy, now });
  if (!admission.ok) return refuse(admission.reason);
  if (typeof question !== 'string' || !question.trim() || Buffer.byteLength(question) > 2048) return refuse('invalid-question');
  let systemBytes;
  try { systemBytes = fs.readFileSync(systemPromptPath); } catch { return refuse('system-prompt-unavailable'); }
  if (hash(systemBytes) !== approval.systemPromptSha256.toLowerCase()) return refuse('system-prompt-hash');
  const system = systemBytes.toString('utf8');
  const rate = policy?.jobBudget?.rates?.[approval.worker];
  if (!rate) return refuse('rate-missing');
  {
    const tiers = Array.isArray(rate.tiers) ? rate.tiers : [rate];
    if (!tiers.length || tiers.some(t => !nonnegative(t.inputPerMTok) || !nonnegative(t.outputPerMTok) ||
        approval.rates.inputPerMTok < t.inputPerMTok || approval.rates.outputPerMTok < t.outputPerMTok)) return refuse('rate-undercut');
  }
  const headers = admission.files.map(f => `<file path="${f.path}" bytes=${f.bytes.length} sha256=${f.sha256}>`);
  const prompt = `${question}\n${admission.files.map((f, i) => `${headers[i]}${f.bytes.toString('utf8')}\n`).join('')}`;
  const inputTokensUpper = Buffer.byteLength(prompt) + systemBytes.length;
  const costUpper = (inputTokensUpper * approval.rates.inputPerMTok + approval.maxOutputTokens * approval.rates.outputPerMTok) / 1e6;
  if (costUpper > approval.maxCostUsd) return refuse('cost-cap');
  // Hold a process-independent lock across admission, dispatch and ledger append. A stale lock
  // fails closed; it must be investigated manually rather than silently allowing overspend.
  let lockFd; let keepLock = false;
  const agentDir = path.dirname(prepareResultDir(root));
  const ledgerPath = path.join(agentDir, 'bulk-read-ledger.jsonl');
  const lockPath = path.join(agentDir, 'bulk-read-ledger.lock');
  try {
    try { lockFd = fs.openSync(lockPath, 'wx', 0o600); } catch { return refuse('ledger-locked'); }
    let ledger = '';
    try { ledger = fs.readFileSync(ledgerPath, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') return refuse('ledger-unreadable'); }
    let prior = 0;
    const reservations = new Map(); const settled = new Set();
    try {
      if (ledger && !ledger.endsWith('\n')) throw new Error('incomplete line');
      for (const line of ledger.split('\n').slice(0, -1)) {
        const row = JSON.parse(line);
        if (!obj(row) || typeof row.approvalId !== 'string' || !row.approvalId || typeof row.ts !== 'string' || !Number.isFinite(Date.parse(row.ts)) ||
            !(row.costUsd === null || nonnegative(row.costUsd)) || (row.costUsd === null && !nonnegative(row.costUpper)) ||
            (row.costUpper !== undefined && !nonnegative(row.costUpper)) ||
            (row.reserved !== undefined && (row.reserved !== true || typeof row.dispatchId !== 'string' || !row.dispatchId || row.costUsd !== null)) ||
            (row.settles !== undefined && (typeof row.settles !== 'string' || !row.settles))) throw new Error('invalid row');
        if (row.approvalId !== approval.approvalId) continue;
        if (row.reserved) reservations.set(row.dispatchId, row.costUpper);
        else { if (row.settles) settled.add(row.settles); prior += row.costUsd ?? row.costUpper; }
      }
      for (const [id, upper] of reservations) if (!settled.has(id)) prior += upper;
      if (!Number.isFinite(prior)) throw new Error('invalid sum');
    } catch { return refuse('ledger-corrupt'); }
    if (prior + costUpper > approval.maxTotalUsd) return refuse('cumulative-cap');
    // Reserve the upper bound before dispatch so a crash mid-call still counts against the cap.
    try { fs.appendFileSync(ledgerPath, JSON.stringify({ approvalId: approval.approvalId, ts: new Date().toISOString(), dispatchId, reserved: true, costUsd: null, costUpper }) + '\n', { mode: 0o600 }); }
    catch { return refuse('ledger-unwritable'); }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    let worker;
    try { worker = await runWorker({ model: approval.worker, system, prompt, maxOutputTokens: approval.maxOutputTokens, signal: controller.signal, timeoutMs: 60000 }); }
    catch (error) { worker = { ok: false, text: typeof error?.partialText === 'string' ? error.partialText : '', usage: null, error: 'worker-threw' }; }
    finally { clearTimeout(timer); }
    const raw = typeof worker?.text === 'string' ? worker.text : '';
    const u = worker?.usage;
    const validUsage = obj(u) && ['input', 'output'].every(k => nonnegative(u[k])) && ['cacheRead', 'cacheWrite'].every(k => u[k] === undefined || nonnegative(u[k]));
    const costUsd = validUsage ? ((u.input + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0)) * approval.rates.inputPerMTok + u.output * approval.rates.outputPerMTok) / 1e6 : null;
    let ledgerError = false;
    try { fs.appendFileSync(ledgerPath, JSON.stringify({ approvalId: approval.approvalId, ts: new Date().toISOString(), settles: dispatchId, costUsd, costUpper }) + '\n', { mode: 0o600 }); }
    catch { keepLock = true; ledgerError = true; }
    const usage = { provisional: true, costUsd, costUpper, inputTokensUpper, ...(validUsage ? { input: u.input, output: u.output, cacheRead: u.cacheRead ?? 0, cacheWrite: u.cacheWrite ?? 0 } : {}) };
    const unresolved = [];
    if (!worker?.ok || controller.signal.aborted) unresolved.push('Worker failed or timed out.');
    if (!validUsage) unresolved.push('Usage unavailable or invalid.');
    if (costUsd !== null && costUsd > approval.maxCostUsd) unresolved.push('Actual cost exceeded maxCostUsd.');
    if (ledgerError) unresolved.push('Ledger append failed; lock retained.');
    let parsed;
    try {
      parsed = JSON.parse(raw);
      if (!obj(parsed) || Object.keys(parsed).sort().join(',') !== 'answer,citations,unresolved' || typeof parsed.answer !== 'string' || !Array.isArray(parsed.citations) || !Array.isArray(parsed.unresolved) || !parsed.unresolved.every(x => typeof x === 'string')) throw new Error('schema');
    } catch { parsed = null; unresolved.push('Invalid worker JSON.'); }
    const verified = []; const files = new Map(admission.files.map(f => [f.path, f]));
    let invalid = false;
    if (parsed) {
      unresolved.push(...parsed.unresolved);
      for (const c of parsed.citations) {
        const f = obj(c) ? files.get(c.path) : undefined;
        const text = f ? f.bytes.toString('utf8').split('\n')[c.line - 1] : undefined;
        if (!f || typeof text !== 'string' || !Number.isInteger(c.line) || c.line < 1 || c.line > f.lineCount || typeof c.quote !== 'string' || !c.quote || !text.replace(/\r$/, '').includes(c.quote) || Object.keys(c).sort().join(',') !== 'line,path,quote') {
          invalid = true; unresolved.push('Invalid citation.');
        } else verified.push({ path: c.path, line: c.line, quote: c.quote });
      }
    }
    if (parsed && verified.length === 0 && parsed.unresolved.length === 0) unresolved.push('No verified citation or unresolved item.');
    const complete = Boolean(worker?.ok && !controller.signal.aborted && validUsage && !ledgerError && (costUsd <= approval.maxCostUsd) && parsed && !invalid && (verified.length || parsed.unresolved.length));
    const admitted = admission.files.map(f => f.path);
    const cited = admitted.filter(p => verified.some(c => c.path === p));
    return finish(complete ? 'COMPLETE' : 'INCOMPLETE', parsed?.answer ?? '', verified, admitted, cited, unresolved, usage, raw);
  } finally {
    // A release failure must not lose a result whose spend is already ledgered; a retained lock fails later calls closed.
    if (lockFd !== undefined) {
      try { fs.closeSync(lockFd); } catch { /* retained */ }
      if (!keepLock) { try { fs.unlinkSync(lockPath); } catch { /* retained: fails closed */ } }
    }
  }
}
