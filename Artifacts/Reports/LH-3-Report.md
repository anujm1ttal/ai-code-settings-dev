# LH-3 Report — Deploy-Guard + Telemetry + Doc-Sync (Initiative-Terminal)

**Phase:** LH-3 (terminal) · **Branch:** `phase-lh-3-telemetry-prose` (merged fast-forward to
`main`, deleted) · **Commits:** `99ae67b` (phase) + `2cee6eb` (post-PASS deploy.sh fix) ·
**Deployed:** 2026-07-08 · **Gate:** auditor, 1-pass PASS + post-PASS verification of 3
strategist-landed changes · **Status:** **SHIPPED**
**Full findings:** `Artifacts/AUDIT_REPORT.md`

## Summary

All 8 audit gates cleared on first pass with independent, adversarial verification — not
acceptance of the coder's/scribe's self-reported completion. T1a (`hooks/lib/gate-log.js`), T1b
(call-site instrumentation in all 5 target hooks), T1c (`scripts/gate_telemetry.py`), T1d
(`commands/handoff.md` telemetry step), T2a (`hooks/enforced-rules.json`), T2b (`deploy.sh` guard
+ `scripts/verify_hook_wiring.py`), T3 (scribe doc-sync), and T5 (test suite) were all
implemented and held under independent re-testing. The 1st-pass MEDIUM finding
(`lh3_gate-log_1`) was fixed post-PASS by the strategist/coder and independently re-verified by
the auditor — both against repo source and the deployed `~/.claude/hooks/lib/gate-log.js` — before
close.

## Metrics Status (per `Plans/LH-3-Plan.md` §Success Metrics)

| # | Metric | Status |
|:--|:--|:--:|
| M1 | Deploy FAILs (non-zero, names the rule) when a manifest hook is absent or unreferenced | **Met** — simulated both failure shapes (missing file, unwired entry) against real hooks dir/live settings.json; both FAIL non-zero and name the exact `rule_id` |
| M2 | `gate_telemetry.py` produces correct per-hook deny/nag counts on a fixture; `/handoff` includes the table | **Met** — verified against an auditor-built fixture, full table + `--since` + `--json` all correct; `commands/handoff.md` step confirmed, plus post-PASS graceful skip-if-absent guard verified (§Post-PASS Verification 2) |
| M3 | `CLAUDE-global.md` hooks table accurately describes all 7 deployed hooks | **Met** — table has 7 rows (was 5); `auto-lint.js` description corrected, `nudge-handoff.js`/`evidence-gate.js` rows added |
| M4 | Every instrumented hook fails open on forced crash; gate-logging disabled leaves decision/exit code byte-identical | **Met** — verified with a strictly stronger adversarial condition (module-load-time throw) than the coder's own function-call-throw test fixture, across all 5 hooks; strengthened post-PASS by the null-arg fix (§Post-PASS Verification 1) |
| M5 | `pytest tests/ -v` exit 0; `deploy.sh` passes its own new guard end-to-end | **Met** — `python -m pytest tests/ -v` → 105 passed, exit 0 (post-fix count; was 103 pre-fix). `deploy.sh` now invokes `python -m pytest` (not the bare launcher, §Post-PASS Verification 3) and ran end-to-end in production: hook-wiring guard reported `OK: all 7 enforced hook(s) present and wired` on its first live run |

## Audit History (1-pass gate + post-PASS verification)

**1st pass (pre-ship):** PASS on all 8 gates, no fix cycle required for the phase's core
deliverables. Independent verification performed beyond reading the coder's/scribe's own test
suite:

1. **Adversarial fail-open probe** (Gate 1): built a copy of `hooks/` with `lib/gate-log.js`
   replaced by a file that throws at `require()`-time (stronger than the coder's fixture, which
   throws inside the exported function). Ran all 5 instrumented hooks against both the real and
   adversarial copies with fire-triggering inputs; `stdout` and exit code were byte-identical in
   every case.
2. **Direct `logGateEvent()` fuzzing**: called the exported function directly with `undefined`,
   `null`, `{}`, and objects with wrong-typed fields. Found one real (non-live) defect —
   `logGateEvent(null)` threw before the module's own internal `try/catch` ran, contradicting its
   "never throws" docstring claim. Confirmed no call site was affected at the time (all pass
   populated object literals; the call-site `logGateSafe` wrapper independently catches it
   regardless). Filed as `lh3_gate-log_1` (MEDIUM) to `Artifacts/BACKLOG.md` — strategist ruled
   fix-now rather than defer (see §Post-PASS Verification 1).
3. **Deploy-guard exercised against production, not just fixtures** (Gate 3): ran
   `scripts/verify_hook_wiring.py` against the actual `~/.claude/settings.json` on this machine
   (OK, all 7 wired) and against two hand-built regression scenarios copied from the real deployed
   hooks/settings (a deleted hook file, a stripped settings entry) — both FAIL, naming the correct
   `rule_id`.
