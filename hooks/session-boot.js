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
 * Note on slicing: this OS's state files are newest-first (DECISION_LOG.md is
 * "Newest first", TODO.md prepends the active initiative, learnings/index.md
 * leads with the newest entry), so the head of each file is the current content.
 *
 * Fail-open: errors are logged to stderr, never block the session.
 */

const fs = require('fs');
const path = require('path');

// Reads the top `maxLines` lines of a file (the newest content, since this OS's
// state files are newest-first). CRLF-tolerant.
function readFileSafe(filePath, maxLines = 20) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8').replace(/\r/g, '');
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content.trim();
    return lines.slice(0, maxLines).join('\n').trim() + `\n... (${lines.length - maxLines} more lines below)`;
  } catch {
    return null;
  }
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

// Lazy-required and independently try/catch-wrapped (not a top-level require) so a
// bug in the logger can only ever be swallowed here — matches nudge-handoff.js's
// logGateSafe (LH-3 T1b, Hard Rule 1 of BGR-1-TODO.md T3): logging must never
// affect this hook's output or exit code.
function logGateSafe(params) {
  try {
    require('./lib/gate-log').logGateEvent(params);
  } catch {
    // Fail-open within fail-open.
  }
}

// ----- BACKLOG health check (BGR-1 T3) -----
//
// Fallback caps — used ONLY when hooks/backlog-caps.json is unreachable (absent,
// unreadable, or malformed JSON). Must stay numerically identical to that file,
// the Python fallback in scripts/backlog_audit.py, and the rule prose in
// rules/common/orchestration.md §BACKLOG Lifecycle — enforced by
// tests/test_cap_parity.py (BGR-1 T4), never by eyeballing. Exported at the
// bottom of this file so a test can read it without executing main().
const BACKLOG_CAPS_FALLBACK = Object.freeze({ max_lines: 600, max_entries: 20, max_entry_lines: 30 });

function loadBacklogCaps() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'backlog-caps.json'), 'utf-8');
    const data = JSON.parse(raw);
    const caps = {
      max_lines: Number(data.max_lines),
      max_entries: Number(data.max_entries),
      max_entry_lines: Number(data.max_entry_lines),
    };
    if (!Number.isFinite(caps.max_lines) || !Number.isFinite(caps.max_entries) || !Number.isFinite(caps.max_entry_lines)) {
      throw new Error('non-numeric cap in backlog-caps.json');
    }
    return caps;
  } catch {
    return { ...BACKLOG_CAPS_FALLBACK };
  }
}

const BACKLOG_HEALTH_HEADING = '## BACKLOG Health';

