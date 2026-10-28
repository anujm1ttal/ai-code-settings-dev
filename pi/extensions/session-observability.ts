import fs from 'node:fs';
import path from 'node:path';
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
  pi.on('session_start', () => { briefSent = false; });
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
      const limit = priorSize + bytes > LOG_LIMIT ? LOG_LIMIT / 2 : LOG_LIMIT;
      for (const raw of rows.reverse()) {
        let candidate;
        try { candidate = JSON.parse(raw); } catch { continue; }
        if (typeof candidate?.ts !== 'string' ||
            !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(candidate.ts) ||
            !(SAFE_TOOLS.has(candidate?.tool) || candidate?.tool === 'other') ||
            !['ok', 'error'].includes(candidate?.outcome)) continue;
        const safe = JSON.stringify({ ts: candidate.ts, tool: candidate.tool, outcome: candidate.outcome }) + '\n';
        if (bytes + Buffer.byteLength(safe) > limit) break;
        kept.unshift(safe);
        bytes += Buffer.byteLength(safe);
      }
      fs.writeFileSync(file, kept.join('') + line);
    } catch { /* Audit feedback is best-effort; never alter a tool result. */ }
  });
}
