#!/usr/bin/env node
/**
 * Claude Code — PostToolUse Hook: Audit Trail
 * 
 * Logs every tool action to Artifacts/.agent/audit_trail.jsonl
 * for post-session review and accountability.
 * 
 * Fail-open: logging failures never block work.
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

    const cwd = data.cwd || process.cwd();
    const root = findProjectRoot(cwd);
    const artifactsDir = path.join(root, 'Artifacts');

    // Only log in repos that already follow the Artifacts discipline. Never
    // scaffold Artifacts/ into a foreign repo just because it has a .git dir.
    if (!fs.existsSync(artifactsDir)) {
      process.exit(0);
    }

    const agentDir = path.join(artifactsDir, '.agent');
    const logFile = path.join(agentDir, 'audit_trail.jsonl');

    // Create the .agent subdir if needed (Artifacts/ is already present)
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }

    // Size-based rotation: keep the live log under 5 MB.
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
      session: data.session_id || 'unknown',
      tool: data.tool_name || 'unknown',
      input: summarizeInput(data.tool_input),
    };

    fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');

    process.exit(0);

  } catch (err) {
    // Fail-open: never block work for logging failures
    process.stderr.write(`[claude-code/audit-trail] Error: ${err.message}\n`);
    process.exit(0);
  }
}

/**
 * Summarize tool input to avoid logging full file contents.
 * Keeps file paths, commands, and key identifiers.
 */
function summarizeInput(toolInput) {
  if (!toolInput) return {};

  const summary = {};

  // Keep identifiers and paths
  if (toolInput.file_path) summary.file_path = toolInput.file_path;
  if (toolInput.path) summary.path = toolInput.path;
  if (toolInput.filePath) summary.filePath = toolInput.filePath;
  if (toolInput.command) summary.command = toolInput.command.substring(0, 200);

  // For edits, log what changed but not full content
  if (toolInput.old_string) summary.old_string_length = toolInput.old_string.length;
  if (toolInput.new_string) summary.new_string_length = toolInput.new_string.length;
  if (toolInput.content) summary.content_length = toolInput.content.length;

  // If nothing specific was captured, store first 3 keys
  if (Object.keys(summary).length === 0) {
    const keys = Object.keys(toolInput).slice(0, 3);
    for (const key of keys) {
      const val = toolInput[key];
      summary[key] = typeof val === 'string' ? val.substring(0, 100) : val;
    }
  }

  return summary;
}

main();
