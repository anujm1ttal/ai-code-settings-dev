# IGH-3: Task-Graph Validator

**Initiative:** IGH — Insights-Guided Hardening · **Type:** `code` · **Owner:** strategist → coder → auditor
**Step 0 approved:** 2026-07-26 · **Grill:** [REFACTORED] 2026-07-26 · **Branch:** `phase-igh-3-task-graph-validator`
**Origin:** A conversation about graph engineering surfaced that the `Blocked by:` / `Mode:` grammar
is defined in `orchestration.md`, consumed by `afk.md` §2, and checked by nothing.

---

## Objectives

Make the task-dependency grammar mechanically checkable, per IGH's governing principle:
**prefer a checker over a rule.**

Scope is deliberately small, and smaller than the Step 0 draft — the grill cut ~40%. This phase
ships a read-only reporter with one confirmed live hit and three cheap structural checks. It does
**not** ship a scheduler.

---

## Evidence and its limits (stated honestly)

**Framing corrected post-implementation.** Step 0 and the grill both recorded this as
"cheap insurance, not evidenced need" at **n=1** — the only figure hand-inspection could
produce. The finished tool's first run against the repo returned **n=12**. The original
framing is preserved below rather than quietly overwritten, because the correction is the
point: hand-inspection undercounted the defect by 12×, which is the argument for the
checker existing.

| Claim | Status |
|:---|:---|
| `grep -rln "Blocked by" scripts/ hooks/ tests/` → **zero matches** — grammar checked by nothing | verified |
| Redundant chain edges — **12 across 5 of 7 phase TODOs** (IGH-1 ×4, BLR-1 ×4, RDT-1 ×2, OXL-1 ×1, OXL-3 ×1) | **n=12, confirmed by first tool run** — Step 0 estimated n=1 |
| **BLR-1 is a complete linear chain, identical to IGH-1** — and it also passed a full auditor gate | the defect is the house pattern, not a one-off |
| Cycles, unknown blocker IDs | **n=0, and still n=0 after the first full run** — the grill's skepticism on these held; kept only because they cost ~5 lines each once the parse exists |
| `/afk` has executed **once** (`Reports/afk-run-2026-07-10.md`), on a **single-task** smoke (OXL-1 S1) | verified — the multi-task frontier this protects has never actually run |
| IGH-3's own graph | **clean** — the dogfooded non-linear structure validates against its own checker |

**Retracted during grill.** The Step 0 draft cited "17 untagged tasks" as evidence of invisible
walls to `/afk`. Recount against **open** tasks only: OXL-3 5 open / 0 untagged, RDT-1 1 open / 0
untagged, all others 0 open. Every untagged task is in a **closed** phase. The live graph is
**6 open tasks, 100% tagged**. The number was counting dead work.

**Consequence of the retraction:** frontier / AFK-reach reporting was cut entirely. It was
justified solely by that number, and with six correctly-tagged open tasks there is nothing to
report.

---

## Grill dispositions (four attacks)

| # | Attack | Disposition |
|:--|:---|:---|
| 1 | VALUE_ROI cited untagged tasks from closed phases | **Retracted.** AFK-reach reporting cut. |
| 2 | **No invocation point.** All 6 sibling scripts have automatic callers (`gate_telemetry`→`/handoff` §6, `backlog_audit`→`/handoff` §7, `verify_hook_wiring`→`deploy.sh:181`); this one had none. A checker with no caller automates nothing — Deletion Test failure on day one. | **Fixed.** T3 wires `/handoff` §7 with the identical proven graceful-skip pattern. Does **not** touch `/afk`. |
| 3 | `/afk` run once, on one task — infrastructure for a barely-exercised mechanism | **Accepted as a limit.** Recorded above; not argued away. |
| 4 | Third script to hit the `deploy.sh` excludes `scripts/` wall (`lh3_telemetry-deploy_1`, BLR-1, now this) — stranded repo-local, never reaches `my_mcp_rhino` or `parametric-stadium-bowl-system` | **Out of scope, filed.** n=3 now meets IGH's own evidence bar; the deploy-policy fix has earned its own phase. Not this one. |

---

## A grammar gap found while designing this

`Blocked by:` cannot distinguish *"no dependency"* from *"depends on list-order predecessor."*
Omitting it means the model infers list order, so **"T3 needs T1 but not T2" cannot be expressed
by omission** — it requires an explicit `Blocked by: T1`.

The rule "omit on linear chains" is therefore correct only when the true dependency *matches* list
order. This phase's own task graph uses that distinction deliberately (see IGH-3-TODO.md): T3
declares `Blocked by: T1` because it diverges from list order; T2 and T4 omit it because list
order already carries them.

---

## Task Detail

### T1 — `scripts/todo_graph.py`

Single file, stdlib-only, **zero repo imports**, read-only — the contract `backlog_audit.py`
already establishes. Exit 0 clean / 1 on structural violation (CI-usable).

