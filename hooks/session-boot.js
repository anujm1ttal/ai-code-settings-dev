#!/usr/bin/env node
/**
 * Claude Code — SessionStart Hook: State Recovery
 * 
 * Scans the workspace for Artifacts state files and injects a session brief
 * into Claude's context. Guarantees state recovery without relying on the
 * agent to "remember" to read files.
 * 
 * Fail-open: errors are logged to stderr, never block the session.
 */

const fs = require('fs');
const path = require('path');

function readFileSafe(filePath, maxLines = 20) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    if (lines.length <= maxLines) return content.trim();
    return lines.slice(0, maxLines).join('\n').trim() + `\n... (${lines.length - maxLines} more lines)`;
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

  // Current task
  const currentTask = readFileSafe(path.join(artifactsDir, '.agent', 'current_task.md'));
  if (currentTask) {
    sections.push(`## Current Task\n${currentTask}`);
  }

  // TODO status (last 10 items)
  const todo = readFileSafe(path.join(artifactsDir, 'TODO.md'), 30);
  if (todo) {
    sections.push(`## TODO Status\n${todo}`);
  }

  // Recent learnings (last 3 entries)
  const learnings = readFileSafe(path.join(artifactsDir, 'LEARNINGS.md'), 15);
  if (learnings) {
    sections.push(`## Recent Learnings\n${learnings}`);
  }

  // Decision log (last 3 entries)
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
        additionalContext: brief,
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
