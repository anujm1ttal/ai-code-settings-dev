#!/usr/bin/env node
/**
 * Claude Code — PreToolUse Hook: Path Guard
 *
 * Blocks writes to protected file patterns (binaries, secrets, build artifacts).
 * Denies via the documented PreToolUse schema: stdout
 *   { hookSpecificOutput: { hookEventName, permissionDecision: 'deny', permissionDecisionReason } }
 * with exit 0, so Claude receives the reason (exit-2 sends only stderr).
 *
 * Fail-open: script errors exit 0 to avoid blocking legitimate work.
 */

const path = require('path');

// Patterns that should NEVER be written by the AI agent
const BLOCKED_EXTENSIONS = new Set([
  '.pbix', '.3dm', '.pptx', '.xlsx', '.docx',  // Binary project files
  '.exe', '.dll', '.so', '.dylib',               // Compiled binaries
  '.zip', '.tar', '.gz', '.7z',                  // Archives
]);

const BLOCKED_FILENAMES = new Set([
  '.env', '.env.local', '.env.production', '.env.staging',
  '.env.development', '.env.test',
]);

const BLOCKED_PATH_SEGMENTS = [
  'secrets', 'credentials', 'private_keys',      // Secret stores
  'node_modules',                                  // Dependencies
];

// Always read-only regardless of context.
const ALWAYS_BLOCKED_DIRECTORIES = [
  'dist', 'build',                                 // Build artifacts
  '.git',                                          // Version control internals
];

// bin/ and obj/ are only build output in the .NET-style bin/Debug, obj/Release
// layout. A bare bin/ (e.g. a repo's scripts dir) is legitimate, so only block
// when the immediate child is a known compiled-output folder.
const COMPILED_OUTPUT_DIRS = new Set(['bin', 'obj']);
const COMPILED_OUTPUT_CHILDREN = new Set(['debug', 'release', 'x64', 'x86']);

// Project-state basenames (orchestration.md TODO Authority table) that must
// live under <workspace>/Artifacts/, never under the ~/.claude/projects/
// shadow directory (LH-1 T2 — orchestration.md Persistence HARD-GATE).
const STATE_FILE_BASENAMES = new Set([
  'todo.md', 'implementation_plan.md', 'handoff_brief.md', 'decision_log.md',
  'backlog.md', 'arch.md', 'layout_spec.md',
]);

// CPI-1: the rolling `audit_report.md` root basename was retired in favor of
// per-phase `<PHASE>-AUDIT_REPORT.md` (Artifacts/Reports/). A Set of exact
// basenames can't enumerate every future <PHASE>, so this one case is a
// suffix check instead of a literal member — a 1:1 literal swap would only
// ever protect the phase current at edit time and silently stop covering
// every phase after it.
const STATE_FILE_SUFFIX = '-audit_report.md';

// Native Claude Code features that legitimately write inside the
// ~/.claude/projects/ shadow tree — never gate these or the harness breaks.
const SHADOW_ALLOWLIST_SEGMENTS = new Set(['memory', 'tool-results']);

// --- License gate config (HFO-2 T1) ---------------------------------------
// Single source of truth: hooks/license-gate.json. This literal fallback
// (used only when that file is absent, unreadable, or malformed) must stay
// identical to the JSON, the Python fallback in
// scripts/verify_deploy_parity.py, and the prose table in hooks/README.md —
// enforced by tests/test_license_gate_parity.py, never by eyeballing. R-B/R-C
// (the destination-prefix and marker rules that read this config) land in
// HFO-2 T3; T1 only prepares the shared config surface they will consume.
const LICENSE_GATE_FALLBACK = Object.freeze({
  source_roots: ['office-skills/ms-office', '.claude/skills/synced'],
  dest_prefixes: ['optional_plugins/ms-office/'],
  markers: ['all rights reserved', 'license: proprietary', 'anthropic, pbc'],
  self_exempt: ['hooks/license-gate.json'],
});

