# AUDIT REPORT — LH-1 (Mechanical Hooks + Stop-Block Spike)

**Auditor:** auditor · **Branch:** `phase-lh-1-mechanical-hooks`
**Authority:** `Artifacts/Plans/LH-1-Plan.md` (§Success Metrics, §Hard Rules, per-task Technical Approach)
**Mode:** VERIFICATION gate — report-first. No deploy, no commit, no `[x]` marks performed in
either pass.

---

## RE-AUDIT (2nd gate pass) — 2026-07-08

Scope: verify the coder's fixes for F1 (HIGH, blocking), F2 (MEDIUM), F3 (MEDIUM), and the T2
test-gap (LOW) from the 1st-pass report below. Confirm no regressions.

### F1 (HIGH, blocking) — `hooks/guard-commands.js` order-independent trailer matcher — **RESOLVED**

- Diff confirmed: the single positional regex was replaced with
  `{ pattern: { test: (command) => /git\s+commit\b/i.test(command) && /co-authored-by:\s*claude|generated with[\s\S]*?claude code/i.test(command) }, reason }`
  — two independent boolean conditions, no ordering dependency.
- **Adversarially re-probed live against the real hook** (not a reimplementation) — 11 cases,
  all correct:

  | Case | Command | Expected | Result |
  |:--|:--|:--:|:--:|
  | (a) original bypass | `echo "Co-Authored-By: Claude" >> msg.txt && git commit -F msg.txt` | deny | **deny** |
  | (b) trailer via `-m` | `git commit -m "fix\n\nCo-Authored-By: Claude..."` | deny | **deny** |
  | (c1) commit first, trailer second (`&&`) | `git commit -m "wip" && echo "Co-Authored-By: Claude" >> log.txt` | deny | **deny** |
  | (c2) trailer first, commit second (`&&`) | `echo "Co-Authored-By: Claude" >> log.txt && git commit -m "wip"` | deny | **deny** |
  | (d) legit prose mention | `git commit -m "Investigate issue reported by Claude review bot"` | allow | **allow** |
  | (e1) `git show \| grep` of trailer text | `git show HEAD \| grep "Co-Authored-By: Claude"` | allow | **allow** |
  | (e2) `git log --grep` of trailer text | `git log --oneline --grep="Co-Authored-By: Claude"` | allow | **allow** |
  | generated-with form | `git commit -m "fix\n\nGenerated with Claude Code"` | deny | **deny** |
  | reversed generated-with | `echo "Generated with Claude Code" > m.txt && git commit -F m.txt` | deny | **deny** |
  | trailer-free commit | `git commit -m "Fix login bug"` | allow | **allow** |
  | piped `git log \| grep` (coder's new test) | `git log \| grep "Co-Authored-By: Claude"` | allow | **allow** |

  All 11/11 matched expectation. The exact case I demonstrated as a bypass in the 1st pass — (a)
  — is now correctly denied.
- **New tests confirmed present and correct**: `test_guard_commands_denies_trailer_before_git_commit`
  (case a) and `test_guard_commands_allows_piped_git_log_grep_of_trailer_text` (false-positive
  guard), both in `tests/test_lh1_hooks.py`.
- **Regression-sensitivity re-verified live**: reverted `guard-commands.js` to the old single
  positional regex, reran `test_guard_commands_denies_trailer_before_git_commit` → **failed**
  (hook produced no deny output) as expected. Restored the fix; confirmed `git diff ebbbf9b --
  hooks/guard-commands.js` is byte-identical to the coder's version and the full suite is green
  again.
- **Mixed-shape `BLOCKED_PATTERNS` loop does not throw.** `for (const { pattern, reason } of
  BLOCKED_PATTERNS) { if (pattern.test(command)) ... }` works unmodified because both a `RegExp`
  and a plain `{ test: fn }` object satisfy the same duck-typed `.test(command)` call — no
  special-casing needed, none was added.
- **Fail-open re-confirmed specifically for the new matcher shape** — live-probed the hook with
  payloads designed to stress the new custom `test` function: non-string `command` (number, `null`,
  array, object), missing `tool_input`, malformed JSON, empty stdin. All 7 cases: `rc=0`, empty
  stdout, no stderr. (`RegExp.prototype.test` coerces its argument via `ToString`, so even
  array/object `command` values don't throw inside the custom `test` closure — confirmed
  empirically, not just reasoned.)

**Verdict: F1 fully resolved. No regression.**

### F2 (MEDIUM) — `hooks/auto-lint.js` header comment — **PARTIALLY RESOLVED**

- Header now reads `Auto-Lint (Loud Feedback, No Auto-Fix)` and *"The hook itself never modifies
  files — it injects a loop-closing directive telling Claude to fix the reported issues before
  proceeding (LH-1 T1)."* — no longer contradicts the `Fix before proceeding.` directive it emits.
  Confirmed self-consistent.
- **Confirmed ONLY the comment changed** — diffed the full file against the 1st-pass version:
  the only delta between this pass and my previously-reviewed version is the header block (lines
  1–13). `countIssues()`, `LINTER_MAP`, `runLinter`, and the directive string are byte-identical
  to what I already verified. No logic drift.
- **Residual gap, not addressed**: F2 was a compound finding — (1) the required
  `Artifacts/BACKLOG.md` filing for the doc-sync ("`auto-lint description: report-only →
  fix-before-proceeding`"), and (2) the self-contradictory in-file header. Only (2) was fixed.
  Re-checked `Artifacts/BACKLOG.md` — no entry exists for this item (grep confirms), and
  `CLAUDE-global.md:147` still reads *"report-only, no auto-fix"* with no tracking breadcrumb.
  This is now **LOW** (downgraded from MEDIUM — the more urgent self-contradiction is fixed; what
  remains is a missing 1-line process breadcrumb, not a functional or user-facing defect). Does
  not block deploy; should be filed before or during LH-3 kickoff so the `CLAUDE-global.md` line
  isn't forgotten.

**Verdict: F2 header-consistency resolved; BACKLOG-filing sub-item still outstanding (LOW, non-blocking).**

### F3 (MEDIUM) — `Artifacts/Reports/LH-1-stop-spike.md` session-ID claim — **RESOLVED**

- Caveat 4 now lists actual session IDs: control `7e00c621-...`, (b) `decision:block`
  `f5ac695b-...`, (c) `additionalContext`-only `2f017edb-...`, with an explicit, honest note that
  (a) exit-2 never completed (killed by `timeout`) so no session ID exists for it. This is
  consistent with the Result Summary table (exit-2 row: "Never completed... zero stdout ever
  produced"). The evidence claim now matches the document's own content.

**Verdict: F3 fully resolved.**

### T2 test gap (LOW) — Windows backslash path — **RESOLVED**

- `test_guard_paths_denies_windows_backslash_shadow_path` added, uses a literal `C:\Users\...`
  backslash path, asserts deny + `Artifacts/` in the reason. Matches the manual probe I ran in
  the 1st pass. Confirmed passing.

**Verdict: Resolved.**

### Full test suite — **PASS, 56/56, exit 0**

Ran fresh this pass: `pytest tests/ -v` → **56 passed in 5.17s**, exit code 0 (was 53 in the 1st
pass; +3 new tests: the two T3 regression tests and the T2 backslash test, all accounted for).
No unexpected failures, no skips, no new file changes outside the four items under review —
`git diff ebbbf9b --name-only` shows the same file set as the 1st pass (`hooks/auto-lint.js`,
`hooks/guard-commands.js`, `hooks/guard-paths.js`, `hooks/settings-template.json`,
`tests/test_hooks_smoke.py`, plus the untracked `tests/test_lh1_hooks.py` and planning docs).
`coding-style.md`, `CLAUDE-global.md`, `hooks/README.md` remain untouched (Hard Rule 3 still
held).

### Re-audit overall verdict: **PASS — LH-1 is deploy-ready**

All blocking and should-fix items from the 1st-pass gate are resolved:
- F1 (HIGH, blocking) — fully resolved, adversarially re-verified with 11 live probes including
  the exact bypass I originally demonstrated, plus a live regression-revert check.
- F3 (MEDIUM) — fully resolved.
- F2 (MEDIUM) — the functional/self-consistency part is resolved; one small non-blocking LOW
  item remains (missing BACKLOG breadcrumb for the `CLAUDE-global.md` doc-sync) — does not gate
  deploy, should be filed before LH-3 touches that file.
- T2 backslash test gap (LOW) — resolved.

No regressions found anywhere in the touched surface. Fail-open invariant re-confirmed
specifically against the new matcher shape in `guard-commands.js` with live forced-crash probes.

**This phase is ready for `bash scripts/deploy.sh` + live `~/.claude/hooks/` verification and
subsequent `[x]` marking of T1–T6 in `Artifacts/Plans/LH-1-TODO.md`, on explicit user approval to
deploy.** Per this session's instructions, the auditor has not deployed and has not marked any
task `[x]` — both remain gated on the user.

---

## 1st-Pass Report (for reference — findings above supersede where marked RESOLVED)

### Strengths

- **T4 (`nudge-handoff.js`) is exemplary defense-in-depth.** Every I/O boundary (`isGitDirty`,
  `readTranscriptTail`, `alreadyNudged`, `markNudged`) has its *own* local try/catch in addition
  to the outer `main()` catch — a genuinely layered fail-open design, not just a single outer net.
- **T2's allowlist-before-deny ordering is correct and tested from both directions**: a state
  basename (`todo.md`) sitting *inside* an allowlisted `memory/` segment is explicitly tested and
  confirmed allowed (`test_guard_paths_allows_state_basename_under_memory_dir`) — this is exactly
  the false-positive case that would have broken the native memory feature if gotten wrong.
- **T1 respected the "do not rewrite plumbing" constraint precisely** — the diff is a 2-line
  directive change plus one small, clearly-scoped `countIssues()` helper. `LINTER_MAP`,
  `commandExists`, `runLinter`, the fail-open branches, and the 2000-char cap are byte-identical
  to the pre-LH-1 version.
- **T5's spike report is honest about its own limitations** — it explicitly flags the
  non-interactive-only test mode, the deliberate non-honoring of `stop_hook_active`, and states a
  falsifiable follow-up condition for LH-2 rather than overclaiming a clean verdict.
- **Scope discipline held**: `coding-style.md`, `CLAUDE-global.md`, and `hooks/README.md` are
  byte-untouched this phase (confirmed via diff), correctly deferring prose changes to LH-3 per
  Hard Rule 3.
- **T6's fail-open parametrization is comprehensive** — a single `ALL_HOOKS × bad_stdin` matrix
  covers every changed hook including the brand-new `nudge-handoff.js`, rather than writing one-off
  duplicated tests per hook.

### Gate Results

#### Gate 1 — Fail-open invariant (Hard Rule 1) — PASS

Parametrized bad-stdin matrix (12 cases) plus live forced-crash probes (non-string `file_path`/
`command`) confirmed exit 0 in all cases. Code-path reading confirmed T4's git/file operations
and T2/T3's static regex construction all sit inside try/catch boundaries.

#### Gate 2 — T1 (`auto-lint.js`) — PASS with MEDIUM finding (see RE-AUDIT F2 above)

Directive closes the loop; plumbing untouched; issue count correct for ruff format. MEDIUM: doc-
sync tracking dropped (BACKLOG filing never made) and the hook's own header comment contradicted
its new behavior.

#### Gate 3 — T2 (`guard-paths.js`) — PASS

Shadow-path deny, memory/tool-results allowlist, legitimate-Artifacts/-write non-blocking, and
scratch-segment exact-match all verified (tests + live manual probes). LOW: no automated
backslash-path test (see RE-AUDIT — now resolved).

#### Gate 4 — T3 (`guard-commands.js`) — FAIL (HIGH) — see RE-AUDIT F1 above (now resolved)

Order-dependent regex bypass empirically demonstrated: trailer text positioned before `git
commit` in the command string defeated detection. INFO (unchanged, not a defect): trailer written
to a file in a prior, separate tool call and referenced via `-F` remains structurally undetectable
by any command-string regex approach — flagged for LH-2/LH-3 awareness, no action for LH-1.

#### Gate 5 — T4 (`nudge-handoff.js`) — PASS

Never emits deny; marker under OS temp; all required scenarios (dirty/clean/repeat/recent-handoff/
non-git) tested and passing.

#### Gate 6 — T5 spike report — PASS with MEDIUM finding (see RE-AUDIT F3 above, now resolved)

Verdict + evidence for all 3 Stop-block variants, clear LH-2 recommendation, correctly self-flags
the B5-contradicting finding (INFO, carried forward to LH-2 kickoff). MEDIUM: session-ID claim in
Caveat 4 unsubstantiated by the document's own content.

#### Gate 7 — Independent test run — PASS

`pytest tests/ -v` → 53 passed, exit 0 (fresh run). Live regression spot-check (T3 pattern
reverted) confirmed the two T3 tests fail as required by T6's metric; file restored, diff
byte-identical, suite green again.

#### Gate 8 — Scope discipline (Hard Rule 3) — PASS

`coding-style.md`, `CLAUDE-global.md`, `hooks/README.md` confirmed untouched. Every line in
`hooks/*.js` and `tests/*.py` traces to T1–T4/T6; no adjacent reformatting found.

### 1st-Pass Findings Summary

| # | Severity | Gate | Finding | Status after re-audit |
|:--|:--|:--|:--|:--|
| F1 | HIGH | 4 (T3) | Order-dependent regex bypass | **RESOLVED** |
| F2 | MEDIUM | 2 (T1) | Missing BACKLOG filing + self-contradictory header comment | Header **RESOLVED**; BACKLOG filing still outstanding, downgraded to **LOW**, non-blocking |
| F3 | MEDIUM | 6 (T5) | Unsubstantiated session-ID claim in spike report | **RESOLVED** |
| F4 | LOW | 3 (T2) | Missing Windows backslash-path test | **RESOLVED** |
| F5 | INFO | 4 (T3) | Structural limitation: `-F file.txt` trailer undetectable by command-regex approach | No action for LH-1 (unchanged, informational) |
| F6 | INFO | 6 (T5) | Spike result contradicts plan's B5 doc-assumption | No action for LH-1 (unchanged, informational, carries to LH-2) |
