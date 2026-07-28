#!/usr/bin/env node
/**
 * Claude Code — Stop Hook: Handoff Nudge
 *
 * At turn-end, if the repo at data.cwd has a dirty git tree and the transcript
 * tail shows no recent /handoff, injects an additionalContext nudge suggesting
 * /handoff. Nudge only — this hook NEVER blocks (Stop schema carries no deny
 * field; B1/B5 in Artifacts/Plans/LH-1-Plan.md).
 *
 * Rate-limited to once per session via a marker file under the OS temp dir
 * (NOT Artifacts/ — this is hook bookkeeping, not project state).
 *
 * Fail-open: any error (bad stdin, git unavailable, transcript unreadable)
 * exits 0 with no output.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MARKER_DIR = path.join(os.tmpdir(), 'claude-nudge-handoff');

function markerPath(sessionId) {
  return path.join(MARKER_DIR, `${sessionId}.marker`);
}

function alreadyNudged(sessionId) {
  try {
    return fs.existsSync(markerPath(sessionId));
  } catch {
    return false;
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

function markNudged(sessionId) {
  try {
    fs.mkdirSync(MARKER_DIR, { recursive: true });
    fs.writeFileSync(markerPath(sessionId), new Date().toISOString());
  } catch {
    // Best-effort — a missed marker only risks a duplicate nudge, never a block.
  }
}

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    timeout: 5000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function isGitDirty(cwd) {
  try {
    return git(cwd, ['status', '--porcelain']).trim().length > 0;
  } catch {
    return false; // Not a git repo, git unavailable, or command failed — nothing to nudge about.
  }
}

// A project may keep Artifacts/ as its OWN nested repo with a private remote,
// so the OS's working notes stay versioned without being published (the
// ai-code-settings arrangement). When it does, committing the outer repo backs
// up no state at all — Artifacts/ has to be committed AND pushed separately, or
// it lives on one disk only.
//
// Silent no-op unless Artifacts/.git exists, so this costs nothing in the
// overwhelming majority of projects, where Artifacts/ is tracked by the repo
// itself and the outer dirty check above already covers it.
//
// "Unbacked" = uncommitted changes, OR commits ahead of upstream, OR no
// upstream at all (nothing to be backed up TO). Fail-open: any git error
// returns false rather than nagging on a condition we could not establish.
function isStateRepoUnbacked(cwd) {
  const stateRepo = path.join(cwd, 'Artifacts');
  try {
    if (!fs.existsSync(path.join(stateRepo, '.git'))) return false;
  } catch {
    return false;
  }
  try {
    if (git(stateRepo, ['status', '--porcelain']).trim().length > 0) return true;
  } catch {
    return false;
  }
  try {
    // Throws when no upstream is configured — nothing to push to, so unbacked.
    const ahead = git(stateRepo, ['rev-list', '--count', '@{u}..HEAD']).trim();
    return ahead !== '' && ahead !== '0';
  } catch {
    return true;
  }
}

// Reads the last `maxBytes` of the transcript file — enough to detect a
// recent /handoff invocation without loading a potentially large transcript.
function readTranscriptTail(transcriptPath, maxBytes = 65536) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return '';
    const size = fs.statSync(transcriptPath).size;
    const start = Math.max(0, size - maxBytes);
    const length = size - start;
    if (length <= 0) return '';
    const fd = fs.openSync(transcriptPath, 'r');
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, start);
    fs.closeSync(fd);
    return buffer.toString('utf-8');
  } catch {
    return '';
  }
}

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

    const cwd = data.cwd || process.cwd();
    const sessionId = data.session_id || 'unknown-session';

    if (alreadyNudged(sessionId)) {
      process.exit(0);
    }

    const stateUnbacked = isStateRepoUnbacked(cwd);
    const treeDirty = isGitDirty(cwd);

    if (!treeDirty && !stateUnbacked) {
      process.exit(0);
    }

    // A recent /handoff suppresses the ordinary dirty-tree nudge, but NOT the
    // state-repo warning: /handoff having run is a proxy, while unpushed state
    // is a fact we just measured. Deferring to the proxy over the measurement
    // is how state gets lost.
    const tail = readTranscriptTail(data.transcript_path);
    if (/\/handoff/i.test(tail) && !stateUnbacked) {
      process.exit(0);
    }

    const context = stateUnbacked
      ? 'Artifacts/ is a nested git repo and has uncommitted or unpushed state. Committing ' +
        'this workspace does NOT back it up. Run: git -C Artifacts add -A && git -C Artifacts ' +
        'commit && git -C Artifacts push — otherwise that state exists on one disk only.'
      : 'Uncommitted changes are present in this workspace and no /handoff has run this ' +
        'session. Run /handoff before ending the session to capture learnings and TODO state.';

    const output = {
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: context,
      },
    };
    process.stdout.write(JSON.stringify(output));
    logGateSafe({
      hook: 'nudge-handoff',
      event: 'Stop',
      decision: 'nag',
      tool: null,
      ruleId: stateUnbacked ? 'nudge-handoff-state-repo' : 'nudge-handoff',
      cwd,
    });
    markNudged(sessionId);
    process.exit(0);

  } catch (err) {
    process.stderr.write(`[claude-code/nudge-handoff] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
