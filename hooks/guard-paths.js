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

function isBlocked(filePath) {
  if (!filePath) return null;

  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  const ext = path.extname(normalized);
  const basename = path.basename(normalized);
  const parts = normalized.split('/').filter(Boolean);

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

function deny(filePath, reason) {
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

    // Extract file path from tool input
    const toolInput = data.tool_input || {};
    const filePath = toolInput.file_path || toolInput.path || toolInput.filePath || '';

    const reason = isBlocked(filePath);

    if (reason) {
      deny(filePath, reason);
      return;
    }

    // Allowed
    process.exit(0);

  } catch (err) {
    // Fail-open: log error but never block legitimate work
    process.stderr.write(`[claude-code/guard-paths] Error: ${err.message}\n`);
    process.exit(0);
  }
}

main();
