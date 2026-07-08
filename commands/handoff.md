---
description: Triggers the concierge to execute a clean session end. Compresses context, snapshots state, and prepares a brief for the next session.
argument-hint: "[--lite|--phase]"
model: claude-haiku-4-5
---

# Command: /handoff

Owned by the **concierge**. The "Save Game" — ensures no context is lost between sessions.

## Execution Tiers

| Tier | Flag | Purpose | Sequence Steps |
| :--- | :--- | :--- | :--- |
| **L1: Checkpoint** | `--lite` | Mid-task pause. | 3, 4, 6, 7 (Flag only) |
| **L2: Session** | *(Default)* | End of session. | 1, 1.5, 1.7, 2, 3, 4, 6, 7 (Purge Temp) |
| **L3: Phase-Gate**| `--phase` | Phase completion. | 1, 1.5, 1.7, 2, 3, 4, 5, 6, 7, 8, 9 |

## Execution Sequence

1. **Learnings Capture**: Scan session for mistakes/preferences/gotchas. Propose `/learn` candidates to user. Append local entries to `Artifacts/learnings/` structure.
1.5. **Hot-Cache Refresh** (L2/L3 only): Update `Artifacts/learnings/HOT.md`:
   - Refresh `Last Referenced` dates for entries used this session.
   - Promote any learning referenced 3+ times across sessions but not yet in HOT.md.
   - If entry count exceeds 30, demote the oldest by `Last Referenced` date back to category index.
1.7. **Task Mining** (L2/L3 only): Scan the session conversation for uncommitted action items.
   Look for phrases indicating future work:
   - "need to", "should", "TODO", "next we'll", "I'll", "let's", "we could"
   - Unresolved questions marked with "?" that imply investigation tasks
   - User requests that were acknowledged but not completed this session
   
   Present candidates:
   ```
   ## Possible Uncommitted Tasks
   1. "[quoted phrase from conversation]"
      → Proposed: [ ] [agent] Task description — depends: X
   2. "[quoted phrase]"
      → Proposed: [ ] [agent] Task description — depends: Y
   ```
   User confirms which to add to `Artifacts/TODO.md`. Never auto-add.
2. **Session Summary**: Tasks worked on, agents active, decisions/pivots made.
3. **State Snapshot**: Update `.agent/current_task.md`, verify `Artifacts/TODO.md` markers, append to `Artifacts/DECISION_LOG.md`. Then run the **State File Health Check** — all five must be healthy and synchronized before the session ends (prevents context loss):
   - `.agent/current_task.md` — updated with current task status
   - `Artifacts/TODO.md` — active task markers correct
   - `Artifacts/IMPLEMENTATION_PLAN.md` — no unnecessary changes
   - `Artifacts/ARCH.md` — stable
   - `Artifacts/DECISION_LOG.md` — stable
4. **Context Compression**: Summarize resolved threads. Preserve active tasks/open questions. Discard superseded plans and verbose outputs.
5. **TODO Hygiene**: Scrub completed micro-tasks. Archive to `Artifacts/History/` if >200 lines.
6. **Generate Brief**: **If `scripts/gate_telemetry.py` exists in the workspace** (it ships only with the ai-code-settings repo — `scripts/` is not globally deployed), run `python scripts/gate_telemetry.py` (reads `Artifacts/.agent/gate_events.jsonl`) and include its per-hook deny/nag table verbatim under a **Gate Telemetry** heading. **Otherwise skip this sub-step** — the hooks still log `gate_events.jsonl` in every project, but the reader is repo-local (global telemetry deployment is a deferred enhancement). Write `Artifacts/HANDOFF_BRIEF.md` in the workspace (source of truth) using the absolute path. **Gemini/Antigravity only**: also mirror to the brain/shadow directory with `IsArtifact: true` per the Mirroring Rule [HARD-GATE] — Claude Code has no shadow-directory write path, so this sub-step is a no-op here.
7. **Hygiene Phase**: 
   - **Purge** (L2/L3): Delete all files in `Artifacts/Temp/`.
   - **Flag** (L1/L2/L3): Identify and propose deletion of stray transient files (e.g., `*.tmp`, `debug.log`, uncommitted scratch files not in `.gitignore`).
8. **Memory Graduation**: Extract new constraints/constants and graduate them to `Artifacts/MEMORY_ANCHORS.md`.
9. **Plan Pruning**: Move technical specs of completed phases from `Artifacts/IMPLEMENTATION_PLAN.md` to `Artifacts/History/Plans/Phase-[N]-Plan.md`.

## Handoff Brief Format

- **Tier Info**: Level used (Checkpoint/Session/Phase).
- **Session Summary**: Duration, active agents, tasks touched.
- **Completed**: Task → outcome.
- **In Progress**: Task → current state.
- **Blockers**: Open questions or dependencies.
- **Decisions**: Decision → rationale (also in `Artifacts/DECISION_LOG.md`).
- **State File Health**: Status of `.agent/current_task.md`, `Artifacts/TODO.md`, and `Artifacts/IMPLEMENTATION_PLAN.md`.
- **Gate Telemetry**: `scripts/gate_telemetry.py` output — per-hook deny/nag counts and last-fired timestamp.
- **Next Session**: Agent → task → 1-2 sentences critical context.

## Triggers
Concierge proactively suggests `/handoff` when:
- Context window >60% estimated capacity.
- 3+ distinct tasks discussed in one session.
- Extended work without sync/handoff.

## Boundaries
Does NOT: mark `[x]`, modify active implementation logic, run `/sync`, execute code.