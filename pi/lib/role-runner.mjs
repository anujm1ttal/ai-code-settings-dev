import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { buildAgentArgs } from './role-policy.mjs';

const MAX_ERROR_BYTES = 2048;
const MAX_STREAM_BYTES = 8 * 1024 * 1024;

export async function runRole(policy, roleName, task, cwd, promptPath, options = {}) {
  const args = buildAgentArgs(policy, roleName, promptPath, task);
  const { spawnImpl = spawn, invocation = { command: 'pi', args: [] }, signal,
    timeoutMs = 10 * 60 * 1000, killGraceMs = 2000 } = options;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 ||
      !Number.isSafeInteger(killGraceMs) || killGraceMs <= 0) {
    throw new Error('Pi subagent timeout and kill grace must be positive milliseconds');
  }
  if (signal?.aborted) throw new Error('Agent dispatch aborted');
  const child = spawnImpl(invocation.command, [...invocation.args, ...args], {
    cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'], signal,
  });
  let buffer = '';
  const decoder = new StringDecoder('utf8');
  let streamedBytes = 0;
  let stderr = '';
  let lastAssistant;
  let observedViolation;
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
  let streamError;

  const acceptLine = (line) => {
    if (!line.trim() || streamError) return;
    let event;
    try { event = JSON.parse(line); }
    catch { streamError = new Error('Malformed Pi JSON event'); return; }
    if (roleName === 'auditor' && event.type === 'tool_execution_start' &&
        ['edit', 'write', 'powershell'].includes(event.toolName)) {
      observedViolation = `Auditor attempted ${event.toolName} tool`;
    }
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
      child.kill();
      return;
    }
    buffer += decoder.write(chunk);
    for (let split = buffer.indexOf('\n'); split !== -1; split = buffer.indexOf('\n')) {
      acceptLine(buffer.slice(0, split).replace(/\r$/, ''));
      buffer = buffer.slice(split + 1);
    }
  });
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString('utf8')).slice(-MAX_ERROR_BYTES); });
  let timedOut = false;
  let timeoutTimer;
  let killTimer;
  const close = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  const deadline = new Promise((_, reject) => {
    timeoutTimer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Pi ${roleName} subagent timed out after ${timeoutMs} ms`));
      }, killGraceMs);
    }, timeoutMs);
  });
  let exitCode;
  try { exitCode = await Promise.race([close, deadline]); }
  finally { clearTimeout(timeoutTimer); clearTimeout(killTimer); }
  if (timedOut) throw new Error(`Pi ${roleName} subagent timed out after ${timeoutMs} ms`);
  buffer += decoder.end();
  if (buffer.trim()) acceptLine(buffer);
  if (streamError) throw streamError;
  if (signal?.aborted) throw new Error('Agent dispatch aborted');
  if (exitCode !== 0) throw new Error(`Pi subagent exited with code ${exitCode}: ${stderr}`);
  if (observedViolation) throw new Error(observedViolation);
  if (!lastAssistant) throw new Error('Pi subagent produced no successful final assistant response');
  const text = lastAssistant.content.filter((part) => part.type === 'text').map((part) => part.text).join('\n');
  if (!text.trim()) throw new Error(`Pi ${roleName} subagent produced no final text`);
  return { role: roleName, model: policy.roles[roleName].model,
    thinking: policy.roles[roleName].thinking, text, usage };
}
