#!/usr/bin/env node
/**
 * Claude Code — PostToolUse Hook: Auto-Lint (Report Only)
 *
 * Detects the file type after an edit and runs the appropriate linter.
 * Reports violations back to Claude via the documented PostToolUse schema: stdout
 *   { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext } }
 * with exit 0. A bare top-level additionalContext is dropped by the harness.
 * Does NOT auto-fix — the user must approve fixes.
 *
 * Fail-open: linter failures are reported, never block work.
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const LINTER_MAP = {
  '.py': {
    name: 'ruff',
    build: (file) => ({ cmd: 'ruff', args: ['check', file] }),
    detect: () => commandExists('ruff'),
  },
  '.ts': {
    name: 'tsc',
    build: () => ({ cmd: 'npx', args: ['tsc', '--noEmit'] }),
    detect: (cwd) => fs.existsSync(path.join(cwd, 'tsconfig.json')),
  },
  '.tsx': {
    name: 'tsc',
    build: () => ({ cmd: 'npx', args: ['tsc', '--noEmit'] }),
    detect: (cwd) => fs.existsSync(path.join(cwd, 'tsconfig.json')),
  },
  '.js': {
    name: 'eslint',
    build: (file) => ({ cmd: 'npx', args: ['eslint', file] }),
    detect: (cwd) => (
      fs.existsSync(path.join(cwd, '.eslintrc.json')) ||
      fs.existsSync(path.join(cwd, '.eslintrc.js')) ||
      fs.existsSync(path.join(cwd, 'eslint.config.js'))
    ),
  },
};

function commandExists(cmd) {
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(which, [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runLinter(cmd, args, cwd) {
  try {
    const output = execFileSync(cmd, args, {
      cwd,
      encoding: 'utf-8',
      timeout: 15000, // 15s max
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output: output.trim() };
  } catch (err) {
    // Linter found issues (non-zero exit) — this is expected
    const stdout = (err.stdout || '').trim();
    const stderr = (err.stderr || '').trim();
    return { success: false, output: stdout || stderr || 'Linter reported issues.' };
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

    const toolInput = data.tool_input || {};
    const filePath = toolInput.file_path || toolInput.path || toolInput.filePath || '';
    const cwd = data.cwd || process.cwd();

    if (!filePath) {
      process.exit(0);
    }

    const ext = path.extname(filePath).toLowerCase();
    const linter = LINTER_MAP[ext];

    if (!linter) {
      process.exit(0); // No linter configured for this file type
    }

    if (!linter.detect(cwd)) {
      process.exit(0); // Linter tool not available
    }

    const { cmd, args } = linter.build(filePath, cwd);
    const result = runLinter(cmd, args, cwd);

    if (!result.success && result.output) {
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: [
            `Claude Code Auto-Lint (${linter.name}) — issues found:`,
            '```',
            result.output.substring(0, 2000), // Cap output length
            '```',
            'Report these to the user and wait for approval before fixing.',
          ].join('\n'),
        },
      };
      process.stdout.write(JSON.stringify(output));
    }

    process.exit(0);

  } catch (err) {
    process.stderr.write(`[claude-code/auto-lint] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
