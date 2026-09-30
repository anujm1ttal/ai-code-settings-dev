#!/usr/bin/env node
/**
 * Claude Code — SessionStart Hook: State Recovery
 *
 * Scans the workspace for Artifacts state files and injects a session brief
 * into Claude's context. Guarantees state recovery without relying on the
 * agent to "remember" to read files.
 *
 * Injects via the documented SessionStart schema: stdout
 *   { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext } }
 * with exit 0. A bare top-level additionalContext is dropped by the harness.
 *
 * ALB-1 T8 brief trim (was 9,165 B, target <=2,750 B): current_task.md is the
 * only file injected whole (capped at MAX_CURRENT_TASK_BYTES with a visible
 * truncation marker naming the file) — every other state file gets ONE
 * pointer line (path + line count), no content, since the model can Read any
 * of them on demand. Exception (user decision Q5): HANDOFF_BRIEF.md's
 * `## Blockers` section is short and the most actionable part of a handoff,
 * so its body is extracted inline (capped at MAX_BLOCKERS_BYTES).
 *
 * Fail-open: errors are logged to stderr, never block the session.
 */

const fs = require('fs');
const path = require('path');

const MAX_CURRENT_TASK_BYTES = 2000;
const MAX_BLOCKERS_BYTES = 400;

// Lazy-required and independently try/catch-wrapped (not a top-level
// require) so a bug in the logger can only ever be swallowed here — same
// discipline as nudge-handoff.js's logPassSafe (HFO HR1: this hook logged 0
// rows since commit 5bcbc68 dropped its gate-log import; this restores the
// once-per-session heartbeat so "hook ran this session" stays observable).
function logPassSafe(params) {
  try {
    require('./lib/gate-log').logPassOnce(params);
  } catch {
    // Logging must never affect this hook's output or exit code.
  }
}

// Reads a file's full content, CRLF-normalized. Returns null if missing or
// unreadable — never throws.
function readWholeSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8').replace(/\r/g, '');
  } catch {
    return null;
  }
}

// Line count matching `wc -l`/Python `splitlines()` semantics: a trailing
// newline does not count as an extra (empty) line, and an empty file is 0
// lines, not 1.
function lineCount(content) {
  if (content.length === 0) return 0;
  const trimmed = content.endsWith('\n') ? content.slice(0, -1) : content;
  return trimmed.split('\n').length;
}

// Truncates `content` to at most `maxBytes` UTF-8 bytes (never splitting a
// multi-byte character) and appends a marker naming `labelPath` so the model
// knows to Read the rest instead of assuming the file ended there.
function truncateToBytes(content, maxBytes, labelPath) {
  const trimmed = content.trim();
  const buf = Buffer.from(trimmed, 'utf-8');
  if (buf.length <= maxBytes) return trimmed;
  let cut = maxBytes;
  while (cut > 0 && (buf[cut] & 0xc0) === 0x80) cut--; // back off a split multi-byte char
  const head = buf.slice(0, cut).toString('utf-8');
  return `${head}\n... [truncated at ${maxBytes} B — Read ${labelPath} for the rest]`;
}

// Extracts the body of a `## <heading>` section (everything up to the next
// `## ` heading or EOF), trimmed. Returns null if the heading is absent.
function extractSection(content, heading) {
  const lines = content.split('\n');
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      end = i;
      break;
    }
  }
  const body = lines.slice(start + 1, end).join('\n').trim();
  return body.length > 0 ? body : null;
}

