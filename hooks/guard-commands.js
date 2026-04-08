#!/usr/bin/env node
/**
 * Claude Code — PreToolUse Hook: Command Guard
 * 
 * Blocks dangerous shell commands before they execute.
 * Returns exit code 2 to deny the action.
 * 
 * Fail-open: script errors exit 0 to avoid blocking legitimate work.
 */

const BLOCKED_PATTERNS = [
  // Destructive filesystem operations
  { pattern: /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?\/([\s;|&]|$)/, reason: 'Recursive delete at filesystem root.' },
  { pattern: /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?~/, reason: 'Recursive delete of home directory.' },
  { pattern: /rm\s+-[a-zA-Z]*r[a-zA-Z]*\s+-[a-zA-Z]*f[a-zA-Z]*\s+\.(\s|$)/, reason: 'Recursive force-delete of current directory.' },
  { pattern: /del\s+\/s\s+\/q/i, reason: 'Windows recursive silent delete.' },
  { pattern: /format\s+[a-zA-Z]:/i, reason: 'Disk format command.' },
  { pattern: /mkfs\./i, reason: 'Filesystem format command.' },

  // Git force operations (allow --force-with-lease)
  { pattern: /git\s+push\s+.*--force(?!-with-lease)/, reason: 'Force push without --force-with-lease. Use --force-with-lease instead.' },
  { pattern: /git\s+clean\s+-[a-zA-Z]*f[a-zA-Z]*d/, reason: 'git clean -fd removes untracked files and directories permanently.' },

  // Database destruction
  { pattern: /DROP\s+(TABLE|DATABASE|SCHEMA)/i, reason: 'SQL destructive operation.' },
  { pattern: /DELETE\s+FROM\s+\S+\s*(;|\s*$)/i, reason: 'SQL DELETE without WHERE clause.' },
  { pattern: /TRUNCATE\s+TABLE/i, reason: 'SQL table truncation.' },

  // System-level danger
  { pattern: /:(){ :\|:& };:/,  reason: 'Fork bomb.' },
  { pattern: />\s*\/dev\/sd[a-z]/i, reason: 'Direct write to block device.' },
  { pattern: /chmod\s+(-[a-zA-Z]*\s+)?777\s+\//i, reason: 'Recursive permission change at root.' },
  { pattern: /curl\s+.*\|\s*(ba)?sh/i, reason: 'Piping remote script to shell (supply chain risk).' },
];

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
        const output = {
          decision: 'deny',
          message: `⚠️ Claude Code Command Guard: BLOCKED\nCommand: ${command}\nReason: ${reason}\n\nIf this is intentional, ask the user to run it manually.`,
        };
        process.stdout.write(JSON.stringify(output));
        process.exit(2);
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