**Parse**: one `Task` frozen dataclass per `- [ |-|x] [agent] Tn: … — Mode: … — Blocked by: …`
line. `Tn:` and both trailing tags are optional; a task without them is fully valid.

**Checks:**

| Check | Severity | Exit |
|:---|:---|:---:|
| Cycle in the blocker graph | violation | 1 |
| `Blocked by:` names an ID absent from the file | violation | 1 |
| Malformed status marker or missing `[agent]` field | violation | 1 |
| **Redundant chain edge** | advisory | 0 |

**Redundant-edge definition (tight, to avoid false positives):** a task's blocker set is exactly
`{immediately preceding task in list order}`. Nothing else counts. A task blocked by a
non-adjacent predecessor, or by two or more tasks, is never flagged — those are the cases where
the graph genuinely diverges from list order.

Advisories never change the exit code. Flag: `--violations-only`, matching `backlog_audit.py`.

### T2 — Tests + frozen fixture

`tests/test_todo_graph.py` plus `tests/fixtures/igh1-todo-frozen.md` — a byte-copy of
`IGH-1-TODO.md` as it merged.

**IGH-1's four redundant edges are not fixed.** IGH-1 is merged, audited, and closed; editing a
closed phase's artifact is revisionism. Frozen, it is the real-world regression proof that the
checker catches a real miss.

**Presence control (HR2).** Synthetic-fixture assertions pin exact counts. Live phase TODOs get a
`> 0` smoke assert only — never pinned numbers, because those files change as work proceeds. A
parse returning 0 tasks on a non-empty TODO must fail, not pass.

### T3 — Wire `/handoff` §7 + register

One line in `commands/handoff.md` §7 Hygiene, beside the BACKLOG rotation check, using the
established pattern verbatim:

```
test -f scripts/todo_graph.py && python scripts/todo_graph.py --violations-only
```

Repo-relative forward-slash path — a Windows backslash absolute path silently collapses in the
Bash tool (`coding-style.md` §Windows Shell & Paths). Skip the sub-step when absent, exactly as
steps 6 and 7 already handle `gate_telemetry.py` and `backlog_audit.py`.

Register a `## todo_graph.py` section in `scripts/README.md`, matching the existing sections.

---

## File Changes

| File | Change |
|:---|:---|
| `scripts/todo_graph.py` | **NEW** — parser + 4 checks + CLI, stdlib-only, read-only |
| `tests/test_todo_graph.py` | **NEW** — parser, checks, exit codes, presence control |
| `tests/fixtures/igh1-todo-frozen.md` | **NEW** — frozen IGH-1 regression fixture |
| `commands/handoff.md` | §7 Hygiene — one graceful-skip line |
| `scripts/README.md` | register the tool |

**Not touched:** `commands/afk.md`, `scripts/deploy.sh`, `Artifacts/Plans/IGH-1-TODO.md`.

---

## Dependencies

**Prerequisites:** none. IGH-1 closed and merged (`d5f2a2f`, auditor PASS).
**Enablements:** none. IGH-2 is independent and may run before or after.

---

## Hard Rules (Auditor Rejects on Violation)

1. **Read-only.** The tool never edits, marks, or rotates any TODO file. TODO Authority
   (`orchestration.md`) is untouched — no script may mark `[-]` or `[x]`.
2. **No blind zeros.** Presence control is mandatory. A parse returning 0 tasks against a
   non-empty TODO is a failure, not a clean pass (`testing-strategy.md` §Oracle Discipline).
3. **No scheduler.** `commands/afk.md` is not modified in this phase and nothing dispatches off
   this script. It reports; humans and the existing `/afk` procedure decide.

---

## Success Metrics

- [ ] M1: `scripts/todo_graph.py` — **zero repo imports** (stdlib only) and **zero write calls**
      (no `open(...,'w')`, no `write_text`, no `unlink`)
- [ ] M2: Presence control — synthetic fixtures return pinned counts; the frozen IGH-1 fixture
      parses to **5 tasks / 4 dependency edges**; each of the 6 live phase TODOs parses to **> 0**
      tasks (no pinned numbers)
- [ ] M3: Cyclic fixture → **exit 1**, both IDs named in the output; `Blocked by: T99` fixture →
      **exit 1**, `T99` named
- [ ] M4: Frozen IGH-1 fixture → exactly **4** redundant-edge advisories (T2, T3, T4, T5) **and
      exit 0** — advisories never change the exit code
- [ ] M5: `commands/handoff.md` §7 carries the graceful-skip line; `scripts/README.md` registers
      the tool
- [ ] M6: `python -m pytest tests/ -q` → **exit 0**, ≥ 220 passing (current baseline 220)
- [ ] M7: `bash scripts/deploy.sh` → **6/6** validation pass (proves no regression; `scripts/` is
      not deployed)
- [ ] M8: Auditor PASS on Logic, Style, and all 3 Hard Rules
