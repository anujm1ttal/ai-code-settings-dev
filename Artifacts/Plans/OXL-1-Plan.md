# OXL-1 Plan — Work-Tracking & Planning Conventions

**Initiative:** OXL — OS Cross-Learning (import proven patterns from mattpocock/skills + ralph)
**Phase:** 1 of 2 · **Branch:** `phase-oxl-1-conventions` · **Owner:** coder + strategist → auditor
**Step 0:** approved 2026-07-09 · **Grill:** [REFACTORED] 2026-07-09 (3 phases → 2; see DECISION_LOG [OXL])

## Goal

Make task dependencies and decomposition shape *mechanical* instead of judgment-based, and make
task-completion commits carry their own handoff. Doc-only phase — rules/skills/commands markdown
plus one BACKLOG entry. No hooks, no scripts, no runner.

## Technical Spec

### T1 — `Blocked by:` field (orchestration.md)
- Extend task format in §Artifacts/TODO.md Authority:
  `[ ] [agent] Tn: Task description — Success: metric — Blocked by: Tm[, Tk]`
- Both `Tn:` ID and `Blocked by:` are **OPTIONAL**; a task without them is fully valid.
  IDs are phase-local (T1..Tn in Phase-N-TODO.md), matching existing VSE convention.
- One worked example in the format spec.
- Auditor enforcement line: a task must not be marked `[-]` while any listed blocker is not `[x]`.
- Explicit note: a linear chain (T2←T1, T3←T2…) adds nothing over list order — omit `Blocked by:`
  there (no-op anti-pattern); use it only where the graph diverges from list order.

### T2 — Parallel-dispatch independence (implementation-dispatch SKILL.md)
- Independence test cites `Blocked by:`: tasks are parallel-dispatchable when neither transitively
  blocks the other AND no shared-file conflict. Keeps the existing 3+-tasks trigger.

### T3 — Vertical-slice + expand–contract rules (project-planner SKILL.md)
- Slice sizing test (3 criteria): cuts a complete path through every affected layer; independently
  demoable/verifiable; fits one context window (one session).
- Exception: wide refactors are NOT vertically sliced — sequence as expand–contract
  (introduce new form alongside old → migrate call sites in batches → delete old form).

### T4 — Commit-as-handoff (orchestration.md §Git Phase Branching)
- Positive-form rule scoped to **task-completion commits** (a commit that finishes a TODO task):
  body carries key decisions made + blockers/notes for the next iteration.
  Trivial/intermediate commits exempt. Rationale: crash recovery between /handoffs; the git log
  becomes a self-maintaining brief that cannot drift (ralph pattern, scoped to our gap).

### T5 — AFK-runner spec → BACKLOG (`oxl_afk-runner_1`)
- Spec-only entry (user ruling 2026-07-09): AFK/HITL task tag definition; frontier = AFK ∧ unblocked
  (consumes T1's `Blocked by:`); harness = native /loop or Workflow, NOT bash+jq; auditor gate
  required per iteration (ralph's tests-only bar is below OS bar); exit sentinel; iteration cap.
- Revival trigger: a real AFK-eligible backlog exists (≥5 tagged-able tasks) AND user opts in.

## Success Metrics (numeric)
1. orchestration.md task-format spec shows optional `Tn:` + `Blocked by:` with 1 worked example
   and the auditor-enforcement line; grep confirms `[ ]/[-]/[x]` semantics text unchanged.
2. implementation-dispatch independence rule references `Blocked by:` (grep hit ≥1).
3. project-planner contains the 3-criterion slice test + expand–contract exception.
4. `Artifacts/BACKLOG.md` gains `oxl_afk-runner_1` with all 6 design elements above.
5. `bash scripts/deploy.sh` exits 0 (6-step validation incl. pytest).

## Hard Rules (auditor rejects on violation)
1. New fields OPTIONAL everywhere — no task is invalid for lacking them; zero change to
   `[ ]`/`[-]`/`[x]` status semantics or TODO-authority assignments.
2. No runner code, hook, or script ships — T5 is spec text only.
3. Doc-only blast radius: edits confined to the files named in T1–T4 + BACKLOG.md.
