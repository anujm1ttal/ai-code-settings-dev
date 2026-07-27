# IGH-3 — Phase TODO

**Plan:** `Artifacts/Plans/IGH-3-Plan.md` · **Branch:** `phase-igh-3-task-graph-validator`
**Step 0:** approved 2026-07-26 · **Grill:** [REFACTORED] 2026-07-26

Status: `[ ]` not started · `[-]` in progress (coder) · `[x]` auditor-verified complete

---

- [x] [coder] T1: `scripts/todo_graph.py` — stdlib-only, zero repo imports, read-only parser for the `- [ ] [agent] Tn: … — Mode: … — Blocked by: …` grammar + 4 checks (cycle, unknown blocker ID, malformed task line, redundant-chain advisory); `--violations-only` flag matching `backlog_audit.py`; advisories never change the exit code — Success: zero repo imports and zero write calls; exit 1 on cycle / unknown ID / malformed, exit 0 clean; redundant-edge rule fires only when a task's blocker set is exactly `{immediately preceding task}` — Mode: AFK

- [x] [coder] T2: `tests/test_todo_graph.py` + `tests/fixtures/igh1-todo-frozen.md` (byte-copy of IGH-1-TODO.md as merged; **IGH-1 itself is not edited**) — synthetic fixtures for cycle / unknown-ID / malformed; presence control per HR2 — Success: frozen fixture parses to **5 tasks / 4 edges** and yields exactly **4** redundant-edge advisories (T2–T5) with **exit 0**; cyclic fixture exit 1 naming both IDs; `T99` fixture exit 1 naming T99; each of the 6 live phase TODOs asserts **> 0** tasks with no pinned counts — Mode: AFK

- [x] [coder] T3: Wire + register — one graceful-skip line in `commands/handoff.md` §7 Hygiene (`test -f scripts/todo_graph.py && python scripts/todo_graph.py --violations-only`, repo-relative forward-slash path) beside the BACKLOG rotation check; add a `## todo_graph.py` section to `scripts/README.md` — Success: §7 carries the line in the established pattern; README section present; `commands/afk.md` and `scripts/deploy.sh` unmodified (HR3) — Mode: AFK — Blocked by: T1

- [x] [auditor] T4: Phase gate — verify M1–M8 and all 3 Hard Rules against raw artifacts; write `Artifacts/Reports/IGH-3-Report.md` — Success: auditor PASS; `python -m pytest tests/ -q` exit 0 with ≥220 passing; `bash scripts/deploy.sh` 6/6 — Mode: HITL — Blocked by: T2, T3

---

## Dogfooding note

This phase's own graph is non-linear on purpose, and declares dependencies only where they earn
their place — the rule T1 implements:

```
        T1 parser
         │      │
    T2 ◄─┘      └─► T3          T2 (tests) and T3 (wiring) both need only T1
  tests+fixture   wire+register
         │      │
         └► T4 ◄┘               auditor gate — genuine fan-in
```

- **T2** omits `Blocked by:` — list order already carries T1.
- **T3** declares `Blocked by: T1` — it **diverges** from list order (it does not need T2). This is
  the case the grammar cannot express by omission; see IGH-3-Plan.md §Grammar gap.
- **T4** declares `Blocked by: T2, T3` — genuine fan-in, not implied by list order.

Under IGH-1's pattern all four tasks would have carried a `Blocked by:` clause; three of those
would have been redundant.

## Hard Rules (auditor rejects on violation)

1. **Read-only** — the tool never edits, marks, or rotates any TODO file. No script marks `[-]`
   or `[x]`; TODO Authority is untouched.
2. **No blind zeros** — presence control mandatory. A parse returning 0 tasks against a non-empty
   TODO is a failure, not a clean pass.
3. **No scheduler** — `commands/afk.md` unmodified; nothing dispatches off this script.

## Irreversible actions (stop-and-surface — user approval required)

- `bash scripts/deploy.sh` — overwrites `~/.claude/`
- `git commit` / `git push` / merge to `main`

## Out of scope (filed, not done)

- **Deploy-policy debt (n=3).** `deploy.sh` excludes `scripts/`, stranding `gate_telemetry.py`,
  `backlog_audit.py`, and now `todo_graph.py` as repo-local. Third instance of
  `lh3_telemetry-deploy_1`. Meets IGH's own n≥3 bar — earns its own phase, not this one.
- **`/afk` frontier wiring.** Deliberately excluded (HR3). Revisit only after `/afk` runs real
  multi-task traversals; it has run once, on a single task.
