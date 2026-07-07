---
name: project-journal
description: Use this skill whenever you are maintaining session history, decision logs, or project memory across sessions. It is the primary tool for the concierge agent to manage context debt and ensure seamless handoffs. Trigger this skill at session start (via /sync) to recover state and at session end (via /handoff) to capture progress, decisions, and blockers. Do NOT use for routine task status tracking (that belongs in Artifacts/TODO.md) or technical design (that belongs in Artifacts/IMPLEMENTATION_PLAN.md).
argument-hint: "[--sync|--handoff|--ingest]"
metadata:
  version: "1.0.1"
  tags: ["context", "memory", "management", "workflow", "state", "handoff", "concierge"]
  verbosity_control: "TELEGRAPHIC. Focus on state-changes and hand-off requirements. Keep logs to the bare minimum required for continuity."
---


# Skill: Project Journaling & State Persistence

## 📓 The Journaling Mandate
Every session must conclude with an update to the project's memory to prevent "Context Debt." The `concierge` agent is the sole owner of this process, triggered by `/handoff` at session end and `/sync` at session start.

## 📝 Short-Term Memory: `.agent/current_task.md`

This is the "You Are Here" marker. It must be updated at every session start, end, and agent transition.

### Required Fields

**# Current Task**

- **## Objective**: The single atomic task from Artifacts/TODO.md currently active.
- **## Status**: Not Started / In Progress / Blocked / Awaiting Audit.
- **## Technical Context**:
  - **Active Files**: Specific files being modified.
  - **Active Branch**: Git branch if applicable.
  - **Language/Domain**: Python / TS / C# / DAX / Manuscript.
  - **Equipped Skills**: Which skills are loaded.
- **## Session History**:
  - **Started**: Timestamp.
  - **Last Updated**: Timestamp.
  - **Active Agent**: Which agent is currently working.
- **## Decisions Made**: Any Step 0 pivots, architectural choices, or scope changes this session.
- **## Blockers**: Anything preventing forward progress — external input needed, technical issue, dependency.
- **## Handoff**:
  - **Next Agent**: Which agent should take over.
  - **Next Action**: Specific action, not vague.
  - **Critical Context**: 1–2 sentences the next agent MUST know.

### Update Triggers
- **Session start** (`/sync`): Validate existing content, update with delta scan results.
- **Agent transition**: Update `Active Agent`, `Next Agent`, and `Handoff` fields.
- **Task status change**: Update `Status` when moving from `[ ]` to `[-]` or `[-]` to awaiting audit.
- **Session end** (`/handoff`): Full refresh of all fields. This is the most critical update.
- **Blocker discovered**: Immediately update `Blockers` field — don't wait for session end.

### Staleness Rules
- If `Last Updated` is more than 1 session old, flag as **STALE** during `/sync`.
- If `Objective` doesn't match any task in `Artifacts/TODO.md`, flag as **ORPHANED** during `/sync`.
- If `Active Files` reference files that no longer exist, flag as **DRIFT** during `/sync`.

## 🏛 Long-Term Memory: `Artifacts/DECISION_LOG.md`

For major architectural shifts, technology pivots, or scope changes. This is an append-only file — never edit or delete existing entries.

### Required Fields Per Entry

- **## [YYYY-MM-DD] — [Short Decision Title]**
- **Decision**: What was decided.
- **Rationale**: Why — reference Step 0 Value Check, Risk, or technical constraint.
- **Alternatives Considered**: What was rejected and why.
- **Impact**: What changes as a result — files, architecture, workflow.
- **Status**: Active / Superseded by [date + link to newer entry].

### When to Log
- Technology switch (e.g., IronPython → CPython, REST → MCP).
- Architecture change (e.g., monolith → modular, new service boundary).
- Scope change (e.g., feature added or dropped from plan).
- Step 0 re-evaluation (e.g., success metric changed, risk materialized).
- Tool or library swap (e.g., `mypy` → `pyright`, `jest` → `vitest`).
- User override of Step 0 (`STEP0-BYPASS` — document the justification).

