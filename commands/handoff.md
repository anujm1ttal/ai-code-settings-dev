---
description: Triggers the concierge agent to execute a clean session end. Compresses context, snapshots state, and prepares a brief for the next session or agent.
---

# Command: /handoff

This command is owned by the **concierge** agent. It is the "Save Game" of the workspace — ensuring that no context is lost between sessions and the next session (or agent) can resume instantly.

## ⚡ Execution Sequence

1. **Session Summary**: Analyze the current session and capture:
   - What tasks were worked on and their current status.
   - Which agents were active and what they produced.
   - Any decisions, pivots, or Step 0 changes that occurred.
2. **State Snapshot**: Update all state files:
   - `.agent/current_task.md` — refresh with current objective, technical context, decisions, and handoff.
   - `TODO.md` — verify all status markers (`[ ]`, `[-]`, `[x]`) are accurate.
   - `DECISION_LOG.md` — append any architectural decisions made during the session.
3. **Context Compression**: Clean up the context window:
   - Summarize resolved debugging threads into single-line outcomes.
   - Collapse completed review cycles into pass/fail notes.
   - Preserve: active task details, open questions, unresolved blockers.
   - Discard: superseded plans, exploratory tangents that led nowhere, verbose tool outputs.
4. **TODO Hygiene**: Maintain `TODO.md` health:
   - Scrub completed micro-tasks that add noise.
   - If `TODO.md` exceeds 200 lines, archive completed phases to `history/TODO_phase_[n].md`.
5. **Next Brief**: Generate the handoff output.

## 📋 Handoff Brief Format

### Session Handoff — [Date/Timestamp]

**Session Summary**:
- **Duration**: [approximate time or turn count]
- **Active Agents**: [which agents were invoked]
- **Tasks Touched**: [list with status changes]

**Completed This Session**:
- [task] — [outcome / what was produced]

**In Progress**:
- [task] — [current state / what remains]

**Blockers / Open Questions**:
- [blocker or question that needs resolution before continuing]

**Decisions Made**:
- [decision] — [rationale] (also logged in `DECISION_LOG.md`)

**State File Health**:
- `.agent/current_task.md`: Updated ✅
- `TODO.md`: [status — clean / archived / needs attention]
- `IMPLEMENTATION_PLAN.md`: [in sync / drift detected]
- `ARCH.md`: [current / stale]

**Next Session Recommendation**:
- **Agent**: [which agent should take the first action]
- **Task**: [specific task from TODO.md]
- **Context**: [1-2 sentences of critical context the next session needs]

## 🔗 Handoff Targets

### Session-to-Session (Default)
The most common use — you're ending your work session and want to resume later.
- Full state snapshot and context compression.
- Brief optimized for **you** picking up where you left off.

### Agent-to-Agent
Used when routing from one agent to another mid-session.
- Lighter weight — no TODO hygiene or archival.
- Brief optimized for the **receiving agent** with only the context it needs.
- Format:

> **Handoff: [Source Agent] → [Target Agent]**
> - **Task**: [specific task being handed off]
> - **Current State**: [what has been done so far]
> - **Relevant Files**: [files the receiving agent needs to read]
> - **Skill Required**: [which skill-*.md to equip]
> - **Success Criteria**: [how the receiving agent knows it's done]

### Emergency Handoff
Used when context window is critically full or the session must end abruptly.
- Minimal format — capture only the essentials.
- Format:

> **Emergency Handoff — [Date/Timestamp]**
> - **Current Task**: [one line]
> - **Current File**: [primary file being worked on]
> - **Status**: [what's done / what's not]
> - **Critical Context**: [the one thing the next session MUST know]
> - **Next Step**: [single action]

## 🧠 Context Window Triggers

The concierge should **proactively suggest** `/handoff` when:
- Conversation exceeds ~60% of estimated context window.
- More than 3 distinct tasks have been discussed in a single session.
- The user has been working for an extended period without a sync or handoff.
- An agent-to-agent transition is needed and the current context is heavy.

## 🚫 What /handoff Does NOT Do
- Does not mark `TODO.md` items `[x]` — only the `auditor` has that authority.
- Does not modify `IMPLEMENTATION_PLAN.md` — only the `strategist` can restructure.
- Does not run a full `/sync` delta scan — if you need file system reconciliation, run `/sync` first.
- Does not execute code, run builds, or trigger audits.

## 💬 Example Usage

> **User**: That's enough for today. /handoff
>
> **Concierge**:
> ### Session Handoff — 2026-03-15 18:45
>
> **Session Summary**:
> - **Duration**: ~2 hours
> - **Active Agents**: strategist, coder, auditor
> - **Tasks Touched**: 2.3 (sightline calc), 2.4 (data tree refactor)
>
> **Completed This Session**:
> - Task 2.3 — Sightline calculation implemented and passed audit. Marked `[x]`.
>
> **In Progress**:
> - Task 2.4 — Data tree refactor started. `seating_grid.py` restructured but not validated.
>
> **Blockers / Open Questions**:
> - Need to confirm premium C-Value threshold with the stadium ops team (60mm or 90mm?).
>
> **Decisions Made**:
> - Switched from `rhinoscriptsyntax` to `RhinoCommon` for all sightline operations (performance). Logged in `DECISION_LOG.md`.
>
> **State File Health**:
> - `.agent/current_task.md`: Updated ✅
> - `TODO.md`: Clean ✅
> - `IMPLEMENTATION_PLAN.md`: In sync ✅
> - `ARCH.md`: Stale ⚠️ — needs update to reflect RhinoCommon decision
>
> **Next Session Recommendation**:
> - **Agent**: auditor
> - **Task**: Review Task 2.4 data tree refactor in `seating_grid.py`
> - **Context**: File uses new RhinoCommon path structure. Validate data tree paths against `skill-python-rhino.md` before marking complete.