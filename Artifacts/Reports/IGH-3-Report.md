# IGH-3 — Task-Graph Validator — Phase Report

**Verdict: PASS** · **Date:** 2026-07-27 · **Branch:** `phase-igh-3-task-graph-validator`
**Plan:** `Artifacts/Plans/IGH-3-Plan.md` · **Tasks:** `Artifacts/Plans/IGH-3-TODO.md`
**Evidence:** `Artifacts/Evidence/IGH-3/` (6 files)

**Verifier:** Opus, per `rules/common/model-routing.md` §Verification Tiering — this gate is
git-mutating and runs `deploy.sh` (irreversible), so it sits in the **high-rigor tier** where the
verifier re-runs mechanical checks itself rather than reviewing a narrative. Every metric below
was re-executed fresh at gate time; no claim rests on an executor summary.

---

## 1. The headline result — the plan's own framing was wrong by 12×

Step 0 recorded this phase as *"cheap insurance, not evidenced need"* at **n=1**. The grill
attacked that ROI hard and the framing survived, because hand-inspection was the only instrument
available at planning time.

The finished tool's first run against the repo returned **n=12**:

| Phase TODO | Redundant chain edges |
|:---|:---:|
| IGH-1 | 4 |
| **BLR-1** | **4** |
| RDT-1 | 2 |
| OXL-3 | 1 |
| OXL-1 | 1 |
| IGH-3, VSE-2 | 0 |
| **Total** | **12 across 5 of 7** |

**BLR-1 is a complete linear chain, structurally identical to IGH-1 — and it also passed a full
auditor gate.** The defect is the house pattern, not a one-off. Both plan and TODO were corrected
post-implementation; the original n=1 framing is preserved in `IGH-3-Plan.md` rather than
overwritten, because the 12× undercount *is* the argument for the checker existing.

**The grill's skepticism also held, and is recorded as such.** The two checks it called
speculative — cycle and unknown-blocker-ID — returned **zero** instances across all 7 live TODOs
and remain n=0 after the full run. They were kept on cost grounds (~5 lines each once the parse
exists), not evidence, and that judgement is unchanged by this result.

---

## 2. Success Metrics — 8/8 met

| # | Metric | Result | Evidence |
|:--|:---|:---|:---|
| M1 | Zero repo imports; zero write calls | **MET** — 6 imports, all stdlib (`__future__`, `dataclasses`, `pathlib`, `argparse`, `re`, `sys`); write-call count **0** | `igh3_t4_gate_verification.txt` |
| M2 | Presence control | **MET** — frozen fixture parses to **5 tasks / 4 edges**, ids `T1–T5`; all **7** live phase TODOs parse `> 0` (5, 5, 4, 9, 11, 6, 7) with no pinned counts | `igh3_t4_todograph_live.txt` |
| M3 | Cycle → exit 1 both IDs; `T99` → exit 1 named | **MET** — `dependency cycle: T1 -> T2 -> T1` exit 1; `UNKNOWN_BLOCKER — T2: Blocked by: T99` exit 1 | `igh3_t4_gate_verification.txt` |
| M4 | Frozen IGH-1 → exactly 4 advisories, exit 0 | **MET** — 4 advisories (`T2`, `T3`, `T4`, `T5`), **0 violations**, exit 0 | `igh3_t4_gate_verification.txt` |
| M5 | `/handoff` §7 wired; README registers | **MET** — `commands/handoff.md:74`; `scripts/README.md:277`. **Deployed copy at `~/.claude/commands/handoff.md` carries it** | `igh3_t4_deploy.txt` |
| M6 | `pytest -q` exit 0, ≥220 | **MET** — **256 passed, exit 0** (baseline 220, +36) | `igh3_t4_pytest_full.txt` |
| M7 | `deploy.sh` 6/6 | **MET** — exit 0, 6/6, "all 8 enforced hook(s) present and wired" | `igh3_t4_deploy.txt` |
| M8 | Auditor PASS on Logic, Style, Hard Rules | **MET** — §3, §4 | this report |

---

## 3. Hard Rules — 3/3 held

