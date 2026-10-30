import { spawn } from 'node:child_process';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';
import { buildAgentArgs } from './role-policy.mjs';
import { persistFullResult, buildEnvelope, buildIncompleteEnvelope } from './result-contract.mjs';

const MAX_ERROR_BYTES = 2048;
const MAX_STREAM_BYTES = 8 * 1024 * 1024;
const READ_ONLY_ROLES = new Set(['strategist', 'auditor', 'scribe', 'explorer']);
const READ_ONLY_TOOLS = new Set(['read', 'grep', 'find', 'ls']);

export async function runRole(policy, roleName, task, cwd, promptPath, options = {}) {
  const { profile, requiredReadPath, spawnImpl = spawn, killerImpl = spawn,
    invocation = { command: process.execPath, args: [fileURLToPath(new URL('./child-runtime.mjs', import.meta.url))] }, signal,
    timeoutMs = 10 * 60 * 1000, killGraceMs = 2000, ledger, dispatchKey,
    accountingCursor = { next: 0 } } = options;
  if (Boolean(ledger) !== Boolean(dispatchKey)) throw new Error('Accounting ledger and dispatch key must be supplied together');
  const args = buildAgentArgs(policy, roleName, promptPath, task, { profile });
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 ||
      !Number.isSafeInteger(killGraceMs) || killGraceMs <= 0) {
    throw new Error('Pi subagent timeout and kill grace must be positive milliseconds');
  }
  if (signal?.aborted) throw new Error('Agent dispatch aborted');
  const env = { ...process.env };
  delete env.PI_ROLE;
  delete env.PI_CONCIERGE_ROOT;
  const child = spawnImpl(invocation.command, [...invocation.args, ...args], {
    // No `signal` here: Node would kill only the direct child on abort and orphan descendants.
    // Abort is handled below through the tree-aware cleanup.
    cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env,
  });
  let buffer = '';
  const decoder = new StringDecoder('utf8');
  let streamedBytes = 0;
  let stderr = '';
  let lastAssistant;
  const receivedParts = [];
  const pendingParts = new Map();
  const receivedText = () => [...receivedParts, ...pendingParts.values()].join('\n');
  const identity = options.resultStore && { dispatchId: String(options.resultStore.dispatchId ?? ''), role: roleName };
  let observedViolation;
  let evidenceRead = false;
  const evidenceReadCalls = new Set();
  const toolCounts = new Map();
  let successfulReads = 0;
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
  const usageCalls = [];
  let streamError;
  let runtimeVerified = false;

  const acceptLine = (line) => {
    if (!line.trim() || streamError) return;
    let event;
    try { event = JSON.parse(line); }
    catch { streamError = new Error('Malformed Pi JSON event'); return; }
    if (options.resultStore && event.type === 'message_update' &&
        event.assistantMessageEvent?.type === 'text_delta') {
      const delta = event.assistantMessageEvent;
      if (Number.isSafeInteger(delta.contentIndex) && delta.contentIndex >= 0 && typeof delta.delta === 'string') {
        pendingParts.set(delta.contentIndex, (pendingParts.get(delta.contentIndex) ?? '') + delta.delta);
      }
    }
    if (event.type === 'pi_child_runtime') {
      runtimeVerified = event.retryEnabled === false && event.retryMaxRetries === 0 &&
        event.providerMaxRetries === 0 && event.compactionEnabled === false;
    }
    if (event.type === 'tool_execution_start' && typeof event.toolName === 'string') {
      toolCounts.set(event.toolName, (toolCounts.get(event.toolName) ?? 0) + 1);
    }
    if (event.type === 'tool_execution_end' && event.toolName === 'read' && event.isError === false) {
      successfulReads += 1;
    }
    if (event.type === 'extension_error') {
      observedViolation = `Pi guard extension error: ${event.error || 'unknown error'}`;
    }
    if ((READ_ONLY_ROLES.has(roleName) || profile === 'council-read-only') &&
        event.type === 'tool_execution_start' && !READ_ONLY_TOOLS.has(event.toolName)) {
      observedViolation = profile === 'council-read-only'
        ? `Council ${roleName} attempted ${event.toolName} tool`
        : `${roleName[0].toUpperCase()}${roleName.slice(1)} attempted ${event.toolName} tool`;
    }
    if (requiredReadPath && event.type === 'tool_execution_start' && event.toolName === 'read' &&
        path.resolve(cwd, event.args?.path ?? '') === requiredReadPath) evidenceReadCalls.add(event.toolCallId);
    if (requiredReadPath && event.type === 'tool_execution_end' && event.toolName === 'read' &&
        evidenceReadCalls.has(event.toolCallId) && event.isError === false) evidenceRead = true;
    if (event.type !== 'message_end' || event.message?.role !== 'assistant') return;
    const message = event.message;
    if (options.resultStore) {
      for (const [index, part] of (Array.isArray(message.content) ? message.content : []).entries()) {
        if (part.type === 'text' && typeof part.text === 'string') {
          const streamed = pendingParts.get(index);
          if (streamed && !part.text.startsWith(streamed)) receivedParts.push(streamed);
          receivedParts.push(part.text);
          pendingParts.delete(index);
        }
      }
      receivedParts.push(...pendingParts.values());
      pendingParts.clear();
    }
    const model = `${message.provider}/${message.model}`;
    const expected = policy.roles[roleName];
    if (model !== expected.model) observedViolation = `Unexpected model ${model}; expected ${expected.model}`;
    if (message.thinkingLevel !== expected.thinking) {
      observedViolation = `Unexpected thinking ${message.thinkingLevel ?? '(not reported)'}; expected ${expected.thinking}`;
    }
    if (message.stopReason === 'error' || message.stopReason === 'aborted') {
      observedViolation = `Subagent ended with ${message.stopReason}: ${message.errorMessage || 'no details'}`;
    }
    const reading = message.usage ?? null;
    const valid = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
    const components = ['input', 'output', 'cacheRead', 'cacheWrite'];
    const known = reading && components.every(key => valid(reading[key])) &&
      components.some(key => reading[key] > 0) && valid(reading.totalTokens) &&
      ['reasoning', 'cacheWrite1h'].every(key => reading[key] === undefined || valid(reading[key])) &&
      (reading.cost === undefined || (reading.cost && typeof reading.cost === 'object' &&
        Object.values(reading.cost).every(valid)));
    if (ledger && ledger.isEnabled?.() !== false) {
      try {
        ledger.record({ type: 'child', dispatchKey, callOrdinal: accountingCursor.next++,
          model, usage: reading, stopReason: message.stopReason });
        accountingCursor.lastStop = message.stopReason;
      } catch (error) {
        streamError = error instanceof Error ? error : new Error('Accounting write failed');
        startCleanup(streamError);
        return;
      }
    }
    usageCalls.push({ stopReason: message.stopReason, completeness: known ? 'known' : 'unknown', usage: reading });
    if (known) {
      for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens']) {
        usage[key] += reading[key] ?? 0;
      }
      for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'total']) {
        if (valid(reading.cost?.[key])) usage.cost[key] += reading.cost[key];
      }
      for (const key of ['reasoning', 'cacheWrite1h']) {
        if (reading[key] !== undefined) usage[key] = (usage[key] ?? 0) + reading[key];
      }
    }
    if (message.stopReason === 'stop') lastAssistant = message;
  };

  child.stdout.on('data', (chunk) => {
    const previousBytes = streamedBytes;
    streamedBytes += chunk.length;
    if (streamedBytes > MAX_STREAM_BYTES) {
      if ((options.resultStore || ledger) && previousBytes < MAX_STREAM_BYTES) {
        buffer += decoder.write(chunk.subarray(0, MAX_STREAM_BYTES - previousBytes));
        for (let split = buffer.indexOf('\n'); split !== -1; split = buffer.indexOf('\n')) {
          acceptLine(buffer.slice(0, split).replace(/\r$/, ''));
          buffer = buffer.slice(split + 1);
        }
      }
      streamError = new Error('Pi subagent event stream exceeded 8 MiB');
      startCleanup(streamError);
      return;
    }
    buffer += decoder.write(chunk);
    for (let split = buffer.indexOf('\n'); split !== -1; split = buffer.indexOf('\n')) {
      acceptLine(buffer.slice(0, split).replace(/\r$/, ''));
      buffer = buffer.slice(split + 1);
    }
  });
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString('utf8')).slice(-MAX_ERROR_BYTES); });
  let failure;
  let cleanupStarted = false;
  let finished = false;
  let timeoutTimer;
  let killTimer;
  let failureTimer;
  let rejectCleanup;
  const cleanupFailure = new Promise((_, reject) => { rejectCleanup = reject; });
  const close = new Promise(resolve => child.once('close', resolve));
  let childClosed = false;
  child.once('close', () => { childClosed = true; });
  // On Windows, killing the direct child orphans its descendants, so ask taskkill to end that PID's
  // tree. Only target the PID while our child has neither closed nor exited: after `exit` the number
  // may be reused. Residual race: the child can exit between this check and taskkill resolving the
  // PID, and descendants whose parent already exited are invisible to /T (reported as unconfirmed).
  const taskkillPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe');
  const terminateWindowsTree = () => {
    if (process.platform !== 'win32' || childClosed || child.exitCode !== null || child.signalCode !== null ||
        !Number.isSafeInteger(child.pid) || child.pid <= 0) return false;
    try {
      // Asynchronous: a blocking wait cannot be bounded by the kill grace. The existing close/force/fail
      // path bounds the cleanup; if taskkill fails to run or fails, fall back to a direct kill.
      const killer = killerImpl(taskkillPath, ['/PID', String(child.pid), '/T', '/F'],
        { shell: false, stdio: 'ignore', windowsHide: true });
      const fallback = () => { try { child.kill('SIGKILL'); } catch { /* close/deadline reports it */ } };
      killer.once('error', fallback);
      killer.once('exit', (code) => { if (code !== 0) fallback(); });
      killer.unref();
      return true;
    } catch { return false; }
  };
  const terminate = (signalName) => {
    if (terminateWindowsTree()) return;
    try { child.kill(signalName); }
    catch (error) { failure ??= error; }
  };
  const startCleanup = (error) => {
    if (finished) return;
    failure ??= error;
    if (cleanupStarted) return;
    cleanupStarted = true;
    clearTimeout(timeoutTimer);
    killTimer = setTimeout(() => {
      terminate('SIGKILL');
      failureTimer = setTimeout(() => rejectCleanup(new Error(
        `${failure.message}; cleanup unconfirmed: child did not close after forced termination`)), killGraceMs);
    }, killGraceMs);
    terminate('SIGTERM');
  };
  // An error, including an abort or a failed kill, is not proof that the child closed.
  child.on('error', startCleanup);
  const onAbort = () => startCleanup(new Error('Agent dispatch aborted'));
  signal?.addEventListener('abort', onAbort, { once: true });
  timeoutTimer = setTimeout(() => startCleanup(
    new Error(`Pi ${roleName} subagent timed out after ${timeoutMs} ms`)), timeoutMs);
  if (signal?.aborted) onAbort();
  try {
    let exitCode;
    try { exitCode = await Promise.race([close, cleanupFailure]); }
    finally {
      finished = true;
      clearTimeout(timeoutTimer); clearTimeout(killTimer); clearTimeout(failureTimer);
      signal?.removeEventListener('abort', onAbort);
    }
    if (failure) throw failure;
    buffer += decoder.end();
    if (buffer.trim()) acceptLine(buffer);
    if (streamError) throw streamError;
    if (signal?.aborted) throw new Error('Agent dispatch aborted');
    if (exitCode !== 0) throw new Error(`Pi subagent exited with code ${exitCode}: ${stderr}`);
    if (observedViolation) throw new Error(observedViolation);
    if (requiredReadPath && !evidenceRead) throw new Error('Council evidence file was not read');
    if (!lastAssistant) throw new Error('Pi subagent produced no successful final assistant response');
    const text = lastAssistant.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n');
    if (!text.trim()) throw new Error(`Pi ${roleName} subagent produced no final text`);
    if (options.invocation === undefined && runtimeVerified !== true) throw new Error('Pi child runtime was not verified');
    const result = { role: roleName, model: policy.roles[roleName].model,
      thinking: policy.roles[roleName].thinking, text,
      usage: usageCalls.some(call => call.completeness === 'unknown') ? null : usage, usageCalls,
      runtimeVerified, toolCounts: Object.fromEntries(toolCounts), successfulReads };
    if (options.resultStore) {
      const fullText = receivedText();
      result.persisted = persistFullResult({ ...options.resultStore, role: roleName, completeness: 'complete', text: fullText });
      try {
        result.envelope = buildEnvelope({ status: 'COMPLETE', persisted: result.persisted,
          identity, summarySource: text, findingsSource: fullText });
      } catch (error) { error.persisted = result.persisted; throw error; }
    }
    return result;
  } catch (caught) {
    const error = caught instanceof Error ? caught : new Error('Pi subagent failed');
    if (ledger && ledger.isEnabled?.() !== false && !['error', 'aborted'].includes(usageCalls.at(-1)?.stopReason)) {
      try {
        ledger.record({ type: 'child', dispatchKey, callOrdinal: accountingCursor.next++,
          model: policy.roles[roleName].model, usage: null, stopReason: 'error' });
        accountingCursor.lastStop = 'error';
      } catch { /* Preserve the original failure; an unfinished dispatch remains incomplete. */ }
    }
    error.message = `Partial Pi subagent dispatch: ${error.message}`;
    error.partial = true;
    error.usage = null;
    error.usageCalls = usageCalls;
    error.runtimeVerified = runtimeVerified;
    if (options.resultStore) {
      const partialText = receivedText();
      error.partialText = partialText;
      if (!error.persisted && error.code !== 'PERSIST_FAILED') {
        try {
          error.persisted = persistFullResult({ ...options.resultStore, role: roleName, completeness: 'partial', text: partialText });
        } catch (persistError) { error.persistenceError = persistError; }
      }
      try {
        error.envelope = buildIncompleteEnvelope({ reason: error.message, partialText,
          persisted: error.persisted, identity });
      } catch (envelopeError) {
        error.envelopeError = envelopeError;
        error.envelope = buildIncompleteEnvelope({ reason: error.message, partialText,
          identity, referenceUnavailable: Boolean(error.persisted) });
      }
    }
    throw error;
  }
}
