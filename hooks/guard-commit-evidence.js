#!/usr/bin/env node
/**
 * Claude Code — PreToolUse Hook: Commit Evidence Guard
 *
 * Mechanical enforcement of the verification-gate Iron Law:
 * blocks `git commit` unless fresh verification evidence exists in
 * Artifacts/Temp/ (a file matching an evidence pattern, modified within
 * the freshness window).
 *
 * OPT-IN per project: enforced only when the project.json in the
 * working directory declares "enforce_commit_evidence": true.
 *
 * Escape hatch (auditable): a commit message containing
 * [no-verify-evidence] bypasses the check — for docs-only commits.
 *
 * Fail-open: script errors exit 0 to avoid blocking legitimate work.
 */

const fs = require('fs');
const path = require('path');

const FRESHNESS_MINUTES = 30;
const EVIDENCE_PATTERN = /(pytest|test|ruff|lint|pyright|tsc|typecheck|build|check|evidence)/i;

function findEvidence(tempDir, freshestAllowedMs) {
  let entries;
  try {
    entries = fs.readdirSync(tempDir);
  } catch {
    return null;
  }
  for (const name of entries) {
    if (!EVIDENCE_PATTERN.test(name)) continue;
    try {
      const stat = fs.statSync(path.join(tempDir, name));
      if (stat.isFile() && stat.mtimeMs >= freshestAllowedMs) {
        return name;
      }
    } catch {
      // unreadable entry — skip
    }
  }
  return null;
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

    const command = (data.tool_input || {}).command || '';
    if (!/\bgit\s+([\s\S]*\s)?commit\b/.test(command)) {
      process.exit(0);
    }

    // Auditable escape hatch for docs-only commits
    if (command.includes('[no-verify-evidence]')) {
      process.exit(0);
    }

    const cwd = data.cwd || process.cwd();

    // Opt-in: only enforce when project.json declares it
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(cwd, 'project.json'), 'utf-8'));
    } catch {
      process.exit(0); // no manifest → not enforced
    }
    if (manifest.enforce_commit_evidence !== true) {
      process.exit(0);
    }

    const freshestAllowedMs = Date.now() - FRESHNESS_MINUTES * 60 * 1000;
    const evidence = findEvidence(path.join(cwd, 'Artifacts', 'Temp'), freshestAllowedMs);

    if (evidence) {
      process.exit(0);
    }

    const output = {
      decision: 'deny',
      message:
        `⚠️ Claude Code Commit Evidence Guard: BLOCKED\n` +
        `This project enforces the verification-gate Iron Law: no commit without fresh verification evidence.\n` +
        `No evidence file (matching ${EVIDENCE_PATTERN}) modified in the last ${FRESHNESS_MINUTES} minutes was found in Artifacts/Temp/.\n\n` +
        `To proceed:\n` +
        `1. Run the verification suite and redirect output, e.g.:\n` +
        `   pytest > Artifacts/Temp/<phase>_<step>_pytest.txt 2>&1\n` +
        `2. Re-run the commit.\n` +
        `For a docs-only commit, include [no-verify-evidence] in the commit message (auditable bypass).`,
    };
    process.stdout.write(JSON.stringify(output));
    process.exit(2);
  } catch (err) {
    process.stderr.write(`[claude-code/guard-commit-evidence] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
