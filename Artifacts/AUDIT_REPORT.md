# AUDIT_REPORT.md — LH-3 (Deploy-Guard + Telemetry + Doc-Sync, initiative-terminal)

**Auditor pass:** 2026-07-08 · **Branch:** `phase-lh-3-telemetry-prose` (uncommitted working
tree — `main` and the phase branch share the same HEAD `920577e`; this is a working-tree diff,
not yet committed) · **Authority:** `Artifacts/Plans/LH-3-Plan.md` (re-scoped) +
`Artifacts/Plans/LH-3-TODO.md`

**Verdict: PASS — deploy-ready on user approval.** One MEDIUM finding filed to BACKLOG
(non-blocking, not a live defect). One LOW process nit (TODO status-marker drift). No
CRITICAL/HIGH findings.

---

## Strengths

- **Defense-in-depth done right on the fail-open guarantee.** Every one of the 5 instrumented
  hooks writes its deny/nag `stdout` payload via `process.stdout.write` *before* calling the
  logger, and the logger call itself is a lazily-`require`d, independently `try/catch`-wrapped
  `logGateSafe()` at the call site — two layers of protection, not one. Verified this holds even
  under a **stronger** failure mode than the coder's own test suite exercises (see Gate 1).
- **The deploy-guard correctly inverts the fail-open convention and says so.** `verify_hook_wiring.py`'s
  docstring and `deploy.sh`'s inline comment both explicitly call out that this is a deploy gate
  (fail CLOSED) as an intentional exception to the hook-layer's fail-open rule, with the rationale
  spelled out — this is exactly the kind of "why this breaks the pattern" documentation the
  Deletion Test in `architecture.md` rewards.
- **Honest re-scope.** `DECISION_LOG.md`'s 2026-07-08 entry names the metric error plainly ("my
  metric error — unachievable once the grill killed blocking-lint + TODO-authority") instead of
  quietly redefining success. `Artifacts/TODO.md`'s Hard Rule 3 was correspondingly rewritten to
  match reality rather than left stale.
- **No coverage cut in doc-sync.** Diffed `rules/*.md` against HEAD — zero changes. `CLAUDE-global.md`
  and `hooks/README.md` diffs are 100% additive/corrective (new rows for `nudge-handoff.js` /
  `evidence-gate.js`, corrected `auto-lint.js` description) — nothing removed.
- **Manifest enumerated from the template, not hand-maintained twice.** `hooks/enforced-rules.json`'s
  own `_comment` field states the template is the source of truth and matches it exactly (verified
  field-by-field, see Gate 4).

---

## Gate-by-Gate Findings

### Gate 1 — Fail-open-within-fail-open — **PASS**

Reviewed all 5 instrumented hooks (`guard-paths.js`, `guard-commands.js`, `auto-lint.js`,
`nudge-handoff.js`, `evidence-gate.js`): in every file, `logGateSafe()` is called strictly
**after** `process.stdout.write(JSON.stringify(output))` (the decision is already flushed), and
`logGateSafe` is its own local `try { require('./lib/gate-log').logGateEvent(...) } catch {}` —
independent of `gate-log.js`'s internal try/catch.

