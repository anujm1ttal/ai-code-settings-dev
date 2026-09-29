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

You should see all 11 wiring entries listed (11 bullets below, across **9 hook
files** — `task-diff-guard.js` is one file wired to three events):
- `SessionStart` → `session-boot.js`
- `PreToolUse (Edit|MultiEdit|Write)` → `guard-paths.js`
- `PreToolUse (Bash|PowerShell)` → `guard-commands.js`
- `PreToolUse (Task|Agent)` → `task-diff-guard.js`
- `PostToolUse (Edit|MultiEdit|Write)` → `auto-lint.js`
- `PostToolUse (Task|Agent)` → `task-diff-guard.js`
- `PostToolUse (*)` → `audit-trail.js`
- `Stop` → `nudge-handoff.js`
- `Stop` → `evidence-gate.js`
- `Stop` → `guard-shared-state.js`
- `Stop` → `task-diff-guard.js`

(`task-diff-guard.js` is one file wired to three events — `enforced-rules.json` lists it
as `task-diff-guard-pre` / `task-diff-guard-post` / `task-diff-guard-stop` so the wiring
guard verifies all three.)

> **Note on output schemas.** Guards deny via the documented PreToolUse schema
> (`hookSpecificOutput.permissionDecision: "deny"` + `permissionDecisionReason`,
> exit 0), and context hooks inject via `hookSpecificOutput.additionalContext` — a
> bare top-level `additionalContext` or an exit-2 deny is silently dropped/reason-less.
> Hook `timeout` values in `settings-template.json` are in **seconds** (not ms).

## Hook Reference

| Hook | Event | Purpose |
|:---|:---|:---|
| `session-boot.js` | `SessionStart` | Injects `current_task.md` whole (capped 2,000 B) + a pointer line (path + line count) per other state file + HANDOFF_BRIEF.md's `## Blockers` inline (ALB-1 T8: brief trimmed from 9,165 B to <=2,750 B) |
| `guard-paths.js` | `PreToolUse` | **Blocks** writes to binaries, secrets, build artifacts, project state files in shadow paths, bare scratch/ |
| `guard-commands.js` | `PreToolUse` | **Blocks** dangerous shell commands (rm -rf, force push, SQL drops) and AI attribution trailers in commits |
| `auto-lint.js` | `PostToolUse` | Reports lint violations and injects "fix before proceeding" directive (no auto-fix) |
| `audit-trail.js` | `PostToolUse` | Logs every tool action to `Artifacts/.agent/audit_trail.jsonl` |
| `task-diff-guard.js` | `PreToolUse` + `PostToolUse` (`Task|Agent`) + `Stop` | Snapshots protected `Artifacts/` files before a subagent dispatch; `PostToolUse` only stamps the dispatch as returned (no output, not proof of completion — SGH-1c); at `Stop`, a completion-notification barrier retains everything until every recent dispatch's `<task-notification>` has appeared in the transcript, then settles — diffs each settled dispatch, drops changes the transcript shows the main agent made itself, and aggregates the rest into one capped-diff `additionalContext` so the orchestrator verifies the artifact, not the subagent's summary (feedback only; see the Stop-ceiling amendment below) |
| `nudge-handoff.js` | `Stop` | Nudges to run `/handoff` if git tree is dirty and no handoff this session (feedback only) |
| `evidence-gate.js` | `Stop` | Nags when completion claims made without fresh test evidence this session (feedback only) |
| `guard-shared-state.js` | `Stop` | Nags when process-global state (stdout/stderr, logging, os.environ) changed without a full-suite run (feedback only) |

### Kill Condition (is session-boot's heartbeat firing?)

```bash
python scripts/gate_telemetry.py Artifacts/.agent/gate_events.jsonl
```

`session-boot.js` never denies or nags — it only injects context — so its only gate-log signal is
the once-per-session `logPassOnce` heartbeat (ALB-1 T8, restoring the HFO HR1 regression: commit
`5bcbc68` dropped this hook's gate-log import and it logged **0 rows from 2026-09-29T14:43:14Z**
until this fix). Two branches:

1. **`session-boot` shows 0 pass across >=1 real session** → the heartbeat call itself is broken
   (not fail-open swallowing it — `logPassSafe`'s try/catch only protects the caller's exit code,
   never silently retries) or the hook isn't wired at all; confirm via `/hooks` before trusting a
   silent brief.
2. **`session-boot` shows pass with `note: "brief-emitted"` or `note: "no-state-found"`** → the
   hook ran and reached a real conclusion either way — `no-state-found` on a project with an
   `Artifacts/` dir the hook can see is itself worth investigating (missing-state alert: the brief
   goes silent rather than fabricating content).

## License Gate Config Parity

`hooks/license-gate.json` is the single source of truth for the license gate
(HFO-2) — the mechanism enforcing `CLAUDE.md`'s HARD-GATE barring third-party-
licensed content from tracked paths. Four sides are kept in sync by
`tests/test_license_gate_parity.py`: the JSON itself, the JS fallbacks in
`hooks/guard-commands.js` and `hooks/guard-paths.js`, the Python fallback in
`scripts/verify_deploy_parity.py`, and this table. Each side asserts it
extracted non-empty values before comparing against the others — a reworded
side fails the parity test, it never silently skips.

| Key | Values |
|:---|:---|
| `source_roots` | `office-skills/ms-office`, `.claude/skills/synced` |
| `dest_prefixes` | `optional_plugins/ms-office/` |
| `markers` | `all rights reserved`, `license: proprietary`, `anthropic, pbc` |
| `self_exempt` | `hooks/license-gate.json` |

`source_roots`/`dest_prefixes`/`markers`/`self_exempt` are consumed by R-A
(`guard-commands.js`), R-B/R-C (`guard-paths.js`), and the deploy-parity
remedy gate (`scripts/verify_deploy_parity.py`) — the rule text, coverage
boundary, and kill condition for those consumers land with the tasks that
wire them in.

## License Gate Rules (R-A / R-B / R-C)

| Rule | Hook | Keyed on | Fails closed? |
|:---|:---|:---|:---|
| **R-A** *(primary)* | `guard-commands.js` | a licensed `source_root` referenced in the command string | ⚠️ no — the command string is always present, the source root *inside* it is optional |
| **R-B** | `guard-paths.js` | destination path under a `dest_prefixes` entry, matched as a consecutive path-segment sequence (never `startsWith`) | yes — `file_path` is always present |
| **R-C** | `guard-paths.js` | a `markers` string in the write payload, **only when the target path does not yet exist** and is not `self_exempt` | n/a — provenance-scoped by design (Q1=C, `HFO-2-Plan.md` §3) |