function findProjectRoot(startDir) {
  let dir = startDir;
  // Walk up looking for Artifacts/ directory or .git
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'Artifacts')) || fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function buildSessionBrief(cwd) {
  const root = findProjectRoot(cwd);
  const artifactsDir = path.join(root, 'Artifacts');
  const sections = [];

  // Current task — the only file injected whole (it is short by design;
  // capped defensively in case that design is ever violated — see T9).
  const currentTaskPath = path.join(artifactsDir, '.agent', 'current_task.md');
  const currentTask = readWholeSafe(currentTaskPath);
  if (currentTask && currentTask.trim().length > 0) {
    sections.push(
      `## Current Task\n${truncateToBytes(currentTask, MAX_CURRENT_TASK_BYTES, 'Artifacts/.agent/current_task.md')}`
    );
  }

  // Every other state file: ONE pointer line (path + line count), no
  // content — the model Reads whichever one it actually needs.
  const handoffPath = path.join(artifactsDir, 'HANDOFF_BRIEF.md');
  const handoffContent = readWholeSafe(handoffPath);
  const pointerCandidates = [
    ['Artifacts/HANDOFF_BRIEF.md', handoffContent],
    ['Artifacts/TODO.md', readWholeSafe(path.join(artifactsDir, 'TODO.md'))],
    // Falls back to the legacy single-file LEARNINGS.md if the directory
    // registry is absent.
    (() => {
      const index = readWholeSafe(path.join(artifactsDir, 'learnings', 'index.md'));
      if (index !== null) return ['Artifacts/learnings/index.md', index];
      return ['Artifacts/LEARNINGS.md', readWholeSafe(path.join(artifactsDir, 'LEARNINGS.md'))];
    })(),
    ['Artifacts/DECISION_LOG.md', readWholeSafe(path.join(artifactsDir, 'DECISION_LOG.md'))],
  ];
  const pointerLines = pointerCandidates
    .filter(([, content]) => content !== null)
    .map(([label, content]) => `- ${label} (${lineCount(content)} lines)`);
  if (pointerLines.length > 0) {
    sections.push(`## Other State Files\n${pointerLines.join('\n')}`);
  }

  // User decision Q5: HANDOFF_BRIEF.md's Blockers section stays inline — it
  // is short and the most actionable part of a handoff — bounded so it
  // cannot alone blow the byte budget.
  if (handoffContent !== null) {
    const blockers = extractSection(handoffContent, '## Blockers');
    if (blockers) {
      sections.push(`## Blockers\n${truncateToBytes(blockers, MAX_BLOCKERS_BYTES, 'Artifacts/HANDOFF_BRIEF.md')}`);
    }
  }

  if (sections.length === 0) {
    return null; // No state files found, nothing to inject (missing-state alert: silence, never fabricated content)
  }

  return [
    '# Claude Code Session Brief (Auto-Injected)',
    `Project root: ${root}`,
    '',
    ...sections,
    '',
    '---',
    'Verification Discipline: IDENTIFY -> RUN -> READ -> VERIFY -> CLAIM. See `CLAUDE.md`.',
  ].join('\n');
}

function main() {
  try {
    let input = '';
    try {
      input = fs.readFileSync(0, 'utf-8');
    } catch {
      // stdin may not be available in all contexts
    }

    let cwd = process.cwd();
    let data = {};
    try {
      data = JSON.parse(input);
      if (data.cwd) cwd = data.cwd;
    } catch {
      // stdin parsing failed, use process.cwd()
    }

    const brief = buildSessionBrief(cwd);

    if (brief) {
      const output = {
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: brief,
        },
      };
      process.stdout.write(JSON.stringify(output));
    }

    // HFO HR1 heartbeat: proves this hook ran this session regardless of
    // whether any state was found to inject (a real evaluation either way).
    logPassSafe({
      hook: 'session-boot',
      event: 'SessionStart',
      tool: null,
      ruleId: 'session-boot',
      cwd,
      sessionId: data.session_id,
      note: brief ? 'brief-emitted' : 'no-state-found',
    });

    process.exit(0);
  } catch (err) {
    // Fail-open: log error but never block the session
    process.stderr.write(`[claude-code/session-boot] Error: ${err.message}\n`);
    process.exit(0);
  }
}

// Guarded so `require()`-ing this file never runs main()/process.exit as a side effect.
// Invoked via `node hooks/session-boot.js` in every real deployment, where
// require.main === module still holds.
if (require.main === module) {
  main();
}

module.exports = {
  buildSessionBrief,
  findProjectRoot,
  lineCount,
  truncateToBytes,
  extractSection,
};
