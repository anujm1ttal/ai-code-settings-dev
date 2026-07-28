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

## Pre-Flight: Context Guard (run FIRST, before the sequence below)

`/handoff --phase` is the heaviest tier run at the fullest point of a session, and its
compaction-resistant steps (1 Learnings Capture, 1.7 Task Mining) must re-scan the whole
session conversation — you cannot summarize away the transcript you are about to mine. If the
window is already near the ceiling, invoking the full sequence can overflow the model's input
limit even after auto-compact fires ("prompt is too long" right after "N tokens freed"). Guard
against that:

1. **Persist durable state first.** Do the cheap, always-succeeding disk writes — State
   Snapshot (step 3) and Generate Brief (step 6) — before anything that needs the full
   transcript. If the session dies mid-handoff, the durable state is already saved.
2. **Gate the mining steps on headroom.** If context is at/over ~60%, STOP before steps 1 and
   1.7. Tell the user: *"Context is high — run `/compact`, then re-invoke `/handoff --phase` to
   complete learnings capture and task mining against a clean window."* These steps resist
   compaction, so they must run with headroom, not at the cliff. The concierge cannot invoke
   `/compact` itself (user-level command) — it advises and waits.
3. **Reactive recovery.** If you already hit "prompt is too long", you cannot `/handoff` out of
   it — `/compact` first (the SessionStart hook re-injects the state brief), then run the phase
   handoff on the smaller window.

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
3. **State Snapshot**: Update `Artifacts/.agent/current_task.md`, verify `Artifacts/TODO.md` markers, append to `Artifacts/DECISION_LOG.md` (log is newest-first: read the head, not the whole file, when checking prior entries). **Rotation check**: after appending, if the active log exceeds **>400 lines OR >40 entries**, rotate the oldest RESOLVED entries to `Artifacts/History/DECISION_LOG-archive.md` (prepend, newest-first preserved; unresolved entries never rotate; never delete). Then run the **State File Health Check** — all five must be healthy and synchronized before the session ends (prevents context loss):
   - `Artifacts/.agent/current_task.md` — updated with current task status
   - `Artifacts/TODO.md` — active task markers correct
   - `Artifacts/IMPLEMENTATION_PLAN.md` — no unnecessary changes
   - `Artifacts/ARCH.md` — stable
   - `Artifacts/DECISION_LOG.md` — stable
