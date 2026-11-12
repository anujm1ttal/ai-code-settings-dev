---
description: Reconciles manual user progress with the AI's project state. Owned by the concierge. Scans for drift, validates state files, and proposes Artifacts/TODO.md updates.
argument-hint: ""
allowed-tools: Read, Grep, Glob, Bash(node *sync-facts.mjs*)
model: claude-haiku-5-5
---

# Command: /sync

The "Truth Engine" — reconciles manual work with the AI's roadmap.

**Bounded reads [HARD-GATE]**: never read a state file whole (`TODO.md`, `DECISION_LOG.md` and `BACKLOG.md` run to hundreds of lines; the Read tool silently truncates large files). Beyond the facts script, use Grep or `Read` with `limit` ≤ 60. Do not load skills for this command and do not sample `BACKLOG.md` beyond the script's output.

## Execution Sequence

1. **Learnings Load**: `Read` `Artifacts/learnings/HOT.md` with `limit` 40 (titles only). If missing, skip to the category indexes in `Artifacts/learnings/`, same limit.
2. **Inventory Delta**: run `node ~/.claude/commands/sync-facts.mjs` (inside ai-code-settings source: `node commands/sync-facts.mjs`). It is read-only and capped at 6 KB; it reports git status (project and nested `Artifacts/` repo, incl. ahead/behind), state-file sizes/mtimes, the current task, the newest DECISION_LOG entry and the BACKLOG tally. Use its output for steps 4–5. Then `git diff --name-only HEAD~1` as needed.
2b. **Deploy Parity** (ai-code-settings only — skip elsewhere, the script is repo-local): `python scripts/verify_deploy_parity.py`. Detects content living in deployed `~/.claude/` that the source lacks. Exit 0 = no loss risk (source-ahead is normal and does not block); exit 1 = **deployed-ahead / deployed-only**, content the next `bash scripts/deploy.sh` would silently `rm -rf`. On exit 1, report the file list and back-port before any deploy — do not deploy to "fix" it.
3. **Domain Recon**: Rhino/GH (`.gh`, `.py` in CAD dirs) | Power BI (`.dax`, `.sql`) | MCP/Dev (`src/`, `package.json`, configs) | C# (`.cs`, `.csproj`, NuGet) | Docs (stale README, ARCH).
4. **State File Validation**: `Artifacts/TODO.md` ↔ `Artifacts/IMPLEMENTATION_PLAN.md` sync. `Artifacts/.agent/current_task.md` freshness. `Artifacts/DECISION_LOG.md` unresolved entries — newest-first: use the script's newest entry plus a Grep for unresolved markers, never the whole file. Treat truncation or an unparsed format as **unknown**, not absence.
5. **BACKLOG Surface**: If `Artifacts/BACKLOG.md` exists, report the **OPEN** count and the first 3–5 titles **from the script's output** (file order, one line each). Surface only — `/sync` assigns no verdicts and edits nothing. Deep triage (pull in / keep / resolve) is the strategist's **BACKLOG Reconciliation** gate at `/blueprint` New Phase & Re-Plan.
6. **Reconciliation**: Cross-reference changes against `Artifacts/TODO.md` → categorize.
7. **State Refresh**: Update `Artifacts/.agent/current_task.md` with validated next step.
8. **Output**: Sync Report.

## Reconciliation Categories

- **✅ RECONCILED**: Planned tasks matching file changes → propose completion to auditor.
- **⚠️ DRIFT**: Unplanned files/changes → flag for strategist (absorb or revert).
- **❌ STALE**: `[-]` tasks with no file changes, or 2+ sessions without progress → flag as blocked/abandoned/stuck.
- **🔄 MISMATCH**: `[ ]` but files suggest complete, `[x]` but files modified since, `Artifacts/.agent/current_task.md` references nonexistent task → flag for immediate resolution.

## Sync Report Format

- **Session Delta**: Files modified/created, time since last sync.
- **BACKLOG**: OPEN count + first 3–5 in file order (skip if no `Artifacts/BACKLOG.md`).
- **Deploy Parity**: exit code + drift count by class, or "n/a" outside ai-code-settings.
- **Reconciliation Summary**: Table of category | count | items.
- **State File Health**: `Artifacts/TODO.md`, `Artifacts/IMPLEMENTATION_PLAN.md`, `Artifacts/.agent/current_task.md`, `Artifacts/DECISION_LOG.md`, `Artifacts/ARCH.md` — status each.
- **Recommended Next Step**: Agent → specific task.

## When to Use
Session start, after deep work sprints, before an audit, on context loss, after external collaboration.

## Boundaries
Does NOT: mark `[x]`, modify `Artifacts/IMPLEMENTATION_PLAN.md`, overwrite state files without validation, execute code.