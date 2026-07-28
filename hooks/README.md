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
`settings-template.json` into it verbatim — no path editing required.

The template invokes `node "$HOME/.claude/hooks/<hook>.js"`. Hook commands without an
`args` key run in **shell form** (`sh -c` on macOS/Linux, Git Bash on Windows, falling
back to PowerShell), so `$HOME` is expanded by the shell before `node` sees it. It
resolves correctly on all three — `$HOME` is a valid variable in PowerShell too.

Settings file locations:
```
Windows   C:\Users\<you>\.claude\settings.json
macOS     ~/Library/…  → just use ~/.claude/settings.json
Linux     ~/.claude/settings.json
```

### 3. Verify hooks are active

In any Claude Code session, type:
```
/hooks
```

You should see all 8 hooks listed:
- `SessionStart` → `session-boot.js`
- `PreToolUse (Edit|MultiEdit|Write)` → `guard-paths.js`
- `PreToolUse (Bash|PowerShell)` → `guard-commands.js`
- `PostToolUse (Edit|MultiEdit|Write)` → `auto-lint.js`
- `PostToolUse (*)` → `audit-trail.js`
- `Stop` → `nudge-handoff.js`
- `Stop` → `evidence-gate.js`
- `Stop` → `guard-shared-state.js`

> **Note on output schemas.** Guards deny via the documented PreToolUse schema
> (`hookSpecificOutput.permissionDecision: "deny"` + `permissionDecisionReason`,
> exit 0), and context hooks inject via `hookSpecificOutput.additionalContext` — a
> bare top-level `additionalContext` or an exit-2 deny is silently dropped/reason-less.
> Hook `timeout` values in `settings-template.json` are in **seconds** (not ms).

## Hook Reference

| Hook | Event | Purpose |
|:---|:---|:---|
| `session-boot.js` | `SessionStart` | Injects Artifacts state (TODO, Learnings, Current Task) into session context |
| `guard-paths.js` | `PreToolUse` | **Blocks** writes to binaries, secrets, build artifacts, project state files in shadow paths, bare scratch/ |
| `guard-commands.js` | `PreToolUse` | **Blocks** dangerous shell commands (rm -rf, force push, SQL drops) and AI attribution trailers in commits |
| `auto-lint.js` | `PostToolUse` | Reports lint violations and injects "fix before proceeding" directive (no auto-fix) |
| `audit-trail.js` | `PostToolUse` | Logs every tool action to `Artifacts/.agent/audit_trail.jsonl` |
| `nudge-handoff.js` | `Stop` | Nudges to run `/handoff` if git tree is dirty and no handoff this session (feedback only) |
| `evidence-gate.js` | `Stop` | Nags when completion claims made without fresh test evidence this session (feedback only) |
| `guard-shared-state.js` | `Stop` | Nags when process-global state (stdout/stderr, logging, os.environ) changed without a full-suite run (feedback only) |

## Design Philosophy

### Fail-Open
All hooks use a **fail-open** design: if the hook script itself crashes, it exits with code 0 (allow) and logs the error to stderr. This prevents a buggy hook from locking you out of Claude Code entirely.

### Report, Don't Fix
The `auto-lint.js` hook reports lint violations back to Claude as context and injects a "fix before proceeding" directive. It does **not** auto-fix files itself — Claude receives the violations and must fix them before proceeding.

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
- **Project state in shadow (scratch-gate)**: Files like `TODO.md`, `DECISION_LOG.md`, `IMPLEMENTATION_PLAN.md` written under `~/.claude/projects/` — project state belongs in `<workspace>/Artifacts/` per orchestration.md HARD-GATE
- **Bare scratch/ directory**: One-off scripts and temp data belong in `<workspace>/Artifacts/Temp/` per orchestration.md Scratch Strategy HARD-GATE (exceptions: `memory/` and `tool-results/` under shadow are allowlisted)

To customize, edit the `BLOCKED_*` constants in `guard-paths.js`.

### Blocked Commands
`guard-commands.js` matches both the Bash and PowerShell tools and blocks:
- `rm -rf /`, `rm -rf ~`, `rm -rf C:/` (drive root), `rm -r .`
- Windows: `del`/`rd`/`rmdir … /s`, `format X:`
- PowerShell: `Remove-Item -Recurse -Force`, `Format-Volume`, `Clear-Disk`
- `git push --force` / `git push -f` (allows `--force-with-lease`), `git reset --hard`, `git clean -fd`
- `DROP TABLE`, `DELETE FROM` (without WHERE), `TRUNCATE TABLE`
- Fork bombs, block-device writes, piped curl-to-shell
- **Commit messages with AI attribution trailers**: `Co-Authored-By: Claude` or `Generated with Claude Code` (standards.md deny-list; both shells detected)
- **Shell redirects into tracked source files** — see below

