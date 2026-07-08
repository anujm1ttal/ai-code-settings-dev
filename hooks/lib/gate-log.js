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
 *   decision - 'deny' | 'nag'
 *   tool     - the tool name that triggered the fire, or null (Stop hooks)
 *   ruleId   - matches hooks/enforced-rules.json rule_id for this hook
 *   cwd      - the hook's data.cwd (preferred over process.cwd() — matches
 *              audit-trail.js's own `data.cwd || process.cwd()` resolution)
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
    const { hook, event, decision, tool, ruleId, cwd } = params || {};
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

    const entry = {
      ts: new Date().toISOString(),
      hook: hook || 'unknown',
      event: event || 'unknown',
      decision: decision || 'unknown',
      tool: tool || null,
      ruleId: ruleId || null,
    };

    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  } catch {
    // Fail-open within fail-open: logging must never affect the caller's
    // decision or exit code (Hard Rule 1, LH-3-Plan.md B4).
  }
}

module.exports = { logGateEvent, findProjectRoot };
