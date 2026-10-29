import { spawn } from 'node:child_process';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { buildAgentArgs } from './role-policy.mjs';

const MAX_ERROR_BYTES = 2048;
const MAX_STREAM_BYTES = 8 * 1024 * 1024;
const READ_ONLY_ROLES = new Set(['auditor', 'scribe', 'explorer']);
const READ_ONLY_TOOLS = new Set(['read', 'grep', 'find', 'ls']);

export async function runRole(policy, roleName, task, cwd, promptPath, options = {}) {
  const { profile, requiredReadPath, spawnImpl = spawn, killerImpl = spawn, invocation = { command: 'pi', args: [] }, signal,
    timeoutMs = 10 * 60 * 1000, killGraceMs = 2000 } = options;
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
  let observedViolation;
  let evidenceRead = false;
  const evidenceReadCalls = new Set();
  const toolCounts = new Map();
  let successfulReads = 0;
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
  let streamError;

  const acceptLine = (line) => {
    if (!line.trim() || streamError) return;
    let event;
    try { event = JSON.parse(line); }
    catch { streamError = new Error('Malformed Pi JSON event'); return; }
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
    const model = `${message.provider}/${message.model}`;
    const expected = policy.roles[roleName];
    if (model !== expected.model) observedViolation = `Unexpected model ${model}; expected ${expected.model}`;
    if (message.thinkingLevel !== expected.thinking) {
      observedViolation = `Unexpected thinking ${message.thinkingLevel ?? '(not reported)'}; expected ${expected.thinking}`;
    }
    if (message.stopReason === 'error' || message.stopReason === 'aborted') {
      observedViolation = `Subagent ended with ${message.stopReason}: ${message.errorMessage || 'no details'}`;
    }
    if (message.usage) {
      for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens']) {
        usage[key] += message.usage[key] ?? 0;
      }
      for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'total']) {
        usage.cost[key] += message.usage.cost?.[key] ?? 0;
      }
      for (const key of ['reasoning', 'cacheWrite1h']) {
        if (message.usage[key] !== undefined) usage[key] = (usage[key] ?? 0) + message.usage[key];
      }
    }
    if (message.stopReason === 'stop') lastAssistant = message;
  };

  child.stdout.on('data', (chunk) => {
    streamedBytes += chunk.length;
    if (streamedBytes > MAX_STREAM_BYTES) {
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
  return { role: roleName, model: policy.roles[roleName].model,
    thinking: policy.roles[roleName].thinking, text, usage,
    toolCounts: Object.fromEntries(toolCounts), successfulReads };
}
