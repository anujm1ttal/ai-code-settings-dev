#!/usr/bin/env node
/**
 * Claude Code — PreToolUse Hook: Command Guard
 *
 * Blocks dangerous shell commands before they execute. Matched against both the
 * Bash tool and the PowerShell tool (settings matcher: "Bash|PowerShell"), which
 * both carry the command string in tool_input.command.
 *
 * Denies via the documented PreToolUse schema: stdout
 *   { hookSpecificOutput: { hookEventName, permissionDecision: 'deny', permissionDecisionReason } }
 * with exit 0, so Claude receives the reason (exit-2 sends only stderr).
 *
 * Fail-open: script errors exit 0 to avoid blocking legitimate work.
 */

// --- Source-redirect guard (IGH-1 T2) -------------------------------------
// Shell redirection into a tracked source file bypasses the Write/Edit tools:
// it leaves no reviewable diff, silently truncates on `>`, and is the observed
// route by which shell/encoding damage reaches source files.
//
// Blast radius is deliberately narrow: a redirect is denied ONLY when its
// target ends in a tracked source extension. Every other redirect — including
// all evidence capture under Artifacts/Temp/ and Artifacts/Evidence/ — passes
// untouched. That narrowness also makes fd-duplication noise (`2>&1`, `>&2`)
// inert: those targets can never match a source extension, so they need no
// special case.
const SOURCE_EXTENSIONS = /\.(py|pyi|ts|tsx|js|jsx|mjs|cjs|md|json|ya?ml|tmdl|csproj|cs|dax|sh|ps1)$/i;

// Paths where writing IS legitimate. Artifacts/Temp and Artifacts/Evidence are
// load-bearing: rules/common/testing-strategy.md §3 *mandates*
// `<command> > Artifacts/Temp/<phase>_<step>_<command>.txt 2>&1` for evidence.
// A guard without these would fight the evidence protocol (IGH-1 Hard Rule 1).
const REDIRECT_ALLOWLIST = [
  /(^|[\\/])Artifacts[\\/]Temp[\\/]/i,
  /(^|[\\/])Artifacts[\\/]Evidence[\\/]/i,
  /(^|[\\/])scratch[\\/]/i,
  /^\/tmp\//,
  /^[a-zA-Z]:[\\/]tmp[\\/]/,
  /^\/dev\/null$/,
];

