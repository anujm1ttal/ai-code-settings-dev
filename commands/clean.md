---
description: Manually triggers the Hygiene Phase to clean up transient artifacts and stray files.
argument-hint: ""
model: claude-haiku-4-5
---

# Command: /clean

Owned by the **concierge**. Performs mid-session project hygiene.

## Precondition

- **High-Rigor Guard**: If a phase is currently running under the high-rigor workflow
  (`skills/high-rigor-engineering/SKILL.md`), do NOT purge `Artifacts/Temp/` — it holds the
  active evidence trail. Skip to the Stray Scan only, or wait until the phase's Pre-Commit
  Cleanup step handles its own Temp files.
- **Evidence Guard [HARD-GATE]**: `Artifacts/Evidence/` is **never** in scope for `/clean` —
  not scanned, not proposed, not deleted. See `rules/common/orchestration.md` §Evidence Retention.

## Execution Sequence

0. **Promote**: Before scanning, move any `Artifacts/Temp/` file cited by a durable record
   (phase report, `AUDIT_REPORT.md`, `DECISION_LOG.md`, `BACKLOG.md` finding, `learnings/` entry)
   to `Artifacts/Evidence/<phase>/` and repoint the citation. Promoted files leave the purge set.
1. **Temp Scan**: List all files remaining in `Artifacts/Temp/`.
2. **Stray Scan**: Identify files matching transient patterns:
   - `*.tmp`, `*.log`, `npm-debug.log`, `yarn-error.log`.
   - Scratch scripts in the project root not in `.gitignore`.
   - Temporary analysis artifacts in the project root (should have been in `Temp/`).
3. **Propose Deletion**: List every identified file (Temp/ + stray) and ask for user confirmation before deleting anything.
4. **Execute**: Only after explicit confirmation, securely delete the confirmed files.

## Rules

- **Safety First**: Never delete `.git/` contents, `.env` files, or any source code files (`.py`, `.ts`, `.md`, etc.) unless they are explicitly in `Artifacts/Temp/` or identified as scratchpads.
- **Verification**: Always list files before deletion. No deletion without explicit user confirmation.