**R-A's known blind spots (accepted, `HFO-2-Plan.md` §3 Q2 / §9):** R-A is a plain substring test
on the raw command string — a `cd`-split two-call form (`cd ~/office-skills && cp -R ms-office
<dest>/`, since the Bash tool's cwd persists between calls), variable indirection (`$SRC`), and
globs all carry **no matchable root**, so none of these forms denies. It raises the cost of
carelessness; it is not a barrier. The same substring match also denies **read-only** commands that
merely *mention* a licensed root (`ls ~/office-skills/ms-office`, `grep -r ~/office-skills/
ms-office`) — a knowingly accepted operator cost, not a bug: if you hit an unexpected deny on a
read-only command, this is why.

### Coverage boundary (`HFO-2-Plan.md` §1c) — read this before trusting the gate

> A `guard-paths.js` rule, on its own, would not have prevented MSO-2 — a bulk `cp -R` never
> reaches a `Write` hook. Only a `guard-commands.js` rule keyed on the source root observes that
> event at all, and then only when the command spells the root.

`guard-paths.js`'s matcher is `Edit|MultiEdit|Write|NotebookEdit` — agent file-writes only. A bulk
`cp -R` (or `robocopy`/`xcopy`/`Copy-Item`) is seen by `guard-commands.js` (R-A) and by nothing
else: no `Write`/`Edit`/`MultiEdit`/`NotebookEdit` event is ever generated for a tree copy, so R-B
and R-C never see it either.

### The `tool_name`-absent gap

Payload extraction is total across the **four matched tool shapes** — `Write`/`content`,
`Edit`/`new_string`, `MultiEdit`/`edits[].new_string`, `NotebookEdit`/`new_source`
(`guard-paths.js:298-312`) — and a **fifth, unrecognised but present** `tool_name` is not silently
absorbed: it is logged via `logGateEvent` with `note:'payload-shape-unknown'`, bypassing the
once-per-session `logPassOnce` heartbeat that would otherwise have already spent its marker on the
turn's first ordinary allow and silently dropped the row.

**What this does not cover:** a `PreToolUse` event carrying **no `tool_name` at all** falls through
to a silent no-op — payload stays `''` and no `payload-shape-unknown` row is ever written
(`guard-paths.js:296-297`). This is unreachable **only because** the deployed matcher is
`Edit|MultiEdit|Write|NotebookEdit`: Claude Code's own routing guarantees `tool_name` is one of
those four whenever this hook fires at all. **Widening the matcher makes this gap live** — a fifth
edit tool, or any matcher regex change, would let a payload skip both the check and the log with
zero trace. Re-run the extraction-totality test and re-read this section before shipping any
matcher widening.

### Kill Condition (does the license gate actually fire?)

```bash
python scripts/gate_telemetry.py Artifacts/.agent/gate_events.jsonl
```

`gate_telemetry.py` reports deny/nag/pass **per hook** (`guard-commands`, `guard-paths`), not per
rule: `deny()` in both hooks logs a fixed `ruleId` equal to the hook's own name
(`guard-commands.js:263`, `guard-paths.js:263`) — never a rule-specific id, and never the
`permissionDecisionReason` text (`LICENSE-GATE R-A`/`R-B`/`R-C` is returned to the agent, not
persisted to `gate_events.jsonl`). R-A/R-B/R-C therefore share their hook's row with every other
`BLOCKED_PATTERNS`/`isBlocked` rule. Three branches:

1. **Both hooks show 0 deny across ≥20 sessions** → the license gate — like every other rule
   sharing these hooks — has not fired. Confirm via `/hooks` that the wiring is still live before
   reading this as "no risky command occurred"; a broken hook produces the same zero.
2. **`guard-commands` deny > 0** → open the `gate_events.jsonl` rows at that timestamp and
   cross-reference the same-session command text in `Artifacts/.agent/audit_trail.jsonl` or the
   transcript. Only a match naming `office-skills/ms-office` or `.claude/skills/synced` confirms an
   R-A fire — otherwise the deny belongs to one of `guard-commands.js`'s other rules (`rm -rf`,
   force push, …).
