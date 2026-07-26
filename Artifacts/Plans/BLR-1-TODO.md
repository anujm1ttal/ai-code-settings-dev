# BLR-1 — Phase TODO

**Plan:** `Artifacts/Plans/BLR-1-Plan.md` · **Branch:** `phase-blr-1-backlog-lifecycle`
**Step 0:** approved 2026-07-26 · **Grill:** [REFACTORED] 2026-07-26

Status: `[ ]` not started · `[-]` in progress (coder) · `[x]` auditor-verified complete

---

- [ ] [coder] T1: BACKLOG contract in `orchestration.md` — persistence-table row + new §BACKLOG Lifecycle stating memory-not-queue, stable ID + `OPEN`/`RESOLVED` marker, project-local grouping unconstrained — Success: section ≤20 lines; status-marker requirement present; grouping explicitly left open — Mode: AFK

- [ ] [coder] T2: Rotation rule (same §) — >250 lines OR >20 entries → oldest RESOLVED to `Artifacts/History/BACKLOG-archive.md`, prepend newest-first, never delete, OPEN never rotates, forward-pointer, owner concierge@/handoff + manual /clean, plus the 1-line eviction clause — Success: threshold numeric; archive path named; never-delete + OPEN-never-rotates both present — Mode: AFK — Blocked by: T1

- [ ] [coder] T3: `scripts/backlog_audit.py` + `tests/test_backlog_audit.py` + `/handoff` wiring — 4 checks (unrotated RESOLVED, missing status marker, size-vs-threshold, per-phase-dump headings), `--violations-only`, read-only — Success: zero repo imports; exit 1 on violation / 0 clean; handoff.md uses the `gate_telemetry.py` graceful-skip pattern; new tests pass — Mode: AFK — Blocked by: T2

- [ ] [coder] T4: Dogfood migration of `Artifacts/BACKLOG.md` — rotate the 7 RESOLVED entries (`lh3_gate-log_1`, `vse1_palette_1`, `vse1_templates_1`, `osh_hooks-gaps_1..4`, `osa_model-routing_1`, `osa_plugin-docs_2`, `osa_plugin-scope_3`) to the archive; add status markers to the 11 OPEN entries — Success: active file ≤200 lines / ≤12 entries; 7 entries in archive; 0 RESOLVED remaining; `backlog_audit.py` exit 0 — Mode: AFK — Blocked by: T3

- [ ] [auditor] T5: Phase gate — verify M1–M7, all 3 Hard Rules, write `Artifacts/Reports/BLR-1-Report.md` — Success: auditor PASS; `pytest tests/ -q` exit 0; `deploy.sh` 6/6 — Mode: HITL — Blocked by: T4

---

## Hard Rules (auditor rejects on violation)

1. No BACKLOG outside this repo is touched — `my_mcp_rhino` and all other projects untouched.
2. Rotation never deletes — archive append-only; OPEN entries never rotate.
3. `backlog_audit.py` reports, never edits — no auto-rotation.

## Irreversible actions (stop-and-surface — user approval required)

- `bash scripts/deploy.sh` — overwrites `~/.claude/`
- `git commit` / `git push` / merge to `main`
