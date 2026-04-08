#!/usr/bin/env node
/**
 * Antigravity AI OS — PreToolUse Hook: Path Guard
 * 
 * Blocks writes to protected file patterns (binaries, secrets, build artifacts).
 * Returns exit code 2 to deny the action, with a message explaining why.
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

const BLOCKED_DIRECTORIES = [
  'dist', 'build', 'bin', 'obj',                  // Build artifacts
  '.git',                                          // Version control internals
];

function isBlocked(filePath) {
  if (!filePath) return null;

  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const ext = path.extname(normalized);
  const basename = path.basename(normalized);

  // Check extension
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `Binary/archive file (${ext}) — AI agents must not modify these directly.`;
  }

  // Check exact filename
  if (BLOCKED_FILENAMES.has(basename)) {
    return `Secret file (${basename}) — contains sensitive environment variables.`;
  }

  // Check path segments
  for (const segment of BLOCKED_PATH_SEGMENTS) {
    if (normalized.includes(`/${segment}/`) || normalized.includes(`/${segment}`)) {
      return `Protected path segment (${segment}) — likely contains secrets or credentials.`;
    }
  }

  // Check directory prefixes
  const parts = normalized.split('/');
  for (const dir of BLOCKED_DIRECTORIES) {
    if (parts.includes(dir)) {
      return `Protected directory (${dir}/) — build artifacts and VCS internals are read-only.`;
    }
  }

  return null; // Not blocked
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

    // Extract file path from tool input
    const toolInput = data.tool_input || {};
    const filePath = toolInput.file_path || toolInput.path || toolInput.filePath || '';

    const reason = isBlocked(filePath);

    if (reason) {
      const output = {
        decision: 'deny',
        message: `🛡️ Antigravity Path Guard: BLOCKED\nFile: ${filePath}\nReason: ${reason}\n\nIf this is intentional, ask the user to make this change manually.`,
      };
      process.stdout.write(JSON.stringify(output));
      process.exit(2);
    }

    // Allowed
    process.exit(0);

  } catch (err) {
    // Fail-open: log error but never block legitimate work
    process.stderr.write(`[antigravity/guard-paths] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
