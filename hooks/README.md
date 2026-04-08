# Claude Code Hooks — Setup Guide

Claude Code hooks that enforce security guardrails, auto-lint, inject session state, and log an audit trail.

## Installation

### 1. Copy the hooks config into your global Claude Code settings

Open (or create) `~/.claude/settings.json` and merge the contents of `settings-template.json` into it.

**On Windows**, the file is at:
```
C:\Users\<your-username>\.claude\settings.json
```

If `settings.json` already exists, merge the `hooks` block into the existing JSON. If it doesn't exist, copy `settings-template.json` as-is.

### 2. Verify hooks are active

In any Claude Code session, type:
```
/hooks
```

You should see all 5 hooks listed:
- `SessionStart` → `session-boot.js`
- `PreToolUse (Edit|MultiEdit|Write)` → `guard-paths.js`
- `PreToolUse (Bash)` → `guard-commands.js`
- `PostToolUse (Edit|MultiEdit|Write)` → `auto-lint.js`
- `PostToolUse (*)` → `audit-trail.js`

## Hook Reference

| Hook | Event | Purpose |
|:---|:---|:---|
| `session-boot.js` | `SessionStart` | Injects Artifacts state (TODO, Learnings, Current Task) into session context |
| `guard-paths.js` | `PreToolUse` | **Blocks** writes to binaries, secrets, build artifacts |
| `guard-commands.js` | `PreToolUse` | **Blocks** dangerous shell commands (rm -rf, force push, SQL drops) |
| `auto-lint.js` | `PostToolUse` | Reports lint violations after file edits (report-only, no auto-fix) |
| `audit-trail.js` | `PostToolUse` | Logs every tool action to `Artifacts/.agent/audit_trail.jsonl` |

## Design Philosophy

### Fail-Open
All hooks use a **fail-open** design: if the hook script itself crashes, it exits with code 0 (allow) and logs the error to stderr. This prevents a buggy hook from locking you out of Claude Code entirely.

### Report, Don't Fix
The `auto-lint.js` hook reports lint violations back to Claude as context, but does **not** auto-fix them. Claude will present the issues and wait for your approval before making any changes.

### Blocked Paths
`guard-paths.js` blocks writes to:
- **Binaries**: `.pbix`, `.3dm`, `.pptx`, `.xlsx`, `.exe`, `.dll`
- **Secrets**: `.env`, `*secrets*`, `*credentials*`
- **Build artifacts**: `dist/`, `build/`, `bin/`, `obj/`
- **VCS internals**: `.git/`

To customize, edit the `BLOCKED_*` constants in `guard-paths.js`.

### Blocked Commands
`guard-commands.js` blocks:
- `rm -rf /`, `rm -rf ~`, `del /s /q`
- `git push --force` (allows `--force-with-lease`)
- `DROP TABLE`, `DELETE FROM` (without WHERE), `TRUNCATE TABLE`
- Fork bombs, disk format commands, piped curl-to-shell

To customize, edit the `BLOCKED_PATTERNS` array in `guard-commands.js`.

## Troubleshooting

### Hooks not firing
- Ensure `~/.claude/settings.json` has valid JSON (no trailing commas)
- Check that the absolute paths in the `command` fields point to the correct location
- Run `claude --debug` to see verbose hook logs

### Hook blocking something it shouldn't
- Edit the relevant `guard-*.js` file and remove or adjust the pattern
- Restart Claude Code to reload hooks

### Auto-lint not reporting
- Verify the linter tool is installed and on your PATH (`ruff --version`, `npx tsc --version`)
- Check that the project has the appropriate config file (`pyproject.toml`, `tsconfig.json`, etc.)
