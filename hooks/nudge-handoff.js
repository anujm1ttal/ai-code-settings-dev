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

function markNudged(sessionId) {
  try {
    fs.mkdirSync(MARKER_DIR, { recursive: true });
    fs.writeFileSync(markerPath(sessionId), new Date().toISOString());
  } catch {
    // Best-effort — a missed marker only risks a duplicate nudge, never a block.
  }
}

function isGitDirty(cwd) {
  try {
    const output = execFileSync('git', ['status', '--porcelain'], {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().length > 0;
  } catch {
    return false; // Not a git repo, git unavailable, or command failed — nothing to nudge about.
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

    if (!isGitDirty(cwd)) {
      process.exit(0);
    }

    const tail = readTranscriptTail(data.transcript_path);
    if (/\/handoff/i.test(tail)) {
      process.exit(0);
    }

    const output = {
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext:
          'Uncommitted changes are present in this workspace and no /handoff has run this ' +
          'session. Run /handoff before ending the session to capture learnings and TODO state.',
      },
    };
    process.stdout.write(JSON.stringify(output));
    markNudged(sessionId);
    process.exit(0);

  } catch (err) {
    process.stderr.write(`[claude-code/nudge-handoff] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
