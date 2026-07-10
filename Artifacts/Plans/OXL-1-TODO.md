# OXL-1 TODO — Work-Tracking & Planning Conventions

**Branch:** `phase-oxl-1-conventions` · **Plan:** `Artifacts/Plans/OXL-1-Plan.md`

- [x] [coder] T1: `Blocked by:` + optional `Tn:` ID in orchestration.md task format — Success: Plan §T1 items all present (example, auditor line, no-op note); status semantics untouched
- [x] [coder] T2: implementation-dispatch independence rule cites `Blocked by:` — Success: grep hit ≥1; 3+-task trigger preserved
- [x] [coder] T3: vertical-slice test + expand–contract exception in project-planner — Success: 3 criteria + exception present
- [x] [coder] T4: commit-as-handoff rule (task-completion commits) in orchestration.md §Git Phase Branching — Success: positive-form rule, trivial-commit exemption explicit
- [x] [strategist] T5: AFK/HITL tag spec in orchestration.md task format (AMENDED grill-2 — supersedes BACKLOG deferral) — Success: tag optional; default-HITL rule; strategist-only tagging; `/afk`-enforcement line — Blocked by: T1
- [x] [coder] T7: `commands/afk.md` runner procedure — Success: all 8 Plan §T7 elements (Opus hard-stop, frontier, run-report append, iteration cap 10, empty-frontier pause, TODO-authority preservation) — Blocked by: T2, T4, T5
- [x] [scribe] T8: registry rows — Success: `/afk` in CLAUDE-global.md Commands table + cheatsheet.md; registry-audit clean — Blocked by: T7
- [x] [coder] T9: live-fire smoke run — Success: 1 `/afk` iteration end-to-end on sandbox task (run-report + commit hash); `model_routing_audit.py --violations-only` clean — Blocked by: T7, T8
- [x] [auditor] T6: phase gate — Success: all 9 plan metrics verified fresh; deploy.sh exit 0 — Blocked by: T1, T2, T3, T4, T5, T7, T8, T9