// Capture the target of a shell output redirect.
// The negative lookbehind keeps `->`, `=>`, `>=` and `!>` from being read as
// redirects — without it, a commit message like `rename a.py -> b.py` would be
// denied as if it wrote to b.py.
const REDIRECT_TARGET_RE = /(?<![-=<>!])\d?>>?\s*(['"]?)([^\s;|&<>()]+)\1/g;

// Angle-bracket placeholders (`<author>`, `<you>`, `<phase>_<step>`) are prose,
// but their closing `>` reads as a redirect operator and the text after it as a
// target: `C:/Users/<author>/.claude/hooks/*.js` was denied as a write to a
// `.js` file (observed 2026-07-28, a commit message describing this very hook —
// the second time a message about the guard tripped the guard; see the note on
// PS_WRITE_TARGET_RE below for the first).
//
// Stripping placeholders before scanning removes the spurious operator. It can
// only ever REMOVE a `>` from the scanned string, never introduce one, so it
// cannot open a bypass: `echo x>module.py` has no placeholder and still denies.
// Rejected alternative: widening the lookbehind to exclude `\w`. It kills this
// false positive but silently stops catching the space-free `x>module.py` form
// — trading a false positive for a false negative, the wrong direction for a
// guard.
const ANGLE_PLACEHOLDER_RE = /<[A-Za-z0-9_.-]+>/g;

// PowerShell is this environment's primary shell (settings matcher is
// "Bash|PowerShell"), where these cmdlets — not `>` — are the idiomatic way to
// write a file. Guarding only `>` would leave the guard trivially bypassable on
// the shell most likely to be used.
// Only the cmdlet's own destination counts. Scanning every token in the command
// instead would deny any command that merely NAMES one of these cmdlets while a
// source filename appears elsewhere in the same line — observed 2026-07-26, when
// a commit message describing this guard was denied by it.
const PS_WRITE_TARGET_RE =
  /\b(?:Out-File|Set-Content|Add-Content)\b\s+(?:-(?:Encoding|NoNewline|Force|Append|Confirm|WhatIf)\b\s*)*(?:-(?:File|Literal)?Path\s+)?(['"]?)([^\s;|&<>()]+)\1/i;

function stripQuotes(token) {
  return token.replace(/^['"]|['"]$/g, '');
}

function isProtectedTarget(rawTarget) {
  const target = stripQuotes(rawTarget);
  if (!SOURCE_EXTENSIONS.test(target)) return false;
  // A `..` segment can carry an allowlisted prefix straight back out into the
  // tree (`Artifacts/Temp/../../scripts/thing.py`), so a traversing target is
  // never allowlisted — the prefix no longer says where the write lands.
  if (/(^|[\\/])\.\.([\\/]|$)/.test(target)) return true;
  return !REDIRECT_ALLOWLIST.some((allowed) => allowed.test(target));
}

function redirectsIntoSource(rawCommand) {
  const command = rawCommand.replace(ANGLE_PLACEHOLDER_RE, '');
  for (const match of command.matchAll(REDIRECT_TARGET_RE)) {
    if (isProtectedTarget(match[2])) return true;
  }
  const psWrite = command.match(PS_WRITE_TARGET_RE);
  if (psWrite && isProtectedTarget(psWrite[2])) return true;
  return false;
}

// --- License gate config (HFO-2 T1) ---------------------------------------
// Single source of truth: hooks/license-gate.json. This literal fallback
// (used only when that file is absent, unreadable, or malformed) must stay
// identical to the JSON, the Python fallback in
// scripts/verify_deploy_parity.py, and the prose table in hooks/README.md —
// enforced by tests/test_license_gate_parity.py, never by eyeballing. R-A
// (the source-root command-deny rule that reads this config) lands in
// HFO-2 T2; T1 only prepares the shared config surface it will consume.
const LICENSE_GATE_FALLBACK = Object.freeze({
  source_roots: ['office-skills/ms-office', '.claude/skills/synced'],
  dest_prefixes: ['optional_plugins/ms-office/'],
  markers: ['all rights reserved', 'license: proprietary', 'anthropic, pbc'],
  self_exempt: ['hooks/license-gate.json'],
});

function loadLicenseGate() {
  try {
    const raw = require('fs').readFileSync(require('path').join(__dirname, 'license-gate.json'), 'utf-8');
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

// --- License-gate source-root guard (HFO-2 T2, rule R-A) -------------------
// Denies any Bash/PowerShell command whose text references a licensed-corpus
// source root (hooks/license-gate.json `source_roots`). Decided Q2=(iv),
// HFO-2-Plan.md §3: content-independent and HR2-compliant (existing hook,
// new pattern) — the only option that observes a bulk `cp -R`/`robocopy`/
// `xcopy`/`Copy-Item`, which guard-paths.js's Write-only matcher never sees.
//
// Does NOT fail closed by construction (Plan §3 Q2, accepted cost): the
// command string is always present, but the source root *inside* it is an
// optional signal — a `cd`-split two-call form, variable indirection, or a
// glob carries no matchable root. This raises the cost of a careless
// one-liner; it is not an airtight barrier.
//
// Backslash-to-slash normalization (not present in `license-gate.json`'s
// forward-slash roots) lets a Windows-native form (`xcopy C:\...\office-
// skills\ms-office ...`, `Copy-Item -Path "...\office-skills\ms-office"`)
// still match the same configured root string.
function referencesLicensedSourceRoot(command) {
  const { source_roots } = loadLicenseGate();
  const normalized = command.replace(/\\/g, '/');
  return source_roots.some((root) => normalized.includes(root));
}

const BLOCKED_PATTERNS = [
  // Source-redirect guard (IGH-1 T2) — see helpers above.
  {
    pattern: { test: redirectsIntoSource },
    reason:
      'Shell redirect writes into a tracked source file, bypassing review. ' +
      'Use the Write or Edit tool instead. ' +
      'Redirects into Artifacts/Temp/ and Artifacts/Evidence/ remain allowed for evidence capture.',
  },

  // Destructive filesystem operations — Unix
  { pattern: /rm\s+(-[a-zA-Z]+\s+)*\/\*?([\s;|&]|$)/, reason: 'Recursive delete at filesystem root.' },
  { pattern: /rm\s+(-[a-zA-Z]+\s+)*~/, reason: 'Recursive delete of home directory.' },
  { pattern: /rm\s+-[a-zA-Z]*r[a-zA-Z]*\s+\.(\s|$)/, reason: 'Recursive delete of current directory.' },
  { pattern: /rm\s+(-[a-zA-Z]+\s+)*[a-zA-Z]:[\\/]/i, reason: 'Recursive delete of a Windows drive root.' },

  // Destructive filesystem operations — Windows cmd
  { pattern: /\b(del|erase|rd|rmdir)\b[^\n]*\/s\b/i, reason: 'Windows recursive delete (/s).' },
  { pattern: /format\s+[a-zA-Z]:/i, reason: 'Disk format command.' },
  { pattern: /mkfs\./i, reason: 'Filesystem format command.' },

  // Destructive filesystem operations — PowerShell
  { pattern: /Remove-Item\b(?=[^\n]*-Recurse)(?=[^\n]*-Force)/i, reason: 'PowerShell recursive force delete (Remove-Item -Recurse -Force).' },
  { pattern: /\bFormat-Volume\b/i, reason: 'PowerShell volume format.' },
  { pattern: /\bClear-Disk\b/i, reason: 'PowerShell disk wipe.' },

  // Git destructive operations (allow --force-with-lease)
  { pattern: /git\s+push\b[^\n]*(--force\b(?!-with-lease)|\s-f\b)/, reason: 'Force push. Use --force-with-lease instead.' },
  { pattern: /git\s+reset\s+[^\n]*--hard/, reason: 'git reset --hard discards uncommitted changes.' },
  { pattern: /git\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*d/, reason: 'git clean -fd removes untracked files and directories permanently.' },

  // Database destruction
  { pattern: /DROP\s+(TABLE|DATABASE|SCHEMA)/i, reason: 'SQL destructive operation.' },
  { pattern: /DELETE\s+FROM\s+\S+\s*(;|\s*$)/i, reason: 'SQL DELETE without WHERE clause.' },
  { pattern: /TRUNCATE\s+TABLE/i, reason: 'SQL table truncation.' },

  // System-level danger
  { pattern: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, reason: 'Fork bomb.' },
  { pattern: />\s*\/dev\/sd[a-z]/i, reason: 'Direct write to block device.' },
  { pattern: /chmod\s+(-[a-zA-Z]*\s+)?777\s+\//i, reason: 'Recursive permission change at root.' },
  { pattern: /curl\s+.*\|\s*(ba)?sh/i, reason: 'Piping remote script to shell (supply chain risk).' },

  // AI attribution trailer in a commit — deny-list per standards.md. `git commit`
  // and the trailer text are checked as two INDEPENDENT conditions (not one
  // positional regex) so the deny still fires regardless of which substring
  // comes first in the command string — e.g. `echo "Co-Authored-By: Claude"
  // >> msg.txt && git commit -F msg.txt` puts the trailer before `git commit`
  // and would slip past a single ordered regex. Raw string containment (not
  // shell-parsed) means heredoc (`<<'EOF' ... EOF`) and PowerShell here-string
  // (`@" ... "@`) message bodies are already part of the command string.
  {
    pattern: {
      test: (command) =>
        /git\s+commit\b/i.test(command) &&
        /co-authored-by:\s*claude|generated with[\s\S]*?claude code/i.test(command),
    },
    reason: 'Commit message contains an AI attribution trailer (Co-Authored-By: Claude / Generated with Claude Code) — strip the attribution trailer and re-run (deny-list, standards.md).',
  },

  // License-gate source-root guard (HFO-2 T2, rule R-A) — see helper above.
  {
    pattern: { test: referencesLicensedSourceRoot },
    reason:
      'LICENSE-GATE R-A: command references a licensed-corpus source root ' +
      '(hooks/license-gate.json source_roots). Copying that content into the ' +
      "tracked tree risks republishing third-party-licensed material under this repo's " +
      'MIT license.',
  },
];

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

function deny(command, reason, context = {}) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        `Command Guard blocked "${command}": ${reason} ` +
        `If this is intentional, ask the user to run it manually.`,
    },
  };
  process.stdout.write(JSON.stringify(output));
  logGateSafe({
    hook: 'guard-commands',
    event: 'PreToolUse',
    decision: 'deny',
    tool: context.toolName,
    ruleId: 'guard-commands',
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
      process.exit(0);
    }

    let data;
    try {
      data = JSON.parse(input);
    } catch {
      process.exit(0);
    }

    const toolInput = data.tool_input || {};
    const command = toolInput.command || '';

    if (!command) {
      process.exit(0);
    }

    for (const { pattern, reason } of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        deny(command, reason, { toolName: data.tool_name, cwd: data.cwd });
        return;
      }
    }

    // Evaluated-nothing path: every BLOCKED_PATTERNS entry was tested against
    // this command and none matched — a real evaluation, reached after the
    // deny decision (R5).
    logPassSafe({ hook: 'guard-commands', event: 'PreToolUse', tool: data.tool_name, ruleId: 'guard-commands', cwd: data.cwd, sessionId: data.session_id, note: 'no-pattern-match' });
    process.exit(0);

  } catch (err) {
    process.stderr.write(`[claude-code/guard-commands] Error: ${err.message}\n`);
    process.exit(0);
  }
}

// Guarded so `require()`-ing this file (e.g. tests/test_license_gate_parity.py,
// HFO-2 T1, reading LICENSE_GATE_FALLBACK) never runs main()/reads stdin as a
// side effect. Invoked via `node hooks/guard-commands.js` in every real
// deployment, where require.main === module still holds.
if (require.main === module) {
  main();
}

module.exports = { LICENSE_GATE_FALLBACK, loadLicenseGate };
