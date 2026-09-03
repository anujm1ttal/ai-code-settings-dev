#!/usr/bin/env node
/**
 * Claude Code — PreToolUse + PostToolUse Hook (matcher: Task): Task Diff Guard
 *
 * A dispatched subagent returns a NARRATIVE summary of what it did.
 * `model-routing.md` §Verification Tiering requires the orchestrator to verify the
 * ARTIFACT, never the summary — but nothing mechanically surfaces WHICH durable
 * artifacts a subagent touched. The 2026-09-02 insights report names two incidents
 * where a subagent misreported an evidence/state edit and it was caught only by the
 * user manually diffing afterward.
 *
 *   PreToolUse(Task)  — snapshot the protected artifact set into
 *                       Artifacts/.agent/pre-task-snapshot/<key>/
 *   PostToolUse(Task) — diff the live files against that snapshot; if any protected
 *                       file changed, inject additionalContext naming the files with
 *                       a capped diff, then delete the snapshot dir.
 *
 * <key> = first 12 hex of sha1(JSON.stringify(tool_input)) so overlapping / parallel
 * Task dispatches do not clobber each other's snapshot. A PostToolUse with no
 * matching snapshot fails open (silent) — this hook never raises a false alarm and
 * never blocks.
 *
 * Feedback-only: `hookSpecificOutput.additionalContext`, NEVER a deny/block field or
 * exit 2 (LH-2-Plan.md Hard Rule 2, inherited — every hard-block variant either hangs
 * the session or blanks the final turn output).
 *
 * Telemetry: each fire logged via hooks/lib/gate-log.js under ruleId
 * 'task-diff-guard' (decision 'nag'). Zero fires across a telemetry review window is
 * the mechanical exit condition — see BACKLOG `sgh1_task-diff-guard_exit_1`.
 *
 * Fail-open: any error (bad stdin, unreadable snapshot, fs failure) exits 0 with no
 * output. Path resolution is duplicated verbatim from audit-trail.js / gate-log.js
 * (not imported) to keep this a single self-contained file.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SNAPSHOT_SUBDIR = path.join('.agent', 'pre-task-snapshot');
const MAX_FILE_BYTES = 256 * 1024;   // skip snapshotting anything larger
const MAX_SNAPSHOT_FILES = 200;      // hard ceiling on files copied per dispatch
const MAX_DIFF_LINES = 60;           // total, across every changed file

// Protected artifacts, relative to the Artifacts/ dir. Explicit files plus
// shallow globs — a subagent editing any of these must be surfaced for
// artifact-level verification, not trusted on its summary.
//
// Deliberately NOT covering Evidence/ recursively: those files are committed,
// so tampering already shows in `git diff` and the nudge-handoff dirty-tree
// check, and snapshotting ~100 closed-phase blobs on every dispatch is
// disproportionate. The churn-heavy, nested-private-repo state files below are
// the actual blind spot (see BACKLOG sgh1_task-diff-guard_exit_1 for tuning).
const PROTECTED_FILES = [
  'BACKLOG.md',
  'TODO.md',
  'AUDIT_REPORT.md',
  'DECISION_LOG.md',
  'IMPLEMENTATION_PLAN.md',
];
const PROTECTED_GLOB_DIRS = [
  { dir: 'Plans', match: /\.md$/ },
  { dir: 'Reports', match: /\.md$/ },
];

function findProjectRoot(startDir) {
  let dir = startDir;
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

// Lazy-required and independently try/catch-wrapped so a bug in the logger can
// never crash this file before the additionalContext output is written.
function logGateSafe(params) {
  try {
    require('./lib/gate-log').logGateEvent(params);
  } catch {
    // Logging must never affect this hook's decision or exit code.
  }
}

function snapshotKey(toolInput) {
  const raw = JSON.stringify(toolInput === undefined ? null : toolInput);
  return crypto.createHash('sha1').update(raw).digest('hex').slice(0, 12);
}

// Enumerate the protected files that currently exist, as paths relative to
// artifactsDir. Bounded by MAX_SNAPSHOT_FILES.
function listProtected(artifactsDir) {
  const out = [];
  const push = (rel) => {
    if (out.length >= MAX_SNAPSHOT_FILES) return;
    out.push(rel);
  };

  for (const rel of PROTECTED_FILES) {
    if (safeIsFile(path.join(artifactsDir, rel))) push(rel);
  }

  for (const { dir, match } of PROTECTED_GLOB_DIRS) {
    const abs = path.join(artifactsDir, dir);
    for (const name of safeReaddir(abs)) {
      if (match.test(name) && safeIsFile(path.join(abs, name))) push(path.join(dir, name));
    }
  }

  return out;
}

function walk(absDir, artifactsDir, push) {
  for (const name of safeReaddir(absDir)) {
    const abs = path.join(absDir, name);
    let stat;
    try {
      stat = fs.statSync(abs);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walk(abs, artifactsDir, push);
    } else if (stat.isFile()) {
      push(path.relative(artifactsDir, abs));
    }
  }
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function safeIsFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function safeRead(p) {
  try {
    if (fs.statSync(p).size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

function rmrf(target) {
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup — a stale snapshot dir is harmless; the next dispatch
    // with the same key overwrites it.
  }
}

// ── PreToolUse ────────────────────────────────────────────────────────────────
function doPre(data) {
  const cwd = data.cwd || process.cwd();
  const root = findProjectRoot(cwd);
  const artifactsDir = path.join(root, 'Artifacts');
  if (!fs.existsSync(artifactsDir)) return;

  const snapDir = path.join(artifactsDir, SNAPSHOT_SUBDIR, snapshotKey(data.tool_input));
  rmrf(snapDir); // clear any stale snapshot under this key

  for (const rel of listProtected(artifactsDir)) {
    const content = safeRead(path.join(artifactsDir, rel));
    if (content === null) continue;
    const dest = path.join(snapDir, rel);
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content, 'utf-8');
    } catch {
      // Skip this file — a partial snapshot still catches the other files.
    }
  }
}

// ── PostToolUse ───────────────────────────────────────────────────────────────
function doPost(data) {
  const cwd = data.cwd || process.cwd();
  const root = findProjectRoot(cwd);
  const artifactsDir = path.join(root, 'Artifacts');
  if (!fs.existsSync(artifactsDir)) return;

  const snapDir = path.join(artifactsDir, SNAPSHOT_SUBDIR, snapshotKey(data.tool_input));
  if (!fs.existsSync(snapDir)) return; // no snapshot → nothing to compare, stay silent

  const changed = [];
  for (const rel of listSnapshotFiles(snapDir)) {
    const before = safeRead(path.join(snapDir, rel));
    const after = safeRead(path.join(artifactsDir, rel));
    if (before === null) continue;
    if (before !== (after === null ? null : after)) {
      changed.push({ rel, before, after });
    }
  }

  rmrf(snapDir);
  if (changed.length === 0) return;

  const subagent = (data.tool_input && (data.tool_input.subagent_type || data.tool_input.description)) || 'a subagent';
  const message = buildMessage(subagent, changed);

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: message,
    },
  }));
  logGateSafe({
    hook: 'task-diff-guard',
    event: 'PostToolUse',
    decision: 'nag',
    tool: data.tool_name || 'Task',
    ruleId: 'task-diff-guard',
    cwd,
  });
}

function listSnapshotFiles(snapDir) {
  const out = [];
  walk(snapDir, snapDir, (rel) => out.push(rel));
  return out;
}

function buildMessage(subagent, changed) {
  const names = changed.map((c) => `Artifacts/${c.rel.split(path.sep).join('/')}`);
  const header =
    `TASK DIFF GUARD: the ${subagent} dispatch modified ${changed.length} protected ` +
    `artifact(s): ${names.join(', ')}. Per model-routing.md §Verification Tiering, verify ` +
    `these edits against the raw file — do not accept the subagent's summary as proof. ` +
    `Changes below (capped ${MAX_DIFF_LINES} lines):`;

  const lines = [];
  let budget = MAX_DIFF_LINES;
  for (const c of changed) {
    if (budget <= 0) break;
    lines.push('', `── Artifacts/${c.rel.split(path.sep).join('/')} ──`);
    if (c.after === null) {
      lines.push('  (file deleted or unreadable after the dispatch)');
      budget -= 3;
      continue;
    }
    const hunk = miniDiff(c.before, c.after, budget);
    lines.push(...hunk.lines);
    budget -= hunk.lines.length + 2;
  }

  return `${header}\n${lines.join('\n')}`;
}

// Compact diff: trim the common prefix/suffix of lines, show the differing middle
// as `- old` / `+ new`. Not a full Myers diff — enough to point a reader at what
// moved so they open the real file. `cap` bounds the emitted line count.
function miniDiff(before, after, cap) {
  const a = before.split('\n');
  const b = after.split('\n');

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;

  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const removed = a.slice(start, endA);
  const added = b.slice(start, endB);
  const lines = [`  @@ line ~${start + 1} @@`];

  for (const r of removed) {
    if (lines.length >= cap) { lines.push('  … (truncated)'); return { lines }; }
    lines.push(`  - ${r}`);
  }
  for (const ad of added) {
    if (lines.length >= cap) { lines.push('  … (truncated)'); return { lines }; }
    lines.push(`  + ${ad}`);
  }
  return { lines };
}

// ── entry ────────────────────────────────────────────────────────────────────
function main() {
  try {
    let input = '';
    try {
      input = fs.readFileSync(0, 'utf-8');
    } catch {
      process.exit(0);
    }

    let data;
    try {
      data = JSON.parse(input);
    } catch {
      process.exit(0);
    }

    // Only act on the Task tool. The matcher in settings-template.json already
    // scopes this, but a mis-wire must not make the hook touch other tools.
    if ((data.tool_name || '') !== 'Task') {
      process.exit(0);
    }

    const event = data.hook_event_name || '';
    if (event === 'PreToolUse') {
      doPre(data);
    } else if (event === 'PostToolUse') {
      doPost(data);
    }
    // Unknown event → no-op, exit 0.

    process.exit(0);
  } catch (err) {
    process.stderr.write(`[claude-code/task-diff-guard] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
