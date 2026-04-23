---
description: Triggers the concierge to execute a clean session end. Compresses context, snapshots state, and prepares a brief for the next session.
---

# Command: /handoff

Owned by the **concierge**. The "Save Game" — ensures no context is lost between sessions.

## Execution Sequence

1. **Learnings Capture**: Scan session for mistakes/preferences/gotchas. Propose `/learn` candidates to user. Detect recurring patterns and suggest `--global` flag for graduation. Append local entries to `Artifacts/LEARNINGS.md` (pruning if >50) or global entries to `GLOBAL_INBOX.md`.
2. **Session Summary**: Tasks worked on, agents active, decisions/pivots made.
3. **State Snapshot**: Update `.agent/current_task.md`, verify `Artifacts/TODO.md` markers, append to `Artifacts/DECISION_LOG.md`.
4. **Context Compression**: Summarize resolved threads. Preserve active tasks/open questions. Discard superseded plans and verbose outputs.
5. **TODO Hygiene**: Scrub completed micro-tasks. Archive to `Artifacts/history/TODO_phase_[n].md` if >200 lines.
6. **Generate Brief**: Follow the **Mirroring Rule [HARD-GATE]**: Write to the brain/shadow directory with `IsArtifact: true` AND to `Artifacts/HANDOFF_BRIEF.md` in the workspace with `IsArtifact: false` using the absolute path.
7. **Hygiene Phase**: 
   - Delete all files in `Artifacts/Temp/`.
   - Identify and propose deletion of stray transient files (e.g., `*.tmp`, `debug.log`, uncommitted scratch files not in `.gitignore`).
8. **Memory Graduation**: Extract new constraints/constants and graduate them to `Artifacts/MEMORY_ANCHORS.md`.
9. **Plan Pruning**: Move technical specs of completed phases from `Artifacts/IMPLEMENTATION_PLAN.md` to `Artifacts/history/PLAN_Phase_[N].md`.

## Handoff Brief Format

- **Session Summary**: Duration, active agents, tasks touched.
- **Completed**: Task → outcome.
- **In Progress**: Task → current state.
- **Blockers**: Open questions or dependencies.
- **Decisions**: Decision → rationale (also in `Artifacts/DECISION_LOG.md`).
- **State File Health**: `.agent/current_task.md` / `Artifacts/TODO.md` / `Artifacts/IMPLEMENTATION_PLAN.md` / `Artifacts/ARCH.md` — status each.
- **Next Session**: Agent → task → 1-2 sentences critical context.

## Handoff Targets

- **Session-to-Session** (default): Full snapshot, brief for self-resume.
- **Agent-to-Agent**: Lightweight — task, current state, relevant files, skill to equip, success criteria.
- **Emergency**: Minimal — current task, current file, status, one critical context line, next step.

## Triggers
Concierge proactively suggests `/handoff` when:
- Context window >60% estimated capacity.
- 3+ distinct tasks discussed in one session.
- Extended work without sync/handoff.

## Boundaries
Does NOT: mark `[x]`, modify `Artifacts/IMPLEMENTATION_PLAN.md`, run `/sync`, execute code.