| # | Rule | Verification |
|:--|:---|:---|
| HR1 | **Read-only** — never edits, marks, or rotates a TODO | Static: zero `write_text(` / `unlink(` / `os.remove` / `shutil.` in source. Dynamic: `test_validate_never_mutates_the_file` compares `read_bytes()` before/after a full validate + format cycle. |
| HR2 | **No blind zeros** | Realized *in the tool*, not only in tests: `EMPTY_PARSE` is a VIOLATION when a non-empty TODO parses to zero tasks. Backed by `test_non_empty_file_with_no_tasks_is_a_violation` plus a control (`test_truly_empty_file_is_not_a_violation`) and `test_live_plans_dir_is_not_empty`, which stops the parametrised live-file test passing vacuously on an empty glob. |
| HR3 | **No scheduler** | `git status --porcelain` shows `commands/afk.md` and `scripts/deploy.sh` **absent from the changed set**. `Artifacts/Plans/IGH-1-TODO.md` likewise untouched — it is frozen as a fixture, not edited. |

---

## 4. Adversarial probes (beyond the plan's metrics)

IGH-1's T5 probe found a real allowlist-traversal bypass; the same discipline was applied here.

| Probe | Result |
|:---|:---|
| **Self-loop** (`T1 — Blocked by: T1`) | Caught — `dependency cycle: T1 -> T1`, exit 1. Not covered by the plan's metrics. |
| **Fenced task lines** — a `- [ ]` line inside a ``` block would be a false positive | Scanned all 7 live TODOs: **zero** fenced task lines. No false positive possible today; noted as a latent parser limitation. |
| **Unknown ID does not crash cycle detection** | `find_cycle` skips nodes absent from the graph; `unk-TODO.md` reports `UNKNOWN_BLOCKER` cleanly with no traceback. |
| **Advisory never changes exit code** | `cyc-TODO.md` carries both a VIOLATION and an ADVISORY → exit 1 from the violation alone; frozen IGH-1 carries 4 advisories and 0 violations → exit 0. |
| **`--violations-only` silence** | 0 bytes of output on the clean repo, exit 0 — safe for `/handoff` wiring. |

**Defect found during the phase:** one, in the *test* rather than the tool —
`test_source_has_zero_repo_imports` omitted `__future__` from its stdlib allowlist and failed on a
correct import. Fixed in the test; the tool was never wrong. Recorded because a green-on-first-run
claim would be false.

---

## 5. Dogfooding

IGH-3's own task graph was authored non-linear on purpose (T2 ∥ T3 fan-out, T4 fan-in) and
declares `Blocked by:` only where it diverges from list order. It validates **clean** against its
own checker — 4 tasks, 3 edges, zero findings. Under IGH-1's pattern three of its four tasks would
have carried a redundant clause.

---

## 6. Scope boundaries honoured

- **`/afk` untouched** (HR3) — the frontier stays model-computed. Revisit only after `/afk` runs
  real multi-task traversals; it has run **once**, on a single-task smoke (2026-07-10).
- **Deploy-policy debt filed, not absorbed** — `deploy.sh` excludes `scripts/`, making
  `todo_graph.py` the **third** stranded repo-local checker after `gate_telemetry.py` and
  `backlog_audit.py`. n=3 now meets IGH's own evidence bar and earns its own phase.
- **IGH-1 not edited** — its 12 sibling defects across the repo are reported, not fixed. Fixing
  them is a separate decision, and mutating closed audited phases is revisionism.

---

## 7. Follow-ups

| Item | Disposition |
|:---|:---|
| 12 redundant edges across 5 phase TODOs | **Reported, not fixed.** Advisory severity — no gate blocks on them. Fix forward when each phase is next touched. |
| Deploy-policy debt (n=3) | Earns its own phase. File to `BACKLOG.md` at `/handoff`. |
| Duplicate task IDs within one file | Known limitation, documented in the module docstring. Set-based resolution collapses duplicates silently. No instance observed. |
| Fenced task lines | Latent false-positive path; zero instances today. Not worth a guard until one appears. |
