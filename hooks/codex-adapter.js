#!/usr/bin/env node
/** Codex-only bridge for the Claude hook implementations. */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const HOOKS = new Set([
  'session-boot', 'guard-paths', 'guard-commands', 'auto-lint',
  'audit-trail', 'task-diff-guard', 'nudge-handoff',
  'evidence-gate', 'guard-shared-state',
]);
const STOP_HOOKS = new Set([
  'task-diff-guard', 'nudge-handoff', 'evidence-gate', 'guard-shared-state',
]);
const SNAPSHOT_ROOT = path.join('.agent', 'codex-pre-task-snapshot');

function snapshotSubdir(data) {
  const session = crypto.createHash('sha256').update(data.session_id || 'unknown-session')
    .digest('hex').slice(0, 16);
  return path.join(SNAPSHOT_ROOT, session);
}

function patchTargets(command) {
  if (typeof command !== 'string') return [];
  const targets = [];
  let current = null;
  for (const line of command.split(/\r?\n/)) {
    const file = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/.exec(line);
    const move = /^\*\*\* Move to: (.+)$/.exec(line);
    if (file || move) {
      current = { path: (file || move)[1].trim(), content: '' };
      targets.push(current);
    } else if (current && line.startsWith('+') && !line.startsWith('+++')) {
      current.content += line.slice(1) + '\n';
    }
  }
  return targets;
}

function autoLintInputs(data) {
  const cwd = data.cwd || process.cwd();
  return patchTargets(data.tool_input && data.tool_input.command)
    .filter((target) => fs.existsSync(path.resolve(cwd, target.path)))
    .map((target) => ({
      ...data, tool_name: 'Edit', tool_input: { file_path: target.path },
    }));
}

function parseArguments(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function toolUses(payload) {
  const args = parseArguments(payload.arguments);
  const id = payload.call_id || payload.id || '';
  if (payload.name === 'apply_patch') {
    const command = args.command || args.patch || '';
    return patchTargets(command).map((target, index) => ({
      type: 'tool_use', id: `${id}-${index}`, name: 'Edit',
      input: { file_path: target.path, new_string: target.content },
    }));
  }
  if (['exec_command', 'Bash', 'PowerShell'].includes(payload.name)) {
    return [{ type: 'tool_use', id, name: 'Bash',
      input: { command: args.cmd || args.command || '' } }];
  }
  if (payload.name === 'spawn_agent') {
    return [{ type: 'tool_use', id, name: 'Agent', input: args }];
  }
  return [{ type: 'tool_use', id, name: payload.name || '', input: args }];
}

function convertTranscript(transcriptPath, finalMessage = '') {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return [];
  const lines = fs.readFileSync(transcriptPath, 'utf-8').split(/\r?\n/);
  const entries = [];
  const usesById = new Map();
  for (const line of lines) {
    if (!line.trim()) continue;
    let row;
    try { row = JSON.parse(line); } catch { continue; }
    if (row.type !== 'response_item' || !row.payload) continue;
    const payload = row.payload;
    if (payload.type === 'function_call') {
      const uses = toolUses(payload);
      usesById.set(payload.call_id, uses);
      if (uses.length) entries.push({ timestamp: row.timestamp,
        type: 'assistant', message: { content: uses } });
    } else if (payload.type === 'function_call_output') {
      const uses = usesById.get(payload.call_id) || [];
      if (uses.length) entries.push({ timestamp: row.timestamp, type: 'user',
        message: { content: uses.map((use) => ({ type: 'tool_result',
          tool_use_id: use.id, content: String(payload.output || '') })) } });
    } else if (payload.type === 'message' && ['assistant', 'user'].includes(payload.role)) {
      const texts = (Array.isArray(payload.content) ? payload.content : [])
        .filter((block) => block && typeof block.text === 'string')
        .map((block) => ({ type: 'text', text: block.text }));
      if (texts.length) entries.push({ timestamp: row.timestamp,
        type: payload.role, message: { content: texts } });
    }
  }
  if (finalMessage && !entries.some((entry) => entry.type === 'assistant' &&
    entry.message.content.some((block) => block.type === 'text' && block.text === finalMessage))) {
    entries.push({ timestamp: new Date().toISOString(), type: 'assistant',
      message: { content: [{ type: 'text', text: finalMessage }] } });
  }
  return entries;
}

function findProjectRoot(cwd) {
  let dir = cwd;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'Artifacts')) || fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return cwd;
}

function stateDir(data) {
  return path.join(findProjectRoot(data.cwd || process.cwd()), 'Artifacts', '.agent', 'codex-subagents');
}

function stateFile(data) {
  const key = crypto.createHash('sha256')
    .update(`${data.session_id || ''}\0${data.agent_id || ''}`).digest('hex');
  return path.join(stateDir(data), `${key}.json`);
}

function readStates(data) {
  const dir = stateDir(data);
  if (!fs.existsSync(dir)) return [];
  const states = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const state = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8'));
      if (state.session_id === (data.session_id || '')) states.push(state);
    }
    catch { /* A corrupt state file cannot prove completion. */ }
  }
  return states;
}

function addTaskNotifications(entries, data) {
  const withoutSpawn = entries.filter((entry) => !(
    entry.type === 'assistant' && entry.message.content.some((block) =>
      block.type === 'tool_use' && block.name === 'Agent')));
  for (const state of readStates(data)) {
    withoutSpawn.push({ timestamp: state.started_at, type: 'assistant',
      message: { content: [{ type: 'tool_use', id: state.agent_id,
        name: 'Agent', input: { subagent_type: state.agent_type } }] } });
    if (state.status === 'stopped') {
      withoutSpawn.push({ timestamp: state.stopped_at, type: 'user',
        message: { content: `<task-notification><tool-use-id>${state.agent_id}</tool-use-id></task-notification>` } });
    }
  }
  return withoutSpawn;
}