// Advisory-only, known-unreliable heuristic mirroring backlog_audit.py's `## `
// ENTRY_RE (`^##\s+`, so a `### ` heading — one hash too many before the
// whitespace — does not match, exactly like the Python side). NEVER used to
// gate: this parser misreads real files (one live project reports 2 entries
// where it holds 121), which is exactly why gating is line-count only.
function countBacklogEntriesAdvisory(content) {
  const matches = content.match(/^##[ \t]+\S/gm);
  return matches ? matches.length : 0;
}

// Fail-open, context-silent BACKLOG size check. Returns `{ section, decision }`:
// `section` is the additionalContext text to inject (only when over the line
// cap), or `null` when compliant/absent/unreadable — Hard Rule 1 (BGR-1-TODO.md
// T3): zero stdout when within cap, no exceptions. `decision` is 'pass' or 'nag'
// and the caller logs it exactly once regardless of which branch fired.
function checkBacklogHealth(root) {
  const backlogPath = path.join(root, 'Artifacts', 'BACKLOG.md');
  try {
    if (!fs.existsSync(backlogPath)) {
      return { section: null, decision: 'pass' };
    }
    const content = fs.readFileSync(backlogPath, 'utf-8');
    const lineCount = content.split(/\r\n|\r|\n/).length;
    const caps = loadBacklogCaps();
    if (lineCount <= caps.max_lines) {
      return { section: null, decision: 'pass' };
    }
    // Entry count is advisory-only and computed ONLY on this (already-fired) nag
    // path — it must never itself cause the check to fire (design constraint).
    const entryCount = countBacklogEntriesAdvisory(content);
    const section = [
      BACKLOG_HEALTH_HEADING,
      `Artifacts/BACKLOG.md is ${lineCount} lines (cap ${caps.max_lines}). Rotate RESOLVED ` +
        'entries to History/BACKLOG-archive.md — see scripts/backlog_audit.py or /clean.',
      `Entry count (advisory, heuristic — may misread real files): ~${entryCount}.`,
    ].join('\n');
    return { section, decision: 'nag' };
  } catch {
    // Fail-open: an unreadable BACKLOG.md must never block boot or surface noise.
    return { section: null, decision: 'pass' };
  }
}

function buildSessionBrief(cwd) {
  const root = findProjectRoot(cwd);
  const artifactsDir = path.join(root, 'Artifacts');
  const sections = [];

  // BACKLOG health — line-count gate only (entry counts are advisory, never a
  // gating signal). Logs exactly one gate event per run on BOTH branches, so
  // "fired nowhere" is distinguishable from "never ran".
  const backlogHealth = checkBacklogHealth(root);
  if (backlogHealth.section) {
    sections.push(backlogHealth.section);
  }
  logGateSafe({
    hook: 'session-boot',
    event: 'SessionStart',
    decision: backlogHealth.decision,
    tool: null,
    ruleId: 'session-boot-backlog',
    cwd: root,
  });

  // Current task pointer (whole file — it is short by design)
  const currentTask = readFileSafe(path.join(artifactsDir, '.agent', 'current_task.md'));
  if (currentTask) {
    sections.push(`## Current Task\n${currentTask}`);
  }

  // Handoff brief from the previous session (the single highest-value boot file)
  const handoff = readFileSafe(path.join(artifactsDir, 'HANDOFF_BRIEF.md'), 40);
  if (handoff) {
    sections.push(`## Last Handoff Brief\n${handoff}`);
  }

  // TODO status — top of file holds the active initiative
  const todo = readFileSafe(path.join(artifactsDir, 'TODO.md'), 30);
  if (todo) {
    sections.push(`## TODO Status (active initiative at top)\n${todo}`);
  }

  // Recent learnings — registry index (newest entries at top). Falls back to the
  // legacy single-file LEARNINGS.md if the directory registry is absent.
  const learnings =
    readFileSafe(path.join(artifactsDir, 'learnings', 'index.md'), 20) ||
    readFileSafe(path.join(artifactsDir, 'LEARNINGS.md'), 15);
  if (learnings) {
    sections.push(`## Recent Learnings\n${learnings}`);
  }

  // Decision log — newest entries at top
  const decisions = readFileSafe(path.join(artifactsDir, 'DECISION_LOG.md'), 15);
  if (decisions) {
    sections.push(`## Recent Decisions\n${decisions}`);
  }

  if (sections.length === 0) {
    return null; // No state files found, nothing to inject
  }

  return [
    '# Claude Code Session Brief (Auto-Injected)',
    `Project root: ${root}`,
    '',
    ...sections,
    '',
    '---',
    '**Reminder**: Follow Verification Discipline (IDENTIFY → RUN → READ → VERIFY → CLAIM).',
    'Read `CLAUDE.md` for full agent orchestration rules.',
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
    try {
      const parsed = JSON.parse(input);
      if (parsed.cwd) cwd = parsed.cwd;
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

    process.exit(0);
  } catch (err) {
    // Fail-open: log error but never block the session
    process.stderr.write(`[claude-code/session-boot] Error: ${err.message}\n`);
    process.exit(0);
  }
}

// Guarded so `require()`-ing this file (e.g. tests/test_cap_parity.py, BGR-1 T4,
// reading BACKLOG_CAPS_FALLBACK) never runs main()/process.exit as a side effect.
// Invoked via `node hooks/session-boot.js` in every real deployment, where
// require.main === module still holds.
if (require.main === module) {
  main();
}

module.exports = {
  BACKLOG_CAPS_FALLBACK,
  loadBacklogCaps,
  checkBacklogHealth,
  countBacklogEntriesAdvisory,
  buildSessionBrief,
  findProjectRoot,
};
