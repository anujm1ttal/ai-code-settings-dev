#!/usr/bin/env node
/**
 * Claude Code — Stop Hook: Shared-State Test Guard
 *
 * A change to process-global state (stdout/stderr rebinding, logging config,
 * os.environ) can pass its own module's tests and still break every other test
 * in the suite, because the damage is to state the whole process shares. A
 * subset test run cannot see that class of breakage by construction.
 *
 * If this turn edited shared process state AND no full-suite run followed that
 * edit, inject an additionalContext nag naming the unblock condition.
 *
 * Feedback-only — additionalContext, NEVER a deny/block field or exit 2
 * (LH-2-Plan.md Hard Rule 2, inherited: hard-block variants either hang the
 * session or blank the final turn output). This is the THIRD Stop hook
 * (nudge-handoff, evidence-gate, this); three is the ceiling — a fourth is a
 * redesign, not an addition.
 *
 * Honest n=1: the evidence base is a single incident (2026-07-26, 279 teardown
 * errors from a stdout reassignment that a subset run reported green). It
 * therefore ships with an EXIT CONDITION rather than an argument — gate-log
 * records every fire under ruleId 'guard-shared-state', and BACKLOG entry
 * `igh1_shared-state-hook_1` schedules deletion if it records zero fires across
 * 20 sessions. The guardrail is instrumented to report its own uselessness.
 *
 * Fail-open: any error (bad stdin, unreadable transcript, parse failure)
 * exits 0 with no output.
 */

const fs = require('fs');
const { parseTranscript, extractToolUses } = require('./lib/evidence');

// Process-global state whose mutation escapes the module under test.
const SHARED_STATE_PATTERNS = [
  /\bsys\.stdout\b/,
  /\bsys\.stderr\b/,
  /\blogging\./,
  /\bTextIOWrapper\b/,
  /\breconfigure\b/,
  /\bos\.environ\b/,
];

const EDIT_TOOL_NAMES = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);
const RUNNER_TOOL_NAMES = new Set(['Bash', 'PowerShell']);

function readTranscript(transcriptPath) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return '';
    return fs.readFileSync(transcriptPath, 'utf-8');
  } catch {
    return '';
  }
}

// Lazy-required and independently try/catch-wrapped (not a top-level
// require) so a bug in the logger can only ever be swallowed here — it can
// never crash this file before the additionalContext output above it is
// written (LH-3 T1b, Hard Rule 1).
function logGateSafe(params) {
  try {
    require('./lib/gate-log').logGateEvent(params);
  } catch {
    // Logging must never affect this hook's decision or exit code.
  }
}

// The text an edit tool is about to introduce. Only NEW content counts — the
// pre-edit text is what the author is moving away from.
function writtenText(input) {
  const parts = [];
  if (typeof input.content === 'string') parts.push(input.content);
  if (typeof input.new_string === 'string') parts.push(input.new_string);
  if (Array.isArray(input.edits)) {
    for (const edit of input.edits) {
      if (edit && typeof edit.new_string === 'string') parts.push(edit.new_string);
    }
  }
  return parts.join('\n');
}

function touchesSharedState(text) {
  return SHARED_STATE_PATTERNS.some((pattern) => pattern.test(text));
}

// A run is "full-suite" when it invokes pytest with no test selector. A path
// ending in .py, a `::` node id, or `-k` all narrow the run to a subset, which
// is precisely the blind spot this hook exists to flag. deploy.sh runs the
// full suite as part of its validation, so it counts.
function isFullSuiteRun(command) {
  if (!command) return false;
  if (/deploy\.sh\b/i.test(command)) return true;
  const match = command.match(/\bpytest\b/i);
  if (!match) return false;
  const after = command.slice(match.index);
  if (/::/.test(after)) return false;
  if (/\s-k\b/.test(after)) return false;
  if (/\S+\.py\b/.test(after)) return false;
  return true;
}

function lastSharedStateEditIndex(entries) {
  let last = -1;
  for (const use of extractToolUses(entries)) {
    if (!EDIT_TOOL_NAMES.has(use.name)) continue;
    if (touchesSharedState(writtenText(use.input || {}))) {
      last = Math.max(last, use.entryIndex);
    }
  }
  return last;
}

function hasFullSuiteRunAfter(entries, editIndex) {
  for (const use of extractToolUses(entries)) {
    if (!RUNNER_TOOL_NAMES.has(use.name)) continue;
    if (use.entryIndex <= editIndex) continue;
    if (isFullSuiteRun((use.input || {}).command || '')) return true;
  }
  return false;
}

const MESSAGE =
  'SHARED-STATE GUARD: this turn changed process-global state ' +
  '(sys.stdout/sys.stderr, logging, os.environ, or TextIOWrapper.reconfigure) ' +
  'and no full-suite test run followed it. A subset run cannot observe this class ' +
  'of breakage — the damage lands in tests that never imported the changed module. ' +
  'Run the full suite (`python -m pytest tests/ -q`) before ending the turn, ' +
  'or state explicitly why it is not warranted.';

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

    if (data.stop_hook_active) {
      process.exit(0);
    }

    const entries = parseTranscript(readTranscript(data.transcript_path));
    if (entries.length === 0) {
      process.exit(0);
    }

    const editIndex = lastSharedStateEditIndex(entries);
    if (editIndex === -1) {
      process.exit(0);
    }

    if (hasFullSuiteRunAfter(entries, editIndex)) {
      process.exit(0);
    }

    const output = {
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: MESSAGE,
      },
    };
    process.stdout.write(JSON.stringify(output));
    logGateSafe({
      hook: 'guard-shared-state',
      event: 'Stop',
      decision: 'nag',
      tool: null,
      ruleId: 'guard-shared-state',
      cwd: data.cwd,
    });
    process.exit(0);

  } catch (err) {
    process.stderr.write(`[claude-code/guard-shared-state] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