3. **`guard-paths` deny > 0** → cross-reference the denied `file_path`/payload for that turn: a
   destination under `dest_prefixes` is R-B, a marker in a brand-new file is R-C, anything else
   (shadow-path, `scratch/`, binary extension, …) is not the license gate.

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
- **Licensed-content destination/marker (R-B/R-C, HFO-2)**: destination prefixes and brand-new-file
  license markers from `hooks/license-gate.json` — see [License Gate Rules](#license-gate-rules-r-a--r-b--r-c) above

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
- **Licensed-content source root (R-A, HFO-2)**: commands referencing a source root from
  `hooks/license-gate.json` — see [License Gate Rules](#license-gate-rules-r-a--r-b--r-c) above

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
Four Stop hooks fire at session end without blocking.

- **`nudge-handoff.js`** — If the workspace has uncommitted changes (`git status --porcelain`) and no `/handoff` invocation appears in the transcript this session, nudges the user to run `/handoff` before ending. Rate-limited to once per session.
  **Nested state repo**: if `Artifacts/.git` exists, `Artifacts/` is its own repo with its own
  remote and committing the workspace backs up none of it. The hook additionally nags when that
  repo has uncommitted changes, commits ahead of upstream, or **no upstream at all** (nothing to
  back up to). This branch is silent unless `Artifacts/.git` exists, so it costs nothing in the
  ordinary arrangement where `Artifacts/` is tracked by the workspace repo. Unlike the dirty-tree
  nudge, a recent `/handoff` does **not** suppress it — `/handoff` having run is a proxy, whereas
  unpushed state is a measured fact.
- **`evidence-gate.js`** — If the final assistant message contains a completion claim (done/fixed/passing/complete/finished) AND source edits occurred this session BUT no fresh passing test/lint output follows the last source edit, nags that the Iron Law requires evidence. Feedback only — never blocks.
- **`guard-shared-state.js`** — If an edit to a **source path** (same `isSourcePath` gate as `evidence-gate.js` — excludes `.md`, `Artifacts/**`, `Temp/**`) introduced a change to process-global state (`sys.stdout`, `sys.stderr`, `logging.`, `TextIOWrapper`, `reconfigure`, `os.environ`) AND no full-suite run followed it, nags that a subset run cannot observe this class of breakage. A run counts as full-suite when it invokes `pytest` with no selector (`.py` path, `::` node id, or `-k`); `deploy.sh` counts. Feedback only — never blocks.
- **`task-diff-guard.js` (Stop branch)** — A **completion-notification barrier** (SGH-1c, fixing D4: `PostToolUse` fires at dispatch-*launch*, not completion): before settling anything, checks whether every recent `Agent`/`Task` dispatch in the transcript has a matching `<task-notification>` entry. If any dispatch is still unconfirmed (or the transcript is unreadable/silent on dispatches), retains every pending snapshot untouched this Stop — only once the barrier is open does it settle: diffs each settled dispatch's snapshot of protected `Artifacts/` files against the live tree, drops any change the transcript shows the **main agent** made itself at-or-after that dispatch, and aggregates whatever survives into one capped-diff `additionalContext` block naming the file(s) and subagent(s). Silent unless a subagent was dispatched this turn AND changed a protected artifact AND that change survived attribution filtering. A dispatch un-notified past 60 minutes stops holding the barrier shut (counted as stale) but is still retained, not settled. Sweeps any snapshot older than 6h regardless of status. Feedback only — never blocks.

All four are fail-open: any hook error exits 0 with no output, logging only to stderr.

> **Stop-ceiling amendment (SGH-1b, 2026-09-11): the fourth Stop hook is the
> sanctioned exception, not a breach.** The ceiling below was written as
> "three, and a fourth is a redesign, not an addition" — `task-diff-guard.js`'s
> Stop branch **is** that redesign (it replaces the same file's own
> `PostToolUse`-time diff/nag, not a net-new nag source; see SGH-1-Plan.md
> §SGH-1b §1 for the D1/D2/D3 defects that made the old PostToolUse design
> unreliable). The budget is now **three general-purpose Stop nags**
> (`nudge-handoff`, `evidence-gate`, `guard-shared-state`) **+ one settle
> point** (`task-diff-guard`), which is categorically different: it is silent
> on every turn that dispatches no subagent, and net user-visible nag surface
> is *lower* than before (one aggregated end-of-turn block replaces up to N
> mid-turn `PostToolUse` blocks per turn). A **fifth** Stop hook remains a
> redesign, not an addition — the ceiling is restated, not raised.

> **`guard-shared-state.js` OHF-2 exit review (2026-09-11): tightened, not deleted.**
> Its evidence base was n=1 at ship (2026-07-26: a stdout reassignment that a subset
> run reported green while 279 tests broke). Telemetry after ~7 weeks showed 828
> nags, 0 deny; correlating fires against `audit_trail.jsonl` found they were
> near-entirely triggered by editing **prose** that mentions these tokens (docs,
> BACKLOG entries, this hook's own message string) rather than genuine
> process-global mutations, with exactly one confirmed true positive
> (`scripts/todo_graph.py`'s guarded `sys.stdout.reconfigure`). Fix: gated on
> `isSourcePath` so only real source-path edits can arm the guard. Full evidence
> trail in `Artifacts/BACKLOG.md` `igh1_shared-state-hook_1` (RESOLVED).

## Troubleshooting

### Hooks not firing
- Ensure `~/.claude/settings.json` has valid JSON (no trailing commas)
- Confirm the scripts actually landed: `ls ~/.claude/hooks/*.js` should list 9 files.
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
