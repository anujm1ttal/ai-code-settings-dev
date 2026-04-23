# Implementation Plan: Snapshotting & Memory Persistence

This plan introduces high-rigor codebase snapshotting for external reviews and a "Sliding Window" persistence protocol to maintain long-term memory while preventing artifact bloat.

## Proposed Changes

### 1. Factual Snapshotting (/snapshot)
- **Status**: [Completed]
- **Target**: `commands/snapshot.md`
- **Logic**: Exhaustive 15-section factual report for external reviews.

### 2. Project Hygiene (/clean)
- **Status**: [Completed]
- **Target**: `commands/clean.md`, `commands/handoff.md`
- **Logic**: Automated deletion of `Artifacts/Temp/` and transient stray files.

### 3. Sliding Window Persistence
- **Status**: [In Progress]
- **Target**: `Artifacts/MEMORY_ANCHORS.md`, `rules/common/orchestration.md`
- **Logic**: 
  - Define `MEMORY_ANCHORS.md` as cold storage for constraints.
  - Mandate "Plan Pruning" to keep `IMPLEMENTATION_PLAN.md` focused on active phases.

## Verification Plan

### Manual Verification
1. **Pruning Check**: Confirm completed plans (LLM Council) are archived to `Artifacts/history/`.
2. **Memory Check**: Ensure the new rules for `MEMORY_ANCHORS.md` are registered in `orchestration.md`.
3. **Hygiene Check**: Run `/clean` to verify `Artifacts/Temp/` is cleared.
