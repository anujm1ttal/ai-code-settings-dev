---
description: Reconciles manual user progress with the AI's project state. Owned by the concierge agent. Scans for drift, validates state files, and proposes TODO.md updates for auditor approval.
---

# Command: /sync

This command is owned by the **concierge** agent. It is the "Truth Engine" of the workspace — reconciling manual implementations (Rhino, Power BI, manual code edits) with the AI's internal roadmap to prevent context drift and hallucinations.

## ⚡ Execution Sequence

1. **Inventory Delta**: Perform a recursive scan of the project root to identify files modified or created since the last session.
   - `git status --short`
   - `git diff --name-only HEAD~1` (if commits exist)
   - `find . -maxdepth 3 -mmin -60 -type f`
2. **Domain-Specific Recon**:
   - **Rhino/GH**: Check for updated `.gh` files, exported geometry logic, or new `.py` modules in CAD directories.
   - **Power BI**: Check for new `.dax` or `.sql` snippets, or modified data model references.
   - **MCP/Dev**: Identify changes in `src/`, `package.json`, `tsconfig.json`, or environment configs.
   - **C#/Grasshopper**: Check for changes in `.cs` files, `.csproj`, or NuGet references.
   - **Docs**: Check for stale `README.md`, `ARCH.md`, or missing doc updates after code changes.
3. **State File Validation**:
   - Confirm `TODO.md` and `IMPLEMENTATION_PLAN.md` are in sync — no orphaned tasks, no missing phases.
   - Verify `.agent/current_task.md` exists and is not stale (last update within the current working context).
   - Check `DECISION_LOG.md` for unresolved entries if it exists.
4. **Reconciliation**: Cross-reference detected changes against `TODO.md` and categorize.
5. **State Refresh**: Update `.agent/current_task.md` with the validated current state and recommended next step.
6. **Output**: Generate a Sync Report.

## 🔍 Reconciliation Categories

### ✅ RECONCILED
- Planned tasks in `TODO.md` that match detected file system changes.
- **Action**: Propose completion to the `auditor`. Do NOT mark `[x]` directly.
- **Output**: List each reconciled task with the supporting file evidence.

### ⚠️ DRIFT (Unplanned Changes)
- Files created or modified that don't map to any `TODO.md` item.
- Manual logic changes that contradict the `IMPLEMENTATION_PLAN.md`.
- **Action**: Flag for the `strategist` to evaluate. Two possible outcomes:
  - **Absorb**: Strategist adds the work to the plan retroactively.
  - **Revert**: Work is out of scope and should be rolled back or shelved.
- **Output**: List each drifted file with a brief description of the change.

### ❌ STALE (Missing Progress)
- Tasks marked `[-]` (in-progress) in `TODO.md` but with no corresponding file changes.
- Tasks with no status update for more than 2 sessions.
- **Action**: Flag as potential blockers. Identify whether the task is:
  - **Blocked**: Waiting on a dependency or external input.
  - **Abandoned**: User moved on without updating the plan.
  - **Stuck**: Technical difficulty — may need `strategist` re-evaluation.
- **Output**: List each stale task with recommended resolution.

### 🔄 STATE MISMATCH
- `TODO.md` shows a task as `[ ]` but files suggest it is complete.
- `TODO.md` shows a task as `[x]` but the corresponding file has been modified since completion.
- `.agent/current_task.md` references a task that no longer exists in `TODO.md`.
- **Action**: Flag for immediate resolution. Propose corrections to the `auditor`.

## 📋 Sync Report Format

### Sync Report — [Date/Timestamp]

**Session Delta**:
- Files modified: [count]
- Files created: [count]
- Time since last sync: [duration]

**Reconciliation Summary**:
| Category | Count | Items |
| :--- | :--- | :--- |
| ✅ Reconciled | [n] | [task list] |
| ⚠️ Drift | [n] | [file list] |
| ❌ Stale | [n] | [task list] |
| 🔄 Mismatch | [n] | [details] |

**State File Health**:
- `TODO.md`: [OK / Orphaned tasks / Stale entries]
- `IMPLEMENTATION_PLAN.md`: [OK / Out of sync with TODO]
- `.agent/current_task.md`: [OK / Stale / Missing]
- `DECISION_LOG.md`: [OK / Unresolved entries / Not found]
- `ARCH.md`: [OK / Stale / Not found]

**Recommended Next Step**: [agent] — [specific task]

## 🔗 When to Use

Use `/sync` when:
- **Starting a Session**: To brief the AI on what you did manually while the CLI was closed.
- **After a Deep Work Sprint**: After finishing a complex Grasshopper definition or Power BI layout.
- **Before an Audit**: To ensure `/audit` is evaluating the most recent file versions.
- **Context Loss**: If the AI seems confused about what has already been completed.
- **After External Collaboration**: When another team member has modified project files.

## 🚫 What /sync Does NOT Do
- Does not mark `TODO.md` items `[x]` — only the `auditor` has that authority.
- Does not modify `IMPLEMENTATION_PLAN.md` — only the `strategist` can restructure the plan.
- Does not overwrite `.agent/current_task.md` without first validating the delta.
- Does not execute code or run builds — it is a read-and-report operation (plus state file updates).

## 💬 Example Usage

> **User**: I spent the afternoon working in Grasshopper. /sync
>
> **Concierge**:
> ### Sync Report — 2026-03-15 16:30
>
> **Session Delta**:
> - Files modified: 3
> - Files created: 1
> - Time since last sync: 4 hours
>
> **Reconciliation Summary**:
> | Category | Count | Items |
> | :--- | :--- | :--- |
> | ✅ Reconciled | 1 | Task 2.3 — seating_grid.py updated |
> | ⚠️ Drift | 1 | New file: experimental_rake.py (no matching task) |
> | ❌ Stale | 1 | Task 2.1 — sightline export still `[-]` with no changes |
> | 🔄 Mismatch | 0 | — |
>
> **State File Health**:
> - `TODO.md`: ⚠️ 1 stale entry
> - `IMPLEMENTATION_PLAN.md`: OK
> - `.agent/current_task.md`: Updated
> - `ARCH.md`: OK
>
> **Recommended Next Step**: auditor — review Task 2.3 for completion approval. Strategist — evaluate experimental_rake.py for plan absorption.