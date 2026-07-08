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

const BLOCKED_PATTERNS = [
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
];

function deny(command, reason) {
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
        deny(command, reason);
        return;
      }
    }

    // Allowed
    process.exit(0);

  } catch (err) {
    process.stderr.write(`[claude-code/guard-commands] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
