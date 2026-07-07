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

function buildSessionBrief(cwd) {
  const root = findProjectRoot(cwd);
  const artifactsDir = path.join(root, 'Artifacts');
  const sections = [];

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

main();