4. **Context Compression**: Summarize resolved threads. Preserve active tasks/open questions. Discard superseded plans and verbose outputs.
5. **TODO Hygiene**: Scrub completed micro-tasks. Archive to `Artifacts/History/` if >200 lines.
6. **Generate Brief**: **If `scripts/gate_telemetry.py` exists in the workspace** (it ships only with the ai-code-settings repo — `scripts/` is not globally deployed), run `python scripts/gate_telemetry.py` (reads `Artifacts/.agent/gate_events.jsonl`) and include its per-hook deny/nag table verbatim under a **Gate Telemetry** heading. **Check existence with a repo-relative, forward-slash path — never a Windows backslash absolute path** (in the Bash tool `\U`, `\s`, … are escape sequences that silently collapse the path, yielding a false "not present"): `test -f scripts/gate_telemetry.py && python scripts/gate_telemetry.py`. **Otherwise skip this sub-step** — the hooks still log `gate_events.jsonl` in every project, but the reader is repo-local (global telemetry deployment is a deferred enhancement). Write `Artifacts/HANDOFF_BRIEF.md` in the workspace (source of truth) using the absolute path. **Gemini/Antigravity only**: also mirror to the brain/shadow directory with `IsArtifact: true` per the Mirroring Rule [HARD-GATE] — Claude Code has no shadow-directory write path, so this sub-step is a no-op here.
7. **Hygiene Phase**: 
   - **BACKLOG rotation check** (all tiers): `test -f scripts/backlog_audit.py && python scripts/backlog_audit.py --violations-only` — repo-local tool, so **skip this sub-step when absent**, exactly as step 6 handles `gate_telemetry.py` (check with a repo-relative, forward-slash path — a Windows backslash absolute path silently collapses in the Bash tool). On a size violation, rotate the oldest **RESOLVED** entries to `Artifacts/History/BACKLOG-archive.md` per `rules/common/orchestration.md` §BACKLOG Lifecycle. The tool reports; **it never edits** — rotation is performed here, and OPEN entries never rotate.
   - **Task-graph check** (all tiers): `test -f scripts/todo_graph.py && python scripts/todo_graph.py --violations-only` — repo-local tool on the identical graceful-skip contract as the BACKLOG check above (**skip when absent**; repo-relative forward-slash path — a Windows backslash absolute path silently collapses in the Bash tool). Validates the `Blocked by:` / `Mode:` grammar in `Artifacts/Plans/*-TODO.md` per `rules/common/orchestration.md` §Artifacts/TODO.md Authority: cycle, unknown blocker ID, malformed task line, and the blind-zero guard. Redundant-edge findings are **advisories** and do not fail the check. The tool reports; **it never edits** — TODO Authority is unchanged, and it does **not** compute or feed `/afk`'s frontier.
   - **Promote** (all tiers, **before any purge**): move every `Artifacts/Temp/` file cited by a durable record (phase report, `AUDIT_REPORT.md`, `DECISION_LOG.md`, `BACKLOG.md` finding, `learnings/` entry) to `Artifacts/Evidence/<phase>/` and repoint the citation in the same pass — `rules/common/orchestration.md` §Evidence Retention.
   - **Purge** (L2/L3): Delete all files in `Artifacts/Temp/`. **Never** delete `Artifacts/Evidence/`.
   - **Flag** (L1/L2/L3): Identify and propose deletion of stray transient files (e.g., `*.tmp`, `debug.log`, uncommitted scratch files not in `.gitignore`).
7.5. **State-Repo Push** (all tiers, **last write of the session**): `test -d Artifacts/.git` — when present, `Artifacts/` is a **nested repo with its own remote** and committing the outer workspace backs up none of it. Run `git -C Artifacts add -A && git -C Artifacts commit -m "state: <session summary>" && git -C Artifacts push`. Runs **after** steps 1–7 so the brief, learnings, and TODO edits are included. **Skip when absent** — in the ordinary arrangement `Artifacts/` is tracked by the workspace repo and this is a no-op. The `nudge-handoff.js` Stop hook independently checks this and nags on uncommitted/unpushed state; a nag here means the push did not happen.
8. **Memory Graduation**: Extract new constraints/constants and graduate them to `Artifacts/MEMORY_ANCHORS.md`.
9. **Plan Pruning**: Move technical specs of completed phases from `Artifacts/IMPLEMENTATION_PLAN.md` to `Artifacts/History/Plans/Phase-[N]-Plan.md`.

## Handoff Brief Format

- **Tier Info**: Level used (Checkpoint/Session/Phase).
- **Session Summary**: Duration, active agents, tasks touched.
- **Completed**: Task → outcome.
- **In Progress**: Task → current state.
- **Blockers**: Open questions or dependencies.
- **Decisions**: Decision → rationale (also in `Artifacts/DECISION_LOG.md`).
- **State File Health**: Status of `Artifacts/.agent/current_task.md`, `Artifacts/TODO.md`, and `Artifacts/IMPLEMENTATION_PLAN.md`.
- **Gate Telemetry**: `scripts/gate_telemetry.py` output — per-hook deny/nag counts and last-fired timestamp.
- **Next Session**: Agent → task → 1-2 sentences critical context.

## Triggers
Concierge proactively suggests `/handoff` when:
- Context window >60% estimated capacity.
- 3+ distinct tasks discussed in one session.
- Extended work without sync/handoff.

## Boundaries
Does NOT: mark `[x]`, modify active implementation logic, run `/sync`, execute code.