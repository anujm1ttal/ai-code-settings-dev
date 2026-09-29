---
description: Triggers the strategist to initialize a new project, append a phase, or re-plan after a pivot. Enforces Step 0 and creates the Implementation Plan.
argument-hint: "[--team] [--interview]"
model: claude-opus-5-5
---

# Command: /blueprint

**Strategist** takes control to architect the project foundation.

## Mode Detection

```
No Artifacts/IMPLEMENTATION_PLAN.md → NEW PROJECT
All phases complete → NEW PHASE
User states pivot/failure/restart → RE-PLAN
`--interview` flag → within whichever mode above, the Requirements Interview step (wherever it falls in that mode) runs the depth traversal instead of the default sweep
Uncertain → Ask: "Adding a new phase or starting over?"
```

## New Project
1. Analyze user's project idea.
2. **Requirements Interview**: Ask 3–5 targeted questions to uncover hidden constraints and goals (see `strategist.md`). Ask them **one at a time** — wait for each answer before asking the next; earlier answers should shape later questions. Prefer multiple-choice (AskUserQuestion) when the options are enumerable.
   - **`--interview`**: Replaces the line above — never runs alongside it. Unbounded depth-first traversal per `elicitation-guide.md` §2–§5 (`business-analyst` skill). Exits only on a signed restatement (guide §5), not question count.
   - Default path only: a brief synthesis of the gathered answers before Step 0 is permitted — label it "Summary", never "Restatement" (reserved for `--interview`'s §5 signed-exit gate).
3. **Step 0 Challenge**: PROJECT_TYPE, VALUE_CHECK, VALUE_ROI, MINIMALISM, RISKS.
   - **Gate 1 Trigger**: If the drafted plan exceeds 50 lines, run `/grill` before proceeding — mandatory stress-test for plans at this scale (see `grill.md` Relationships).
4. **Phased Roadmap**: 3–4 phases with numeric success metrics.
5. **Create files**: `Artifacts/IMPLEMENTATION_PLAN.md`, `Artifacts/TODO.md`, `Artifacts/ARCH.md`, `Artifacts/Plans/Phase-1-Plan.md`, `Artifacts/Plans/Phase-1-TODO.md`.
6. **Publish Visual Plan**: If `Artifacts/IMPLEMENTATION_PLAN.md` exceeds the Gate 1 threshold (50 lines), publish it as an Artifact per `project-planner` skill § Visual Plan Publishing. Below threshold, skip.
7. **Git Init**: Create new branch `phase-1-[description]`.
8. **Handoff**: Identify first agent + task. If a Visual Plan was published, lead the response with its link.

## New Phase
1. Run `/sync` via concierge to validate current state.
2. **BACKLOG Reconciliation**: Walk **every OPEN entry** in `Artifacts/BACKLOG.md`. Assign each a verdict — **(a) pull into this phase** (fold into the phase's `Phase-N-Plan.md` / `Phase-N-TODO.md`), **(b) keep OPEN**, overwriting the entry's reason with a fresh one-line "why not now" (replaces the prior reason line, never appends), or **(c) mark RESOLVED** (done elsewhere / won't-do). No OPEN entry passes unexamined. This is a decision gate, not auto-scheduling — an unpicked entry stays OPEN with a recorded reason; BACKLOG stays memory, not a queue (`rules/common/orchestration.md` §BACKLOG). Skip if no `Artifacts/BACKLOG.md`.
3. Confirm prior phase success metrics met (auditor-verified).
4. Step 0 for new phase only (VALUE_CHECK, VALUE_ROI, MINIMALISM, RISKS).
   - **Gate 1 Trigger**: If the appended phase spec exceeds 50 lines, run `/grill` before proceeding.
5. Append to `Artifacts/IMPLEMENTATION_PLAN.md` and `Artifacts/TODO.md`. Update `Artifacts/ARCH.md` if needed. Create `Artifacts/Plans/Phase-N-Plan.md` and `Artifacts/Plans/Phase-N-TODO.md` for the new phase.
6. **Publish Visual Plan**: Re-run the Gate 1 threshold check against the updated file. If a `**Visual Plan**:` URL is already recorded, republish to that same URL. Otherwise apply step 6 of New Project.
7. **Git Init**: Create new branch `phase-[N]-[description]`.

## Re-Plan
1. Archive current `Artifacts/IMPLEMENTATION_PLAN.md` + `Artifacts/TODO.md` to `Artifacts/History/` with timestamp.
2. Post-mortem in `Artifacts/DECISION_LOG.md`: original assumption → invalidating evidence → constraint changes.
3. **BACKLOG Reconciliation**: Walk **every OPEN entry** in `Artifacts/BACKLOG.md` — the failure may relate to work already parked there. Assign each a verdict — **(a) pull into the re-plan**, **(b) keep OPEN**, overwriting the entry's reason with a fresh one-line "why not now" (replaces the prior reason line, never appends), or **(c) mark RESOLVED**. No OPEN entry passes unexamined. Decision gate, not auto-scheduling (`rules/common/orchestration.md` §BACKLOG). Skip if no `Artifacts/BACKLOG.md`.
4. **Requirements Interview**: Re-verify boundaries if failure was due to requirement drift.
   - **`--interview`**: Replaces the line above — never runs alongside it. Unbounded depth-first traversal per `elicitation-guide.md` §2–§5 (`business-analyst` skill). Exits only on a signed restatement (guide §5), not question count.
5. Full Step 0 referencing what failed.
6. Fresh files.
7. **Publish Visual Plan**: Apply step 6 of New Project — a Re-Plan is a fresh file, so publish fresh (do not reuse the archived plan's old URL).
8. **Git Init**: Create new branch `phase-[N]-replan`.
9. Restart pipeline.

## Parallel Team Execution (`/blueprint --team`)
Leverages Claude Agent Teams to independently challenge the architecture. If token context limits are hit, automatically fall back to standard execution.
1. **Spawn Integrator**: While the lead `strategist` is mapping the phased roadmap based on user inputs, spawn a **Risk Assessor** teammate.
2. **Step 0 Challenge**: The Risk Assessor performs the Step 0 Challenge (MINIMALISM and RISKS validation) independently, reviewing the draft plan to find scope creep, invalidating evidence, or unaddressed dependencies.
3. **Synthesize**: The lead `strategist` utilizes the Risk Assessor's feedback to finalize `Artifacts/IMPLEMENTATION_PLAN.md`.

## BACKLOG

**BACKLOG**: a plain running list of deferred work — one entry per item (a line or a short paragraph),
marked `OPEN` or `RESOLVED`. Nothing auto-schedules off it: `/sync` surfaces OPEN entries, and
`/blueprint` forces a verdict on each (pull in / keep / resolve). No IDs, caps, or rotation
protocol — when it gets unwieldy, move the RESOLVED entries to `History/BACKLOG-archive.md`.
Existing entries keep their IDs so old citations still resolve.

## Slicing Thresholds

| Metric | Threshold | Action |
|:---|:---|:---|
| Task Count | 15+ | Split into 2 slices |
| Wave Count | 8+ | Insert a hard gate for context reset |
| Complexity | 200+ points | Mandatory slicing |

## Standards
- **Success Metrics**: Numeric, verifiable. Forbidden: "Done", "Complete", "Working".
- **Interface-First**: For data-heavy tasks, Phase 1 MUST define the interface contract (Schema/JSON/Outline).
- **Minimalism**: If plan >4 phases, challenge — can phases merge?
- **Task Granularity**: Atomic (single session). Assigned agent. If >8 files, decompose.
- **Agent Assignment**: Per PROJECT_TYPE. If `manuscript`, coder is inactive.