function loadLicenseGate() {
  try {
    const raw = require('fs').readFileSync(path.join(__dirname, 'license-gate.json'), 'utf-8');
    const data = JSON.parse(raw);
    if (
      !Array.isArray(data.source_roots) || data.source_roots.length === 0 ||
      !Array.isArray(data.dest_prefixes) ||
      !Array.isArray(data.markers) ||
      !Array.isArray(data.self_exempt)
    ) {
      throw new Error('malformed license-gate.json');
    }
    return data;
  } catch {
    return { ...LICENSE_GATE_FALLBACK };
  }
}

// True if `needle` occurs as a consecutive run inside `haystack` — mirrors
// scripts/verify_deploy_parity.py's `_path_contains_segments` (HFO-2 T5) so
// R-B never degrades to a `startsWith`/substring test, which `file_path`
// arriving absolute (never relative) would silently defeat in production.
function pathContainsSegments(haystack, needle) {
  const n = needle.length;
  if (n === 0 || n > haystack.length) return false;
  for (let i = 0; i <= haystack.length - n; i++) {
    let match = true;
    for (let j = 0; j < n; j++) {
      if (haystack[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) return true;
  }
  return false;
}

// Suffix variant for `self_exempt` — a specific repo-relative file, not a
// prefix, so anchoring to the end of the path avoids a coincidental mid-path
// segment run.
function pathEndsWithSegments(haystack, needle) {
  const n = needle.length;
  if (n === 0 || n > haystack.length) return false;
  for (let j = 0; j < n; j++) {
    if (haystack[haystack.length - n + j] !== needle[j]) return false;
  }
  return true;
}

// Codex reports file edits as one apply_patch command, which may touch several
// paths. Check every section, including rename destinations, before allowing it.
function patchTargets(command) {
  if (typeof command !== 'string') return [];
  const targets = [];
  let current = null;
  for (const line of command.split(/\r?\n/)) {
    const file = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/.exec(line);
    if (file) {
      current = { path: file[1].trim(), payload: '' };
      targets.push(current);
      continue;
    }
    const moved = /^\*\*\* Move to: (.+)$/.exec(line);
    if (moved) {
      current = { path: moved[1].trim(), payload: '' };
      targets.push(current);
      continue;
    }
    if (current && line.startsWith('+') && !line.startsWith('+++')) {
      current.payload += line.slice(1) + '\n';
    }
  }
  return targets;
}

function isBlocked(filePath, payload) {
  if (!filePath) return null;

  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const ext = path.extname(normalized);
  const basename = path.basename(normalized);
  const parts = normalized.split('/').filter(Boolean);
  const allowlisted = parts.some((p) => SHADOW_ALLOWLIST_SEGMENTS.has(p));

  // State file written under the ~/.claude/projects/ shadow tree — project
  // state belongs in the workspace, not the AI-brain directory.
  if (!allowlisted && (STATE_FILE_BASENAMES.has(basename) || basename.endsWith(STATE_FILE_SUFFIX))) {
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === '.claude' && parts[i + 1] === 'projects') {
        return `State file (${basename}) written under a shadow path (.claude/projects/) — ` +
          `project state belongs in <workspace>/Artifacts/ (orchestration.md HARD-GATE). ` +
          `Write it to Artifacts/ in the project workspace instead.`;
      }
    }
  }

  // Bare scratch/ directory (distinct from the harness's own scratchpad/
  // temp dirs) — one-off scripts and temp data belong in Artifacts/Temp/.
  if (!allowlisted && parts.includes('scratch')) {
    return `Bare scratch/ directory segment — one-off scripts and temp data belong in ` +
      `<workspace>/Artifacts/Temp/ (orchestration.md Scratch Strategy HARD-GATE).`;
  }

  // R-B / R-C (HFO-2 T3): licensed-content destination prefix and marker
  // detection, keyed on hooks/license-gate.json (Q1=C, provenance-scoped).
  const gate = loadLicenseGate();

  // R-B: destination path falls under a known-encumbered destination prefix.
  // Consecutive path-segment match — never `startsWith` (see
  // pathContainsSegments above).
  for (const prefix of gate.dest_prefixes) {
    const needle = prefix.replace(/\\/g, '/').toLowerCase().split('/').filter(Boolean);
    if (pathContainsSegments(parts, needle)) {
      return `Destination path falls under a licensed-content prefix (${prefix}) — ` +
        `LICENSE-GATE R-B: this destination has previously carried third-party-licensed ` +
        `content (hooks/license-gate.json dest_prefixes).`;
    }
  }

  // R-C: payload carries a licensing marker, provenance-scoped to files git
  // has never seen (Q1=C) — an unscoped scan self-denies this repo, since
  // CLAUDE.md and HFO-2-Plan.md both carry the markers verbatim. Never reads
  // self_exempt (hooks/license-gate.json itself, which necessarily contains
  // the markers it defines).
  const selfExempt = gate.self_exempt.some((exempt) => {
    const needle = exempt.replace(/\\/g, '/').toLowerCase().split('/').filter(Boolean);
    return pathEndsWithSegments(parts, needle);
  });
  if (payload && !selfExempt && !require('fs').existsSync(filePath)) {
    const lowerPayload = payload.toLowerCase();
    for (const marker of gate.markers) {
      if (lowerPayload.includes(marker.toLowerCase())) {
        return `New file contains a licensing marker ("${marker}") — ` +
          `LICENSE-GATE R-C: verify this is not third-party-licensed content before writing it ` +
          `(hooks/license-gate.json markers).`;
      }
    }
  }

  // Check extension
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `Binary/archive file (${ext}) — AI agents must not modify these directly.`;
  }

  // Check exact filename
  if (BLOCKED_FILENAMES.has(basename)) {
    return `Secret file (${basename}) — contains sensitive environment variables.`;
  }

  // Check path segments — full-segment match only (no substring false positives
  // such as src/secretsauce.py or docs/credentials-guide.md).
  for (const segment of BLOCKED_PATH_SEGMENTS) {
    if (parts.includes(segment)) {
      return `Protected path segment (${segment}/) — likely contains secrets or credentials.`;
    }
  }

  // Always-protected directories
  for (const dir of ALWAYS_BLOCKED_DIRECTORIES) {
    if (parts.includes(dir)) {
      return `Protected directory (${dir}/) — build artifacts and VCS internals are read-only.`;
    }
  }

  // Compiled-output directories (bin/Debug, obj/Release, ...)
  for (let i = 0; i < parts.length - 1; i++) {
    if (COMPILED_OUTPUT_DIRS.has(parts[i]) && COMPILED_OUTPUT_CHILDREN.has(parts[i + 1])) {
      return `Compiled-output directory (${parts[i]}/${parts[i + 1]}/) — build artifacts are read-only.`;
    }
  }

  return null; // Not blocked
}

