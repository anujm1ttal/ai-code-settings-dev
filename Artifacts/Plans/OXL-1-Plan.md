# OXL-1 Plan — Work-Tracking & Planning Conventions + AFK Runner

**Initiative:** OXL — OS Cross-Learning (import proven patterns from mattpocock/skills + ralph)
**Phase:** 1 of 2 · **Branch:** `phase-oxl-1-conventions` · **Owner:** coder + strategist + scribe → auditor
**Step 0:** approved 2026-07-09 · **Grill:** [REFACTORED] 2026-07-09 (3 phases → 2)
**Grill-2:** [REFACTORED] 2026-07-10 — AFK runner folded in by user override (see DECISION_LOG [OXL] 2026-07-10)

## Goal

Make task dependencies and decomposition shape *mechanical* instead of judgment-based, make
task-completion commits carry their own handoff, and ship the **`/afk` runner** — the executable
path for the user's operating model: interactive planning → Opus orchestrator dispatches
Sonnet/Haiku subagents per task → orchestrator reviews each return → auditor gates each task →
user approves only HITL boundaries. Markdown-only phase — no hooks, no scripts, no executable code.

**First consumer (grill-2 evidence):** `my_mcp_rhino` backlog; maiden voyage after this phase's
in-repo smoke run.

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

### T5 — AFK/HITL task tag (orchestration.md) [AMENDED grill-2 — was "spec → BACKLOG"]
- Optional mode tag in the task format (alongside T1's fields): `AFK` (runner may auto-execute)
  or `HITL` (user approval required before execution).
- **Default-HITL rule**: an untagged task is HITL. Nothing auto-runs by omission (fail-safe).
- **Tagging authority**: strategist only, at planning time. No agent may retag at runtime.
- Enforcement line: `/afk` never dispatches a HITL or untagged task.
- The `oxl_afk-runner_1` BACKLOG entry is NOT created — its 6 design elements ship here (T5+T7).

### T7 — `commands/afk.md` runner procedure [NEW grill-2]
Markdown command, executed by the main session ("orchestrator"). Required content:
1. **Preconditions**: session model Opus-tier or above — **hard-stop** otherwise, instruct
   `/model opus`; approved plan + phase TODO exist; working tree committed or run aborts.
2. **Frontier**: next task where tag = `AFK` ∧ all `Blocked by:` are `[x]` ∧ status `[ ]`.
3. **Dispatch**: via Agent tool per agent model bindings (coder→Sonnet, scribe→Haiku, …),
   using implementation-dispatch templates + status codes (DONE/BLOCKED/…).
4. **Orchestrator review**: two-stage (Stage A spec / Stage B quality) on every return;
   FAIL → feedback + re-dispatch (fingerprint loop-detection: FREEZE at 3 identical dispatches).
5. **Auditor gate per task**: auditor subagent validates and marks `[x]`; audit output **appends
   a section to `Artifacts/Reports/afk-run-<date>.md`** (never overwrites `AUDIT_REPORT.md`).
6. **Commit**: task-completion commit per T4 after auditor PASS.
7. **Exits**: frontier empty ∧ all tasks `[x]` → done sentinel; frontier empty ∧ tasks remain →
   report which HITL/blocked tasks gate progress, pause for user (a HITL task is *never* in the
   frontier — this is the only correct pause semantics); iteration cap (default 10, arg-overridable);
   loop-detect FREEZE → escalate.
8. **TODO authority preserved**: orchestrator marks nothing; coder subagent marks `[-]`,
   auditor subagent marks `[x]`.

### T8 — Registry rows [NEW grill-2]
- `CLAUDE-global.md` Commands table: `/afk` row (owner: coder dispatch / auditor gates).
- `cheatsheet.md` entry. `/registry-audit` must pass post-edit.

### T9 — Live-fire smoke run [NEW grill-2]
- After deploy (`bash scripts/deploy.sh`), run `/afk` against a 1-task sandbox TODO
  (trivial `AFK`-tagged doc task under `Artifacts/Temp/afk-smoke/`).
- Must complete one full iteration end-to-end: dispatch → orchestrator review → auditor gate →
  commit; then `python scripts/model_routing_audit.py --violations-only` clean — proving the
  Agent tool honors model bindings at runtime (the load-bearing claim).
- Cleanup of sandbox via `/clean` after evidence captured in the run-report.

## Success Metrics (numeric)
1. orchestration.md task-format spec shows optional `Tn:` + `Blocked by:` with 1 worked example
   and the auditor-enforcement line; grep confirms `[ ]/[-]/[x]` semantics text unchanged.
2. implementation-dispatch independence rule references `Blocked by:` (grep hit ≥1).
3. project-planner contains the 3-criterion slice test + expand–contract exception.
4. orchestration.md §Git Phase Branching carries the commit-as-handoff rule with the
   trivial-commit exemption explicit.
5. orchestration.md tag spec: `AFK`/`HITL` optional, default-HITL line, strategist-only line,
   `/afk`-enforcement line (grep confirms all 4).
6. `commands/afk.md` exists with all 8 §T7 elements (spot-grep: hard-stop, frontier, run-report
   path, iteration cap, empty-frontier pause).
7. `/afk` row present in CLAUDE-global.md Commands table AND cheatsheet.md.
8. Live-fire evidence: `Artifacts/Reports/afk-run-<date>.md` shows 1 completed iteration
   (dispatch, review verdict, auditor PASS, commit hash); routing audit clean **scoped to the
   run date** (`model_routing_audit.py --since 2026-07-10 --violations-only` → 0 violations).
   [AMENDED during T9: unscoped audit surfaced 21 pre-existing violations from historical
   sessions — real finding, filed as `oxl_routing-violations_1` in BACKLOG.md; they predate
   this phase and cannot be remediated by it.]
9. `bash scripts/deploy.sh` exits 0 (6-step validation incl. pytest).

## Hard Rules (auditor rejects on violation)
1. New fields/tags OPTIONAL everywhere — no task is invalid for lacking them; zero change to
   `[ ]`/`[-]`/`[x]` status semantics or TODO-authority assignments.
2. [AMENDED grill-2] No **executable** runner code ships — no scripts, hooks, or JS/bash;
   `commands/afk.md` is markdown procedure only. (Supersedes "no runner ships" — user override
   2026-07-10, DECISION_LOG [OXL].)
3. Doc-only blast radius: edits confined to the files named in T1–T8; smoke-run writes confined
   to `Artifacts/Temp/afk-smoke/` + `Artifacts/Reports/`.
4. `/afk` never dispatches a HITL or untagged task; untagged defaults to HITL.