### When NOT to Log
- Routine task completion (that's `Artifacts/TODO.md`).
- Bug fixes that don't change architecture.
- Formatting or naming changes.
- Session summaries (that's `.agent/current_task.md`).

## 📦 Archive Protocol: `Artifacts/History/`

### Artifacts/TODO.md Archival
- When `Artifacts/TODO.md` exceeds 200 lines, archive completed phases.
- Archived to `Artifacts/History/` (date-suffixed to disambiguate snapshots, e.g. `TODO-2026-03-01.md`).
- The archive is read-only — never modify archived files.
- Current `Artifacts/TODO.md` retains only active and upcoming phases.

### Plan Archival
- When `/blueprint` runs in Re-Plan mode, archive the current plan to `Artifacts/History/` (date-suffixed, e.g. `IMPLEMENTATION_PLAN-2026-03-01.md`).
- Completed **phase** plans/reports keep their `Phase-N-Plan.md` / `Phase-N-Report.md` names under `Artifacts/History/Plans/` and `History/Reports/` (per `orchestration.md`).
- The `strategist` references archived plans during post-mortem analysis.

### Archive Index
Maintain a `Artifacts/History/INDEX.md` file:

| File | Archived Date | Reason |
| :--- | :--- | :--- |
| TODO-2026-03-01.md | 2026-03-01 | Phase 1 complete |
| IMPLEMENTATION_PLAN-2026-03-10.md | 2026-03-10 | Re-plan after CPython pivot |
| Phase-1-Plan.md | 2026-03-10 | Phase 1 archived (keep-name, in History/Plans/) |

## 🔄 Sync Logic (Alignment with `/sync`)

### Session Start Sequence
1. **Read** `.agent/current_task.md` — restore context.
2. **Validate** against `Artifacts/TODO.md`:
   - Does the Objective match an existing task?
   - Is the Status consistent with the `Artifacts/TODO.md` marker (`[ ]`, `[-]`, `[x]`)?
   - Are Active Files still present in the file system?
3. **Delta Scan** — identify changes since `Last Updated`.
4. **Reconcile** — update `current_task.md` with validated state.
5. **Brief** — output the session start summary.

### Session End Sequence
1. **Summarize** — compress the session into `current_task.md` fields.
2. **Scrub** — remove completed micro-tasks from `Artifacts/TODO.md`.
3. **Archive** — move completed phases to `Artifacts/History/` if threshold exceeded.
4. **Log** — append decisions to `Artifacts/DECISION_LOG.md` if any occurred.
5. **Brief** — output the handoff summary for the next session.

## 🧠 Context Compression Rules

When summarizing for handoff or context window management:

### Preserve (Always Keep)
- Current task objective and status.
- Active file paths and their modification state.
- Unresolved blockers and open questions.
- Decisions made this session (even if logged in `Artifacts/DECISION_LOG.md`).
- The next recommended agent and action.

### Compress (Summarize to One Line)
- Resolved debugging threads → "Fixed [issue] in [file] by [approach]."
- Completed review cycles → "Task [n] passed audit on [date]."
- Exploratory discussions that reached a conclusion → "Decided on [choice] because [reason]."

### Discard (Remove Entirely)
- Superseded plans and abandoned approaches.
- Verbose tool outputs that have been synthesized.
- Repeated instructions or re-explanations.
- Small talk or conversational filler.

## 📋 Journaling Checklist

Run at every session end (`/handoff`):

- [ ] `Artifacts/.agent/current_task.md` reflects the exact current state?
- [ ] All fields populated — no blanks in Objective, Status, or Handoff?
- [ ] `Artifacts/TODO.md` status markers are accurate (`[ ]`, `[-]`, `[x]`)?
- [ ] Any manual drift documented in current_task.md or flagged for `/sync`?
- [ ] Decisions logged in `Artifacts/DECISION_LOG.md` if applicable?
- [ ] `Artifacts/TODO.md` under 200 lines (archive if needed)?
- [ ] `Artifacts/History/INDEX.md` updated if archival occurred?
- [ ] Next agent and action clearly identified in Handoff section?
- [ ] Context window is lean — no stale threads or verbose outputs retained?