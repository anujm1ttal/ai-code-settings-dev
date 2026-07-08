#!/usr/bin/env node
/**
 * Claude Code — Stop Hook: Evidence Gate
 *
 * Mechanizes verification-gate's Iron Law at turn-end: if the final assistant
 * message makes a completion claim (done/fixed/complete/finished/passing/...)
 * AND source edits happened this session, but no fresh passing test/lint run
 * followed the last source edit, injects an additionalContext nag naming the
 * exact unblock condition and the claim text it matched.
 *
 * Branch B ONLY (LH-2-Plan.md Design Fork, resolved from the LH-1 T5 spike):
 * additionalContext-only — NEVER a deny/block field or exit 2. The spike
 * proved every hard-block variant either hangs the session (exit 2, no
 * observed ceiling) or blanks the final turn output (decision:block give-up
 * path). Hard Rule 2 (LH-2-Plan.md) forbids resurrecting either.
 *
 * Respects `stop_hook_active` (harness-provided): if the Stop event is
 * already mid-retry-chain, stay silent rather than piling more context onto
 * a chain the harness is driving.
 *
 * Fail-open: any error (bad stdin, unreadable transcript, parse failure)
 * exits 0 with no output. Plumbing modeled on the shipped nudge-handoff.js
 * (LH-1 T4).
 */

const fs = require('fs');
const {
  parseTranscript,
  extractFinalAssistantText,
  matchCompletionClaim,
  hasSourceEdits,
  hasFreshEvidence,
} = require('./lib/evidence');

const CLAIM_EXCERPT_LENGTH = 120;

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

function buildMessage(claimText) {
  const excerpt = claimText.length > CLAIM_EXCERPT_LENGTH
    ? `${claimText.slice(0, CLAIM_EXCERPT_LENGTH)}...`
    : claimText;
  return (
    'IRON LAW (verification-gate): a completion claim was made without fresh test evidence ' +
    'this session. Run the relevant tests/lint and report the output, or retract/qualify the ' +
    `claim before ending the turn. Matched claim: "${excerpt}"`
  );
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

    if (data.stop_hook_active) {
      process.exit(0);
    }

    const entries = parseTranscript(readTranscript(data.transcript_path));
    if (entries.length === 0) {
      process.exit(0);
    }

    if (!hasSourceEdits(entries)) {
      process.exit(0);
    }

    const claimText = matchCompletionClaim(extractFinalAssistantText(entries));
    if (!claimText) {
      process.exit(0);
    }

    if (hasFreshEvidence(entries)) {
      process.exit(0);
    }

    const output = {
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext: buildMessage(claimText),
      },
    };
    process.stdout.write(JSON.stringify(output));
    logGateSafe({
      hook: 'evidence-gate',
      event: 'Stop',
      decision: 'nag',
      tool: null,
      ruleId: 'evidence-gate',
      cwd: data.cwd,
    });
    process.exit(0);

  } catch (err) {
    process.stderr.write(`[claude-code/evidence-gate] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
