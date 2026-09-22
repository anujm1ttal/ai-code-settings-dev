/**
 * Claude Code — Shared Gate-Event Logger (LH-3 T1a)
 *
 * Appends one JSONL line per hook fire (deny/nag) to
 * Artifacts/.agent/gate_events.jsonl, next to audit_trail.jsonl. Read side:
 * scripts/gate_telemetry.py; surfaced at /handoff (LH-3 T1d).
 *
 * B1 (LH-3-Plan.md): audit_trail.jsonl only records tool invocations that
 * actually ran — a PreToolUse deny means PostToolUse (and audit-trail.js)
 * never fires, so denied/nagged decisions need their own log.
 *
 * Fail-open WITHIN fail-open (Hard Rule 1 / B4): this function is entirely
 * wrapped in try/catch — any failure (path resolution, permissions, disk) is
 * swallowed silently and NEVER surfaces to the caller. Call sites invoke this
 * strictly AFTER their own deny/nag decision is finalized and already written
 * to stdout, so this function cannot alter that decision or the hook's exit
 * code. It performs its own fs.appendFileSync (not a Claude tool call) so the
 * scratch-gate never intercepts it.
 *
 * Path resolution duplicated verbatim from audit-trail.js's findProjectRoot
 * (not imported) so this stays a single self-contained file with zero
 * cross-hook coupling.
 */

const fs = require('fs');
const path = require('path');

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

/**
 * Log one gate event. Parameters:
 *   hook     - hook basename without extension, e.g. 'guard-paths'
 *   event    - hook event, e.g. 'PreToolUse' | 'PostToolUse' | 'Stop'
 *   decision - 'deny' | 'nag' | 'pass'
 *   tool     - the tool name that triggered the fire, or null (Stop hooks)
 *   ruleId   - matches hooks/enforced-rules.json rule_id for this hook
 *   cwd      - the hook's data.cwd (preferred over process.cwd() — matches
 *              audit-trail.js's own `data.cwd || process.cwd()` resolution)
 *   ...rest  - any additional caller-supplied fields (e.g. task-diff-guard's
 *              SGH-1b `filtered_n`/`settled_n`/`note`) pass through verbatim.
 *              Additive/backward-compatible: existing callers that only pass
 *              the six fixed fields are unaffected.
 *
 * Never throws, for ANY argument shape — including null, undefined, or a
 * non-object (e.g. a number). Destructuring happens INSIDE the try block
 * (not in the parameter list) so a hostile/malformed argument can't throw
 * before the protected block even starts — a default parameter (`= {}`)
 * alone does not cover this, since defaults only apply to `undefined`, not
 * `null` or other non-object values. Returns nothing meaningful — callers
 * must not depend on a return value to make decisions.
 */
function logGateEvent(params) {
  try {
    const { hook, event, decision, tool, ruleId, cwd, ...rest } = params || {};
    const root = findProjectRoot(cwd || process.cwd());
    const artifactsDir = path.join(root, 'Artifacts');

    // Same discipline as audit-trail.js: never scaffold Artifacts/ into a
    // foreign repo just because it has a .git dir.
    if (!fs.existsSync(artifactsDir)) return;

    const agentDir = path.join(artifactsDir, '.agent');
    const logFile = path.join(agentDir, 'gate_events.jsonl');

    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }

    // Size-based rotation: keep the live log under 5 MB. Mirrors
    // audit-trail.js's rotation verbatim (own try/catch, best-effort) so this
    // repo carries one rotation idiom, not two.
    try {
      const MAX_BYTES = 5 * 1024 * 1024;
      if (fs.existsSync(logFile) && fs.statSync(logFile).size > MAX_BYTES) {
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        fs.renameSync(logFile, logFile.replace(/\.jsonl$/, `.${stamp}.jsonl`));
      }
    } catch {
      // Rotation is best-effort; never block logging on it.
    }

    const entry = {
      ts: new Date().toISOString(),
      hook: hook || 'unknown',
      event: event || 'unknown',
      decision: decision || 'unknown',
      tool: tool || null,
      ruleId: ruleId || null,
      ...rest,
    };

    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch {
    // Fail-open within fail-open: logging must never affect the caller's
    // decision or exit code (Hard Rule 1, LH-3-Plan.md B4).
  }
}

