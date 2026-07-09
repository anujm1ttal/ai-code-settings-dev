# OXL-1 TODO — Work-Tracking & Planning Conventions

**Branch:** `phase-oxl-1-conventions` · **Plan:** `Artifacts/Plans/OXL-1-Plan.md`

- [ ] [coder] T1: `Blocked by:` + optional `Tn:` ID in orchestration.md task format — Success: Plan §T1 items all present (example, auditor line, no-op note); status semantics untouched
- [ ] [coder] T2: implementation-dispatch independence rule cites `Blocked by:` — Success: grep hit ≥1; 3+-task trigger preserved
- [ ] [coder] T3: vertical-slice test + expand–contract exception in project-planner — Success: 3 criteria + exception present
- [ ] [coder] T4: commit-as-handoff rule (task-completion commits) in orchestration.md §Git Phase Branching — Success: positive-form rule, trivial-commit exemption explicit
- [ ] [strategist] T5: author `oxl_afk-runner_1` BACKLOG spec — Success: 6 design elements (tag def, frontier rule, native harness, auditor gate, exit sentinel, iteration cap) + revival trigger — Blocked by: T1
- [ ] [auditor] T6: phase gate — Success: all 5 plan metrics verified fresh; deploy.sh exit 0 — Blocked by: T1, T2, T3, T4, T5
