---
description: Reconciles manual user progress with the AI's project state. Owned by the concierge. Scans for drift, validates state files, and proposes Artifacts/TODO.md updates.
argument-hint: ""
allowed-tools: Read, Grep, Glob
model: claude-haiku-4-5
---

# Command: /sync

Owned by the **concierge**. The "Truth Engine" — reconciles manual work with the AI's roadmap.

## Execution Sequence

1. **Learnings Load**: Read `Artifacts/learnings/HOT.md` first for fast-access context. If `Artifacts/learnings/HOT.md` is missing, skip directly to category indexes in `Artifacts/learnings/`. Otherwise, fall back to category indexes only when HOT.md doesn't cover the need.
2. **Inventory Delta**: `git status --short`, `git diff --name-only HEAD~1`, recent file modifications.
3. **Domain Recon**: Rhino/GH (`.gh`, `.py` in CAD dirs) | Power BI (`.dax`, `.sql`) | MCP/Dev (`src/`, `package.json`, configs) | C# (`.cs`, `.csproj`, NuGet) | Docs (stale README, ARCH).
4. **State File Validation**: `Artifacts/TODO.md` ↔ `Artifacts/IMPLEMENTATION_PLAN.md` sync. `Artifacts/.agent/current_task.md` freshness. `Artifacts/DECISION_LOG.md` unresolved entries — the log is newest-first: read the **head** (recent entries) and scan for unresolved, not the whole file.
5. **Reconciliation**: Cross-reference changes against `Artifacts/TODO.md` → categorize.
6. **State Refresh**: Update `Artifacts/.agent/current_task.md` with validated next step.
7. **Output**: Sync Report.

## Reconciliation Categories

- **✅ RECONCILED**: Planned tasks matching file changes → propose completion to auditor.
- **⚠️ DRIFT**: Unplanned files/changes → flag for strategist (absorb or revert).
- **❌ STALE**: `[-]` tasks with no file changes, or 2+ sessions without progress → flag as blocked/abandoned/stuck.
- **🔄 MISMATCH**: `[ ]` but files suggest complete, `[x]` but files modified since, `Artifacts/.agent/current_task.md` references nonexistent task → flag for immediate resolution.

## Sync Report Format

- **Session Delta**: Files modified/created, time since last sync.
- **Reconciliation Summary**: Table of category | count | items.
- **State File Health**: `Artifacts/TODO.md`, `Artifacts/IMPLEMENTATION_PLAN.md`, `Artifacts/.agent/current_task.md`, `Artifacts/DECISION_LOG.md`, `Artifacts/ARCH.md` — status each.
- **Recommended Next Step**: Agent → specific task.

## When to Use
Session start, after deep work sprints, before an audit, on context loss, after external collaboration.

## Boundaries
Does NOT: mark `[x]`, modify `Artifacts/IMPLEMENTATION_PLAN.md`, overwrite state files without validation, execute code.