4. **Independent telemetry fixture** (Gate 5): built a 5-event, 3-hook fixture from scratch (not
   the coder's `FIXTURE_EVENTS`) with deliberately overlapping/boundary timestamps to stress
   `--since` filtering; all counts and `last_fired` values matched hand-computed expectations.
5. **`rules/` tree diff** (Gate 6): `git diff --stat HEAD -- rules/` returned empty, confirming
   zero rule-prose deletions this phase (Hard Rule 3).
6. **Break-then-restore regression proof** (Gate 7): intentionally broke
   `verify_hook_wiring.py`'s failure-message rule-naming, confirmed the exact test
   (`test_missing_hook_file_fails_naming_rule`) fails with a legible diff, then restored the file
   byte-for-byte.
7. **Environment note surfaced, not swallowed:** `pytest tests/ -v` invoked via the bare
   `pytest.exe` PATH launcher reproducibly failed 3 of 103 tests with `OSError: [WinError 6] The
   handle is invalid` — isolated as a Windows subprocess-handle-inheritance quirk specific to that
   launcher binary, not a code regression (same 3 tests passed in isolation and under
   `python -m pytest`). This observation directly informed Post-PASS Verification 3 below, once
   the same quirk turned out to abort the real production deploy.

**Post-PASS verification (this pass):** the strategist reported 3 changes landed after the PASS
verdict, shipped in commits `99ae67b`/`2cee6eb`. Per Verification Discipline, none were accepted
on the strategist's word alone — each was independently re-derived:

1. **`lh3_gate-log_1` fix (MEDIUM → resolved).** Read `hooks/lib/gate-log.js`: the destructuring
   `const { hook, event, decision, tool, ruleId, cwd } = params || {}` now sits **inside** the
   `try` block (was previously in the function signature, outside protection). Independently
   re-ran the exact fuzz set from the 1st pass (`null`, `undefined`, `42`, `'str'`, `[]`, `{}`,
   wrong-typed fields) directly against `logGateEvent` — zero throws, confirming the fix. Went
   further than repo source: ran the identical `null`-arg probe against the **deployed**
   `~/.claude/hooks/lib/gate-log.js` (not just the repo copy) — no-throw confirmed live. Verified
   2 new regression tests exist in `tests/test_gate_log.py`
   (`test_log_gate_event_tolerates_null_undefined_and_non_object_args`,
   `test_log_gate_event_null_arg_still_calling_convention_no_arg_safe`). Confirmed
   `Artifacts/BACKLOG.md`'s `lh3_gate-log_1` entry is correctly marked RESOLVED with an accurate
   resolution description, not just deleted. **Verdict: fix confirmed correct and complete.**
2. **Graceful telemetry step.** Read `commands/handoff.md`'s step 6: it now conditions the
   `gate_telemetry.py` invocation on the script existing in the workspace
   (`scripts/` is not part of `deploy.sh`'s deployed-item set — confirmed by inspecting the live
   `~/.claude/scripts/` directory, which contains only `model_routing_audit.py`, no
   `gate_telemetry.py`), and explicitly states hooks still log everywhere even where the reader is
   absent. No original coverage was cut — the sub-step still runs and produces the table
   wherever the script is present (i.e., inside this repo); it now additionally degrades
   gracefully rather than erroring in every other project. **Verdict: confirmed graceful, no
   coverage cut.**
3. **`deploy.sh` `python -m pytest` fix.** Read the STEP 2 diff: `pytest ...` → `python -m pytest
   ...`, with an inline comment naming the exact WinError-6 launcher quirk. Independently
   re-confirmed this is a genuine environment-artifact fix, not a masking of a real failure, by
   running **both** invocation styles against the current (post-fix) test suite: `python -m
   pytest tests/ -v` → 105 passed, exit 0; bare `pytest tests/ -v` → 5 of 105 failed, all with the
   identical `OSError: [WinError 6] The handle is invalid` signature (3 from
   `test_deploy_guard.py`, now 2 more from the new `test_gate_log.py` null-arg tests — the same
   launcher artifact extending to the newly-added subprocess-spawning tests, not a new class of
   failure). Both invocations exercise the exact same test collection and assertions; only the
   process-spawn mechanism differs. **Verdict: correct robustness fix — the underlying test logic
   is unchanged and still fully enforced; only the flaky launcher was swapped out.**

## Deploy + Live-Wiring Evidence

Deploy was performed by the strategist/coordinator after the PASS verdict and the 3 post-PASS
fixes, not by the auditor. All of the following was **independently re-verified by the auditor
post-deploy** — not accepted from the deploy-completion claim alone:

- `git log --oneline -3` on `main`: HEAD at `2cee6eb`, directly following `99ae67b`, directly
  following `920577e` (LH-2 close) — linear history, no merge commit (fast-forward). `git branch
  -a` confirms `phase-lh-3-telemetry-prose` no longer exists.
- `git show --stat` on both commits: `99ae67b` carries the full phase diff (hooks, scripts,
  tests, doc-sync, plan/decision-log updates); `2cee6eb` is a minimal 1-file, 8-line diff scoped
  exactly to the `deploy.sh` pytest-invocation fix — no scope creep.
- Backup `~/.claude.backup-20260708-124520` confirmed present via `ls`.
- Live `~/.claude/hooks/lib/gate-log.js` and `~/.claude/hooks/enforced-rules.json` diffed against
  repo source with `diff --strip-trailing-cr`: **content-identical** (both files, including the
  post-PASS null-arg fix).
- Live `~/.claude/scripts/` inspected directly: contains only `model_routing_audit.py` —
  `gate_telemetry.py` and `verify_hook_wiring.py` are correctly **not** deployed (matches
  `deploy.sh`'s documented `optional_plugins`/`scripts` exclusion policy and the premise of
  Post-PASS Verification 2).
- **Live-fire, not just a diff check**: ran `scripts/verify_hook_wiring.py` directly against the
  real `~/.claude/hooks/` + `~/.claude/settings.json` on this machine → `OK: all 7 enforced
  hook(s) present and wired.`, exit 0 — independently reproduces the deploy-guard's own
  first-production-run report cited by the strategist, not merely trusting the claim.
- Ran `node -e "require('.../.claude/hooks/lib/gate-log.js').logGateEvent(null)"` directly against
  the **deployed** file (not the repo copy) — no throw, confirming the null-safety fix is live,
  not just committed.

## Carried-Forward Findings

- ~~**MEDIUM (`lh3_gate-log_1`)**~~ — **RESOLVED** post-PASS, independently re-verified (repo +
  deployed). See §Post-PASS Verification 1.
- **LOW (`lh3_telemetry-deploy_1`, filed to BACKLOG by the strategist at ship time):** the gate
  telemetry *reader* (`scripts/gate_telemetry.py`) is repo-local only — hooks log
  `gate_events.jsonl` in every project, but only this repo's `/handoff` can currently render the
  table. Deferred product decision (deploy `scripts/` globally vs. accept repo-local
  observability); `commands/handoff.md` degrades gracefully in the interim (confirmed, §Post-PASS
  Verification 2). Non-blocking.
- **LOW (process, resolved by this report):** the prior pass's TODO status-marker drift between
  `Artifacts/TODO.md` and `Artifacts/Plans/LH-3-TODO.md` is now resolved — both files show
  consistent `[x]` marks as of this close-out.
- **INFO:** the `pytest.exe` launcher vs `python -m pytest` discrepancy (originally flagged as an
  environment quirk in the 1st pass) turned out to have real production impact — it aborted the
  live deploy. Now fixed in `deploy.sh` (§Post-PASS Verification 3). Worth carrying as a standing
  lesson: an "environment quirk, not a code defect" finding can still warrant a code-level
  workaround when the affected code path is the deploy gate itself.

## Initiative Hard Rules — Confirmed Held Across LH-3

1. **Hooks fail-open on script error** — held throughout, confirmed both pre- and post-PASS
   (adversarial module-load-throw probe on all 5 hooks; post-PASS null-arg fuzzing closed the one
   gap found, itself never live-exploitable).
2. **Every deny states its unblock condition** — unaffected this phase; deny message text on
   `guard-paths.js`/`guard-commands.js` unchanged, the two new Stop hooks are nags (not denies),
   consistent with the rule's scope.
3. **No prose leaves context before its hook is verified + deploy-guarded** — the deploy-guard now
   exists, is deployed, and has completed a live production run confirming full wiring; no prose
   was removed this phase (`git diff --stat -- rules/` empty both at PASS time and unchanged
   since), satisfying the rule.
4. **Gate-logging is fail-open within fail-open; the deploy-guard fails CLOSED, naming the missing
   rule** — held; the deploy-guard's fail-closed behavior was independently re-exercised against
   production settings in both the 1st pass (simulated regressions) and this pass (live run, `OK:
   all 7 wired`).

## Initiative-Terminal Note

This phase closes the LH (Loop Hardening) initiative. The initiative's originally-planned "prose
token-diet payoff" (reclaiming always-loaded context lines via hook enforcement) was consciously
dropped at LH-3 kickoff (`Artifacts/DECISION_LOG.md`, 2026-07-08 entry) once recon showed the
delete-eligible prose measured ≈1 safely-removable line, not the ≥20 the original plan assumed —
a recorded, evidenced decision, not an unmet goal or a defect. The initiative's real wins — LH-1's
mechanical hook conversions, LH-2's evidence gate, and LH-3's deploy-guard + telemetry — are all
independently verified, deployed, and live as of this report.

This report closes both the audit gate and the initiative. Per `orchestration.md` TODO authority,
the auditor has marked T1a/T1b/T1c/T1d/T2a/T2b/T3/T5 and the auditor-gate line `[x]` in
`Artifacts/Plans/LH-3-TODO.md`, and the top-level `LH-3` line (plus its nested T3 line) `[x]` in
`Artifacts/TODO.md`, with a **LH INITIATIVE COMPLETE** note added — all independently re-verified
against the deployed artifacts and git history per §Deploy + Live-Wiring Evidence above, not
accepted from the coordinator's completion claim alone.
