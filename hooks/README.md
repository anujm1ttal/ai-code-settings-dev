# Claude Code Hooks — Setup Guide

Claude Code hooks that enforce security guardrails, auto-lint, inject session state, and log an audit trail.

## Installation

### 1. Deploy the hook scripts

`bash scripts/deploy.sh` copies `hooks/` to `~/.claude/hooks/` (along with the rest
of the OS). The live `settings.json` command paths point at `~/.claude/hooks/*.js`,
**not** the dev repo — so a broken working-tree edit does not break production hooks
until you deploy. (This was fixed in Phase OSH-1; previously settings pointed at the
repo working copy.)

### 2. Point settings.json at the deployed hooks

Open (or create) `~/.claude/settings.json` and merge the `hooks` block from
`settings-template.json` into it. The template points at `C:/Users/44547/.claude/hooks/…`
— adjust the absolute path to your own home if different.

**On Windows**, the settings file is at:
```
C:\Users\<your-username>\.claude\settings.json
```

### 3. Verify hooks are active

In any Claude Code session, type:
```
/hooks
```

You should see all 5 hooks listed:
- `SessionStart` → `session-boot.js`
- `PreToolUse (Edit|MultiEdit|Write)` → `guard-paths.js`
- `PreToolUse (Bash|PowerShell)` → `guard-commands.js`
- `PostToolUse (Edit|MultiEdit|Write)` → `auto-lint.js`
- `PostToolUse (*)` → `audit-trail.js`

> **Note on output schemas.** Guards deny via the documented PreToolUse schema
> (`hookSpecificOutput.permissionDecision: "deny"` + `permissionDecisionReason`,
> exit 0), and context hooks inject via `hookSpecificOutput.additionalContext` — a
> bare top-level `additionalContext` or an exit-2 deny is silently dropped/reason-less.
> Hook `timeout` values in `settings-template.json` are in **seconds** (not ms).

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
- **Binaries**: `.pbix`, `.3dm`, `.pptx`, `.xlsx`, `.docx`, `.exe`, `.dll`, archives
- **Secrets**: `.env` (+ common variants; `.env.example` is allowed), and any
  `secrets/`, `credentials/`, `private_keys/` **path segment** (full-segment match —
  `src/secretsauce.py` and `docs/credentials-guide.md` are *not* blocked)
- **Build artifacts**: `dist/`, `build/`, `node_modules/`, and `bin/`/`obj/` **only**
  in the compiled-output layout (`bin/Debug`, `obj/Release`, …) — a bare `bin/`
  scripts dir is allowed
- **VCS internals**: `.git/`

To customize, edit the `BLOCKED_*` constants in `guard-paths.js`.

### Blocked Commands
`guard-commands.js` matches both the Bash and PowerShell tools and blocks:
- `rm -rf /`, `rm -rf ~`, `rm -rf C:/` (drive root), `rm -r .`
- Windows: `del`/`rd`/`rmdir … /s`, `format X:`
- PowerShell: `Remove-Item -Recurse -Force`, `Format-Volume`, `Clear-Disk`
- `git push --force` / `git push -f` (allows `--force-with-lease`), `git reset --hard`, `git clean -fd`
- `DROP TABLE`, `DELETE FROM` (without WHERE), `TRUNCATE TABLE`
- Fork bombs, block-device writes, piped curl-to-shell

To customize, edit the `BLOCKED_PATTERNS` array in `guard-commands.js`.

### Audit-trail hygiene
`audit-trail.js` only logs inside repos that already contain an `Artifacts/`
directory (it never scaffolds `Artifacts/` into a foreign repo) and rotates
`audit_trail.jsonl` once it exceeds 5 MB.

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