Independently (not trusting the coder's `tests/test_gate_log.py` fixture alone), I ran a
**stronger** adversarial probe: instead of making the exported function throw (the coder's
fixture), I replaced `hooks/lib/gate-log.js` with a file that throws at **module-load time**
(`require()` itself throws — a strictly more hostile failure than a function-body throw, since it
can't be caught by anything inside the module). Ran all 5 hooks against both the real hooks dir
and this adversarial copy, same fixture inputs that trigger each hook's fire condition:

| Hook | normal stdout == adversarial stdout | rc both 0 |
|:---|:---:|:---:|
| guard-paths (deny) | identical | yes |
| guard-commands (deny) | identical | yes |
| auto-lint (nag) | identical | yes |
| nudge-handoff (nag) | identical | yes |
| evidence-gate (nag) | identical | yes |

Also independently confirmed the bad-stdin fail-open parametrization is untouched (unreadable
stdin / malformed JSON → `process.exit(0)` before the logger is ever reached) by re-reading each
hook's `main()` — the log call sits deep inside the fire branch, after both stdin guards.

**One MEDIUM finding** (filed `lh3_gate-log_1` to `Artifacts/BACKLOG.md`, not blocking this gate):
calling `logGateEvent(null)` **directly** throws before `gate-log.js`'s own internal try/catch
runs — the parameter destructuring happens in the function signature, which executes before the
function body. This contradicts the file's docstring ("entirely wrapped in try/catch", "Never
throws"). Not exploitable today: no call site ever passes `null`, and even if one did, the
call-site's own `logGateSafe` wrapper (outside `gate-log.js`) still catches it — confirmed by the
same adversarial-probe logic. This is a documentation/robustness gap in the module's *own*
self-containment claim, not a hook-behavior defect. See BACKLOG for the 1-line fix.

### Gate 2 — Log-only-on-fire — **PASS**

Code review confirms the `logGateSafe(...)` call is textually inside each hook's fire branch only
(never in the allow/pass-through path). Spot-verified independently for `guard-paths.js` with an
allowed path (`scripts/model_router.py`) — no `gate_events.jsonl` was created. The remaining 4
hooks' allow/silent paths were verified by direct source inspection (the call site is inside an
`if` block that only executes on deny/nag) and cross-checked against
`tests/test_gate_log.py::test_*_allow_writes_no_gate_event` / `*_silent_writes_no_gate_event`,
which exercise all 5.

### Gate 3 — Deploy-guard, both paths — **PASS**

Ran `scripts/verify_hook_wiring.py` myself against the **real live** `~/.claude/settings.json`:

```
OK: all 7 enforced hook(s) present and wired.
exit=0
```

Simulated the regression case two ways: (a) copied the real `~/.claude/hooks/` and deleted
`nudge-handoff.js` → `FAIL: [nudge-handoff] hook file missing: ...`, exit 1. (b) copied the real
`~/.claude/settings.json` and stripped `evidence-gate.js`'s entry out of the `Stop` block → `FAIL:
[evidence-gate] evidence-gate.js not referenced under "Stop" in ...`, exit 1. Both name the exact
`rule_id`.

Simulated a fully-absent `settings.json` (pointed `--settings-file` at a nonexistent path) →
`WARN: settings.json not found at ... deploy proceeds.`, exit 0 — confirms the fresh-machine
bootstrap exception does not regress to fail-closed.

Confirmed `deploy.sh` invokes the guard inside STEP 6 (after hooks are copied to `$DEST`, so the
check has real files to inspect) and that a failing guard `exit 1`s the whole script via the `if !
... ; then exit 1; fi` pattern (matches the existing `set -e` idiom used elsewhere in the file).

### Gate 4 — Manifest correctness — **PASS**

Diffed `hooks/enforced-rules.json` against `hooks/settings-template.json` field-by-field: 7
entries in both, `rule_id`/`hook_file`/`event`/`matcher` match exactly, `blocking: true` only on
`guard-paths` and `guard-commands` (the two `PreToolUse` deny hooks) — everything else `false`.
No hand-listing drift.

### Gate 5 — Telemetry — **PASS**

Built my own fixture (independent of `tests/test_gate_telemetry.py`'s `FIXTURE_EVENTS`) — 5
synthetic events across 3 hooks with overlapping/non-overlapping timestamps — and ran
`scripts/gate_telemetry.py` against it directly:

- Full table: `guard-commands` 3 deny (correct, 3 events), `auto-lint` 1 nag, `nudge-handoff` 1
  nag, `last_fired` = max timestamp per hook (verified against my fixture's max values).
- `--since 2026-06-15`: `guard-commands` deny count drops 3→2 (correctly excludes the 2026-06-01
  event), the two other hooks unchanged (both after the cutoff).
- `--json`: same counts, valid JSON.

`commands/handoff.md` diff confirms a new step 6 sub-bullet running
`python scripts/gate_telemetry.py` and requiring its table in the brief under a new **Gate
Telemetry** bullet in the Report Format section.

### Gate 6 — Doc-sync (scribe), no deletion — **PASS**

`git diff --stat HEAD -- rules/` → **empty** (zero rule files touched), confirming Hard Rule 3
("no prose deleted this phase"). `CLAUDE-global.md` hooks table: `auto-lint.js` description
corrected to reflect the LH-1 fix-before-proceeding directive; `nudge-handoff.js` and
`evidence-gate.js` rows added (previously undocumented — table went from 5 rows to 7, matching
all 7 deployed hooks). `hooks/README.md`: hook count corrected 5→7 in the `/hooks` walkthrough,
new "Stop Hooks (Turn-End Feedback)" section added, `guard-paths`/`guard-commands` bullets
extended (not replaced) to cover the scratch-gate and commit-trailer additions from LH-1/LH-2.
Confirmed `coding-style.md` has no `auto-lint` mention at all (`grep -i auto-lint` → no matches) —
matches the plan's note that this was a non-issue, not a miss.

### Gate 7 — Independent test run + regression proof — **PASS (with environment caveat)**

`pytest tests/ -v` (the `pytest.exe` launcher directly) reproducibly fails 3 of 103 tests in
`tests/test_deploy_guard.py` with `OSError: [WinError 6] The handle is invalid` inside CPython's
`subprocess.Popen._make_inheritable`. Isolated this to a **Windows launcher artifact**, not a
code defect: the same 3 tests pass in isolation, pass when the whole suite is run via `python -m
pytest tests/ -v` instead of the `pytest.exe` shim, and the failure reproduces on an *unmodified*
tree. `python -m pytest tests/ -v` → **103 passed, exit 0**, matching the plan's M5 target exactly.

**Regression proof**: intentionally broke `verify_hook_wiring.py`'s missing-hook failure message
(dropped the `[{rule_id}]` prefix) → `tests/test_deploy_guard.py::test_missing_hook_file_fails_naming_rule`
failed with a clear assertion diff (`'[nudge-handoff]' in failures[0]` → False). Restored the
exact original line; `git status`/`git diff` confirm the file is back to its pre-edit (still
untracked, unchanged) state.

### Gate 8 — Initiative-terminal check — **PASS**

Cross-checked LH-3 against the 4 initiative Hard Rules (`Artifacts/DECISION_LOG.md` LH-launch
entry, mirrored in `Artifacts/TODO.md`'s "Initiative Hard Rules" section, itself updated this
phase to rules 3/4's re-scoped wording):

1. **Hooks fail-open on script error** — held; confirmed via Gate 1's adversarial probe across
   all 5 newly-instrumented hooks plus the pre-existing bad-stdin/bad-JSON guards.
2. **Every deny states its unblock condition** — unaffected this phase (guard-paths/guard-commands
   deny messages are unchanged text; the two new Stop hooks are nags, not denies, so this rule is
   N/A to them, consistent with the task brief's own framing).
3. **No prose leaves context before its hook is verified + deploy-guarded** — the deploy-guard now
   exists (Gate 3) and is wired into `deploy.sh`; since the prose-split itself was dropped (B2), no
   prose left context this phase, satisfying the rule vacuously and by design (not a gap).
4. **Gate-logging is fail-open within fail-open; the deploy-guard fails CLOSED, naming the missing
   rule** (Hard Rule 4 as rewritten for LH-3, replacing the dropped `gemini-only.md` rule) — held,
   per Gates 1 and 3.

The initiative's original "prose token-diet payoff" (~1 always-loaded line) was consciously
dropped per `DECISION_LOG.md`'s 2026-07-08 entry, with the measurement shown (delete-eligible
prose ≈1 line, not the ≥20 the old M3 target assumed) — this is a recorded, evidenced decision,
not a defect or a quietly-abandoned goal.

---

## Severity Summary

| Severity | Count | Item |
|:---|:--:|:---|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 1 | `lh3_gate-log_1` — `logGateEvent(null)` bypasses its own try/catch (not live-exploitable; filed to BACKLOG) |
| LOW | 1 | TODO status-marker drift: `Artifacts/TODO.md` marks T3 `[-]` (in progress) but `Artifacts/Plans/LH-3-TODO.md` still shows `[ ]` (not started) for the same task, even though the scribe's doc-sync diffs are complete. Cosmetic; does not block the content verification in Gate 6. |
| INFO | — | `pytest` launcher (`pytest.exe`) vs `python -m pytest` produce different results on this machine for 3 subprocess-spawning tests — a local environment quirk, not a repo defect (see Gate 7). |

## Not Blocking Deploy

None of the above findings gate deploy-readiness. The MEDIUM is a documentation-accuracy issue in
an already-double-wrapped safety mechanism; the LOW is a status-marker inconsistency that
resolves naturally once the auditor's `[x]` marks are applied.

## Recommendation

**PASS.** All 8 gates cleared with independent (non-coder-trusting) verification: adversarial
module-load-throw probes on all 5 instrumented hooks, deploy-guard exercised against the real
live `~/.claude/settings.json` plus two hand-built regression scenarios (missing file, unwired
entry) and the absent-settings warning path, an independently-built telemetry fixture, a
line-by-line manifest-vs-template diff, a `rules/` tree diff confirming zero deletions, a
break-then-restore regression proof, and a fresh `python -m pytest tests/ -v` run (103 passed,
exit 0).

Per this task's brief, **no `[x]` marks, no commit, no deploy were performed** — the strategist/user
should confirm this report, then run `bash scripts/deploy.sh` when ready (exercises the new
hook-wiring guard end-to-end against the real `~/.claude/`) to close the LH initiative.