To customize, edit the `BLOCKED_PATTERNS` array in `guard-commands.js`.

### Source-Redirect Guard
Writing source through the shell (`echo … > module.py`, `cat > config.yaml <<'EOF'`,
PowerShell `Set-Content`/`Out-File`/`Add-Content`) bypasses the Write/Edit tools: it
leaves no reviewable diff and truncates silently on `>`. The guard denies a redirect
**only when the target ends in a tracked source extension** (`.py .ts .js .md .json
.yaml .tmdl .csproj .cs .dax .sh .ps1`), and names Write/Edit as the alternative.

Deliberately allowed:
- Anything under `Artifacts/Temp/` or `Artifacts/Evidence/` — `testing-strategy.md` §3
  *mandates* `<command> > Artifacts/Temp/<phase>_<step>_<command>.txt 2>&1` for evidence.
  A guard without this allowlist would fight the evidence protocol.
- `/tmp`, `scratch/`, `/dev/null`, and every non-source target (`> results.txt`).
- Fd duplication (`2>&1`, `>&2`) — inert, since those targets can never carry a source
  extension.
- Arrows and comparisons (`a.py -> b.py` in a commit message, `>=`) — a negative
  lookbehind keeps them from reading as redirects.

Known limitation (shared with the attribution-trailer check): matching is raw-string,
not shell-parsed, so a source-file redirect quoted *inside* a string literal still
denies. Use the Write tool, or move the text to a file.

### Audit-trail hygiene
`audit-trail.js` only logs inside repos that already contain an `Artifacts/`
directory (it never scaffolds `Artifacts/` into a foreign repo) and rotates
`audit_trail.jsonl` once it exceeds 5 MB.

### Stop Hooks (Turn-End Feedback)
Three Stop hooks fire at session end without blocking. **Three is the ceiling** — a
fourth is a redesign, not an addition (nag fatigue degrades every existing hook).

- **`nudge-handoff.js`** — If the workspace has uncommitted changes (`git status --porcelain`) and no `/handoff` invocation appears in the transcript this session, nudges the user to run `/handoff` before ending. Rate-limited to once per session.
  **Nested state repo**: if `Artifacts/.git` exists, `Artifacts/` is its own repo with its own
  remote and committing the workspace backs up none of it. The hook additionally nags when that
  repo has uncommitted changes, commits ahead of upstream, or **no upstream at all** (nothing to
  back up to). This branch is silent unless `Artifacts/.git` exists, so it costs nothing in the
  ordinary arrangement where `Artifacts/` is tracked by the workspace repo. Unlike the dirty-tree
  nudge, a recent `/handoff` does **not** suppress it — `/handoff` having run is a proxy, whereas
  unpushed state is a measured fact.
- **`evidence-gate.js`** — If the final assistant message contains a completion claim (done/fixed/passing/complete/finished) AND source edits occurred this session BUT no fresh passing test/lint output follows the last source edit, nags that the Iron Law requires evidence. Feedback only — never blocks.
- **`guard-shared-state.js`** — If an edit introduced a change to process-global state (`sys.stdout`, `sys.stderr`, `logging.`, `TextIOWrapper`, `reconfigure`, `os.environ`) AND no full-suite run followed it, nags that a subset run cannot observe this class of breakage. A run counts as full-suite when it invokes `pytest` with no selector (`.py` path, `::` node id, or `-k`); `deploy.sh` counts. Feedback only — never blocks.

All three are fail-open: any hook error exits 0 with no output, logging only to stderr.

> **`guard-shared-state.js` ships with an exit condition.** Its evidence base is n=1
> (2026-07-26: a stdout reassignment that a subset run reported green while 279 tests
> broke). Every fire is recorded by `gate-log` under `ruleId: guard-shared-state`.
> BACKLOG `igh1_shared-state-hook_1` schedules deletion if it records **zero fires
> across 20 sessions** — check with `python scripts/gate_telemetry.py`.

## Troubleshooting

### Hooks not firing
- Ensure `~/.claude/settings.json` has valid JSON (no trailing commas)
- Confirm the scripts actually landed: `ls ~/.claude/hooks/*.js` should list 8 files.
  If not, run `bash scripts/deploy.sh` first.
- If `$HOME` did not expand (rare — a shell that doesn't set it), substitute your
  literal home path in the `command` fields.
- Run `claude --debug` to see verbose hook logs

### Hook blocking something it shouldn't
- Edit the relevant `guard-*.js` file and remove or adjust the pattern
- Restart Claude Code to reload hooks

### Auto-lint not reporting
- Verify the linter tool is installed and on your PATH (`ruff --version`, `npx tsc --version`)
- Check that the project has the appropriate config file (`pyproject.toml`, `tsconfig.json`, etc.)
