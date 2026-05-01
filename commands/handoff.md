---
description: Triggers the concierge to execute a clean session end. Compresses context, snapshots state, and prepares a brief for the next session.
---

# Command: /handoff

Owned by the **concierge**. The "Save Game" — ensures no context is lost between sessions.

## Execution Tiers

| Tier | Flag | Purpose | Sequence Steps |
| :--- | :--- | :--- | :--- |
| **L1: Checkpoint** | `--lite` | Mid-task pause. | 3, 4, 6, 7 (Flag only) |
| **L2: Session** | *(Default)* | End of session. | 1, 2, 3, 4, 6, 7 (Purge Temp) |
| **L3: Phase-Gate**| `--phase` | Phase completion. | 1, 2, 3, 4, 5, 6, 7, 8, 9 |

## Execution Sequence

1. **Learnings Capture**: Scan session for mistakes/preferences/gotchas. Propose `/learn` candidates to user. Append local entries to `Artifacts/learnings/` structure.
2. **Session Summary**: Tasks worked on, agents active, decisions/pivots made.
3. **State Snapshot**: Update `.agent/current_task.md`, verify `Artifacts/TODO.md` markers, append to `Artifacts/DECISION_LOG.md`.
4. **Context Compression**: Summarize resolved threads. Preserve active tasks/open questions. Discard superseded plans and verbose outputs.
5. **TODO Hygiene**: Scrub completed micro-tasks. Archive to `Artifacts/history/TODO_phase_[n].md` if >200 lines.
6. **Generate Brief**: Follow the **Mirroring Rule [HARD-GATE]**: Write to the brain/shadow directory with `IsArtifact: true` AND to `Artifacts/HANDOFF_BRIEF.md` in the workspace with `IsArtifact: false` using the absolute path.
7. **Hygiene Phase**: 
   - **Purge** (L2/L3): Delete all files in `Artifacts/Temp/`.
   - **Flag** (L1/L2/L3): Identify and propose deletion of stray transient files (e.g., `*.tmp`, `debug.log`, uncommitted scratch files not in `.gitignore`).
8. **Memory Graduation**: Extract new constraints/constants and graduate them to `Artifacts/MEMORY_ANCHORS.md`.
9. **Plan Pruning**: Move technical specs of completed phases from `Artifacts/IMPLEMENTATION_PLAN.md` to `Artifacts/history/PLAN_Phase_[N].md`.

## Handoff Brief Format

- **Tier Info**: Level used (Checkpoint/Session/Phase).
- **Session Summary**: Duration, active agents, tasks touched.
- **Completed**: Task → outcome.
- **In Progress**: Task → current state.
- **Blockers**: Open questions or dependencies.
- **Decisions**: Decision → rationale (also in `Artifacts/DECISION_LOG.md`).
- **State File Health**: Status of `.agent/current_task.md`, `Artifacts/TODO.md`, and `Artifacts/IMPLEMENTATION_PLAN.md`.
- **Next Session**: Agent → task → 1-2 sentences critical context.

## Triggers
Concierge proactively suggests `/handoff` when:
- Context window >60% estimated capacity.
- 3+ distinct tasks discussed in one session.
- Extended work without sync/handoff.

## Boundaries
Does NOT: mark `[x]`, modify active implementation logic, run `/sync`, execute code.