function runUnderlying(hook, data) {
  const result = spawnSync(process.execPath, [path.join(__dirname, `${hook}.js`)], {
    input: JSON.stringify(data), encoding: 'utf-8', timeout: 30000,
    maxBuffer: 4 * 1024 * 1024,
    env: hook === 'task-diff-guard' ? {
      ...process.env, CODEX_TASK_DIFF_SNAPSHOT_SUBDIR: snapshotSubdir(data),
    } : process.env,
  });
  if (result.error) throw result.error;
  if (result.stderr) process.stderr.write(result.stderr);
  return result.stdout || '';
}

function emit(hook, event, outputs) {
  const context = outputs.map((output) => {
    try {
      const parsed = JSON.parse(output);
      return parsed.hookSpecificOutput && parsed.hookSpecificOutput.additionalContext ||
        parsed.systemMessage || '';
    } catch { return ''; }
  }).filter(Boolean);
  if (!context.length) {
    const passthrough = outputs.find((output) => output.trim());
    if (passthrough) process.stdout.write(passthrough);
    return;
  }
  const message = context.join('\n\n').replace(/Claude Code Auto-Lint/g, 'Codex Auto-Lint');
  if (event === 'Stop') {
    const response = hook === 'nudge-handoff'
      ? { systemMessage: message }
      : { decision: 'block', reason: message };
    process.stdout.write(JSON.stringify(response));
  }
  else process.stdout.write(JSON.stringify({ hookSpecificOutput: {
    hookEventName: event, additionalContext: message,
  } }));
}

function runSubagentEvent(data) {
  if (!data.agent_id) return;
  if (!fs.existsSync(path.join(findProjectRoot(data.cwd || process.cwd()), 'Artifacts'))) return;
  const file = stateFile(data);
  const toolInput = { agent_id: data.agent_id, subagent_type: data.agent_type || '' };
  if (data.hook_event_name === 'SubagentStart') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const startedAt = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify({ agent_id: data.agent_id,
      agent_type: data.agent_type || '', session_id: data.session_id || '',
      started_at: startedAt, status: 'in-flight' }));
    runUnderlying('task-diff-guard', { ...data, hook_event_name: 'PreToolUse',
      tool_name: 'Agent', tool_input: toolInput });
  } else {
    runUnderlying('task-diff-guard', { ...data, hook_event_name: 'PostToolUse',
      tool_name: 'Agent', tool_input: toolInput });
    if (!fs.existsSync(file)) return;
    const state = JSON.parse(fs.readFileSync(file, 'utf-8'));
    fs.writeFileSync(file, JSON.stringify({ ...state, status: 'stopped',
      stopped_at: new Date().toISOString() }));
  }
}

function runStop(hook, data) {
  if (hook !== 'nudge-handoff' && data.stop_hook_active) return;
  const entries = convertTranscript(data.transcript_path, data.last_assistant_message || '');
  const adapted = hook === 'task-diff-guard' ? addTaskNotifications(entries, data) : entries;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-hook-'));
  const transcriptPath = path.join(tempDir, 'transcript.jsonl');
  try {
    fs.writeFileSync(transcriptPath, adapted.map((entry) => JSON.stringify(entry)).join('\n'));
    if (data.transcript_path && fs.existsSync(data.transcript_path)) {
      const stat = fs.statSync(data.transcript_path);
      fs.utimesSync(transcriptPath, stat.atime, stat.mtime);
    }
    const output = runUnderlying(hook, { ...data, transcript_path: transcriptPath });
    emit(hook, 'Stop', [output]);
    if (hook === 'task-diff-guard') {
      const snapRoot = path.join(findProjectRoot(data.cwd || process.cwd()), 'Artifacts', snapshotSubdir(data));
      if (!fs.existsSync(snapRoot) || fs.readdirSync(snapRoot).length === 0) {
        for (const name of fs.existsSync(stateDir(data)) ? fs.readdirSync(stateDir(data)) : []) {
          const file = path.join(stateDir(data), name);
          try {
            const state = JSON.parse(fs.readFileSync(file, 'utf-8'));
            if (state.session_id === (data.session_id || '') && state.status === 'stopped') {
              fs.unlinkSync(file);
            }
          } catch { /* Preserve unreadable state for investigation. */ }
        }
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const hook = process.argv[2];
  if (!HOOKS.has(hook)) return;
  let data;
  try { data = JSON.parse(fs.readFileSync(0, 'utf-8')); }
  catch { return; }
  try {
    const event = data.hook_event_name || '';
    if (hook === 'task-diff-guard' && ['SubagentStart', 'SubagentStop'].includes(event)) {
      runSubagentEvent(data);
    } else if (event === 'Stop' && STOP_HOOKS.has(hook)) {
      runStop(hook, data);
    } else if (hook === 'auto-lint' && data.tool_name === 'apply_patch') {
      const outputs = autoLintInputs(data).map((input) => runUnderlying(hook, input));
      emit(hook, event, outputs);
    } else if (hook === 'audit-trail' && data.tool_name === 'apply_patch') {
      const targets = patchTargets(data.tool_input && data.tool_input.command);
      runUnderlying(hook, { ...data, tool_input: {
        command: `apply_patch: ${targets.map((target) => target.path).join(', ')}`,
      } });
    } else {
      const output = runUnderlying(hook, data);
      if (output) process.stdout.write(output);
    }
  } catch (error) {
    process.stderr.write(`[codex-hook/${hook}] ${error.message}\n`);
  }
}

if (require.main === module) main();
module.exports = { patchTargets, autoLintInputs, toolUses, convertTranscript, addTaskNotifications };
