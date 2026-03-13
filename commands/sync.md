---
description: Reconciles manual user progress with the AI's project state. Owned by the concierge. Scans for drift, validates state files, and proposes TODO.md updates.
---

# Command: /sync

Owned by the **concierge**. The "Truth Engine" — reconciles manual work with the AI's roadmap.

## Execution Sequence

1. **Inventory Delta**: `git status --short`, `git diff --name-only HEAD~1`, recent file modifications.
2. **Domain Recon**: Rhino/GH (`.gh`, `.py` in CAD dirs) | Power BI (`.dax`, `.sql`) | MCP/Dev (`src/`, `package.json`, configs) | C# (`.cs`, `.csproj`, NuGet) | Docs (stale README, ARCH).
3. **State File Validation**: `TODO.md` ↔ `IMPLEMENTATION_PLAN.md` sync. `.agent/current_task.md` freshness. `DECISION_LOG.md` unresolved entries.
4. **Reconciliation**: Cross-reference changes against `TODO.md` → categorize.
5. **State Refresh**: Update `.agent/current_task.md` with validated next step.
6. **Output**: Sync Report.

## Reconciliation Categories

- **✅ RECONCILED**: Planned tasks matching file changes → propose completion to auditor.
- **⚠️ DRIFT**: Unplanned files/changes → flag for strategist (absorb or revert).
- **❌ STALE**: `[-]` tasks with no file changes, or 2+ sessions without progress → flag as blocked/abandoned/stuck.
- **🔄 MISMATCH**: `[ ]` but files suggest complete, `[x]` but files modified since, `.agent/current_task.md` references nonexistent task → flag for immediate resolution.

## Sync Report Format

- **Session Delta**: Files modified/created, time since last sync.
- **Reconciliation Summary**: Table of category | count | items.
- **State File Health**: `TODO.md`, `IMPLEMENTATION_PLAN.md`, `.agent/current_task.md`, `DECISION_LOG.md`, `ARCH.md` — status each.
- **Recommended Next Step**: Agent → specific task.

## When to Use
Session start, after deep work sprints, before an audit, on context loss, after external collaboration.

## Boundaries
Does NOT: mark `[x]`, modify `IMPLEMENTATION_PLAN.md`, overwrite state files without validation, execute code.