// Lazy-required and independently try/catch-wrapped (not a top-level
// require) so a bug in the logger can only ever be swallowed here — it can
// never crash this file before the deny() output above it is written
// (LH-3 T1b, Hard Rule 1).
function logGateSafe(params) {
  try {
    require('./lib/gate-log').logGateEvent(params);
  } catch {
    // Logging must never affect this hook's decision or exit code.
  }
}

// Same lazy-required, independently wrapped discipline as logGateSafe, for
// the once-per-session heartbeat (HFO-1 T4).
function logPassSafe(params) {
  try {
    require('./lib/gate-log').logPassOnce(params);
  } catch {
    // Logging must never affect this hook's decision or exit code.
  }
}

function deny(filePath, reason, context = {}) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `Path Guard blocked "${filePath}": ${reason} ` +
        `If this is intentional, ask the user to make this change manually.`,
    },
  };
  process.stdout.write(JSON.stringify(output));
  logGateSafe({
    hook: 'guard-paths',
    event: 'PreToolUse',
    decision: 'deny',
    tool: context.toolName,
    ruleId: 'guard-paths',
    cwd: context.cwd,
  });
  process.exit(0);
}

function main() {
  try {
    let input = '';
    try {
      input = require('fs').readFileSync(0, 'utf-8');
    } catch {
      process.exit(0); // Can't read stdin, fail-open
    }

    let data;
    try {
      data = JSON.parse(input);
    } catch {
      process.exit(0); // Bad JSON, fail-open
    }

    // Extract file path from tool input (notebook_path covers NotebookEdit)
    const toolInput = data.tool_input || {};
    const filePath = toolInput.file_path || toolInput.path || toolInput.filePath || toolInput.notebook_path || '';

    // Total payload extraction by tool shape (security.md fix — HFO-2 T3,
    // Q4(b)): pre-T3, isBlocked() saw path fields only, so a content-based
    // rule silently no-op'd for 3 of the 4 matched tools (Edit/MultiEdit/
    // NotebookEdit). A truthy tool_name outside the four known shapes (a
    // future 5th tool, schema drift) is not silently absorbed — it is
    // flagged below and logged via logGateEvent directly, never logPassOnce
    // (whose (hook,session) marker the ordinary heartbeat already spends).
    // tool_name absent entirely (pre-T3 test fixtures) is a legacy no-op:
    // payload stays '' and no unknown-shape row is emitted.
    const toolName = data.tool_name;
    let payload = '';
    let payloadShapeUnknown = false;
    if (toolName === 'Write') {
      payload = toolInput.content || '';
    } else if (toolName === 'Edit') {
      payload = toolInput.new_string || '';
    } else if (toolName === 'MultiEdit') {
      const edits = Array.isArray(toolInput.edits) ? toolInput.edits : [];
      payload = edits.map((e) => (e && typeof e.new_string === 'string') ? e.new_string : '').join('\n');
    } else if (toolName === 'NotebookEdit') {
      payload = toolInput.new_source || '';
    } else if (toolName === 'apply_patch') {
      // The section parser below supplies path and payload for each file.
    } else if (toolName) {
      payloadShapeUnknown = true;
    }

    const targets = toolName === 'apply_patch'
      ? patchTargets(toolInput.command)
      : [{ path: filePath, payload }];
    for (const target of targets) {
      const reason = isBlocked(target.path, target.payload);
      if (reason) {
        deny(target.path, reason, { toolName: data.tool_name, cwd: data.cwd });
        return;
      }
    }

    if (payloadShapeUnknown) {
      logGateSafe({ hook: 'guard-paths', event: 'PreToolUse', decision: 'pass', tool: data.tool_name, ruleId: 'guard-paths', cwd: data.cwd, note: 'payload-shape-unknown' });
    }

    // Evaluated-nothing path: isBlocked() tested filePath against every rule
    // and none matched — a real evaluation, reached after the deny
    // decision (R5).
    logPassSafe({ hook: 'guard-paths', event: 'PreToolUse', tool: data.tool_name, ruleId: 'guard-paths', cwd: data.cwd, sessionId: data.session_id, note: 'no-path-match' });
    process.exit(0);

  } catch (err) {
    // Fail-open: log error but never block legitimate work
    process.stderr.write(`[claude-code/guard-paths] Error: ${err.message}\n`);
    process.exit(0);
  }
}

// Guarded so `require()`-ing this file (e.g. tests/test_license_gate_parity.py,
// HFO-2 T1, reading LICENSE_GATE_FALLBACK) never runs main()/reads stdin as a
// side effect. Invoked via `node hooks/guard-paths.js` in every real
// deployment, where require.main === module still holds.
if (require.main === module) {
  main();
}

module.exports = { LICENSE_GATE_FALLBACK, loadLicenseGate };