/**
 * Once-per-(hook, session) heartbeat. Parameters: same shape as
 * logGateEvent's, plus a required `sessionId` (the hook's data.session_id —
 * same field audit-trail.js:74 and nudge-handoff.js's alreadyNudged() already
 * key on). `decision` is always 'pass'; callers must not pass a different one.
 *
 * WHY once-per-session, not per-invocation (HFO-1-Plan.md §3): guard-commands
 * fires on every Bash/PowerShell call — logging every no-op pass would add
 * thousands of rows per session to a file whose only cap is the rotation
 * above. A heartbeat ("this hook ran and reached its no-op path this
 * session") answers dead-vs-quiet completely at ~1 row per hook per session.
 *
 * Mechanism generalises nudge-handoff.js's alreadyNudged(sessionId) marker
 * (an OS-temp existence-check file) to a marker keyed on (hook, session)
 * instead of session alone, so six more hooks can share one file's worth of
 * dedup logic. Markers live under Artifacts/.agent/pass_markers/ — NOT the OS
 * temp dir nudge-handoff uses — because this is the gate-log family of state
 * (same directory as gate_events.jsonl), and a Claude-tool write there would
 * need to clear guard-paths.js's scratch-gate; Artifacts/.agent/ already does
 * (it is not `scratch/`, not a shadow `.claude/projects/` path, and this
 * function writes via fs directly, not a Claude tool call, exactly like
 * logGateEvent's own appendFileSync).
 *
 * Retention: markers are NEVER cleaned up by this function — one file per
 * (hook, session) accumulates for the life of the project. Bounded growth:
 * at most (number of gate-logging hooks) x (number of sessions ever run) tiny
 * empty-ish files (a single ISO timestamp each), e.g. ~8 hooks x hundreds of
 * sessions/year is low hundreds of files, not a size concern the way
 * gate_events.jsonl is. No rotation is added here in this phase — flagged as
 * a finding for T8 if the file *count* (not size) ever becomes a problem.
 *
 * Never throws, for any argument shape — same discipline as logGateEvent.
 * Missing/null hook or sessionId fall back to fixed placeholder keys rather
 * than skipping the dedup check, so the call degrades to writing exactly one
 * row per invocation rather than throwing or silently disappearing.
 */
function logPassOnce(params) {
  try {
    const { hook, sessionId, ...rest } = params || {};
    const cwd = (rest && rest.cwd) || process.cwd();
    const root = findProjectRoot(cwd);
    const artifactsDir = path.join(root, 'Artifacts');

    if (!fs.existsSync(artifactsDir)) return;

    const markerDir = path.join(artifactsDir, '.agent', 'pass_markers');
    const safeHook = String(hook || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const safeSession = String(sessionId || 'unknown-session').replace(/[^a-zA-Z0-9_.-]/g, '_');
    const markerFile = path.join(markerDir, `${safeHook}.${safeSession}.marker`);

    if (fs.existsSync(markerFile)) return; // already logged this (hook, session)

    logGateEvent({ hook, decision: 'pass', ...rest });

    try {
      fs.mkdirSync(markerDir, { recursive: true });
      fs.writeFileSync(markerFile, new Date().toISOString());
    } catch {
      // Best-effort — a missed marker only risks a duplicate pass row next
      // call, never a block (same tradeoff as nudge-handoff's markNudged()).
    }
  } catch {
    // Fail-open within fail-open: logging must never affect the caller's
    // decision or exit code (Hard Rule 1, LH-3-Plan.md B4).
  }
}

module.exports = { logGateEvent, logPassOnce, findProjectRoot };
