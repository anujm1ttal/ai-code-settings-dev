#!/usr/bin/env node
/**
 * Antigravity AI OS — PostToolUse Hook: Auto-Lint (Report Only)
 * 
 * Detects the file type after an edit and runs the appropriate linter.
 * Reports violations back to Claude as additionalContext.
 * Does NOT auto-fix — the user must approve fixes.
 * 
 * Fail-open: linter failures are reported, never block work.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const LINTER_MAP = {
  '.py': {
    name: 'ruff',
    check: (file) => `ruff check "${file}"`,
    detect: () => commandExists('ruff'),
  },
  '.ts': {
    name: 'tsc',
    check: (_file, cwd) => `npx tsc --noEmit`,
    detect: (cwd) => fs.existsSync(path.join(cwd, 'tsconfig.json')),
  },
  '.tsx': {
    name: 'tsc',
    check: (_file, cwd) => `npx tsc --noEmit`,
    detect: (cwd) => fs.existsSync(path.join(cwd, 'tsconfig.json')),
  },
  '.js': {
    name: 'eslint',
    check: (file) => `npx eslint "${file}"`,
    detect: (cwd) => (
      fs.existsSync(path.join(cwd, '.eslintrc.json')) ||
      fs.existsSync(path.join(cwd, '.eslintrc.js')) ||
      fs.existsSync(path.join(cwd, 'eslint.config.js'))
    ),
  },
};

function commandExists(cmd) {
  try {
    execSync(`where ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function runLinter(command, cwd) {
  try {
    const output = execSync(command, {
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

    const command = linter.check(filePath, cwd);
    const result = runLinter(command, cwd);

    if (!result.success && result.output) {
      const output = {
        additionalContext: [
          `🔍 Antigravity Auto-Lint (${linter.name}) — Issues Found:`,
          '```',
          result.output.substring(0, 2000), // Cap output length
          '```',
          'Report these to the user and wait for approval before fixing.',
        ].join('\n'),
      };
      process.stdout.write(JSON.stringify(output));
    }

    process.exit(0);

  } catch (err) {
    process.stderr.write(`[antigravity/auto-lint] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
