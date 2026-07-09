# LH-1 Report — Mechanical Hooks + Stop-Block Spike

**Phase:** LH-1 · **Branch:** `phase-lh-1-mechanical-hooks` (merged fast-forward to `main`, deleted)
**Commit:** `14716e4` · **Deployed:** 2026-07-08 · **Gate:** auditor, 2-pass

## Summary

Upgraded `auto-lint.js` from soft report to loop-closing directive, added two new PreToolUse
hard-deny gates (`guard-paths.js` shadow-state-file gate, `guard-commands.js` commit-trailer
gate), added a new Stop-event handoff nudge (`nudge-handoff.js`), and ran an empirical spike to
determine whether Stop hooks can actually block turn-end (they can, contradicting the plan's B5
doc-only assumption — see `Reports/LH-1-stop-spike.md`).

## Metrics Met (per `Plans/LH-1-Plan.md` §Success Metrics)

| Task | Metric | Status |
|:--|:--|:--:|
| T1 | Seeded `.py` violation → directive + issue count; clean edit silent; ruff-absent exits 0 | Met |
| T2 | Shadow `TODO.md` denied w/ `Artifacts/` reason; `memory/MEMORY.md` allowed | Met |
| T3 | Bash heredoc + PowerShell here-string trailer both denied; trailer-free + prose-"Claude" allowed | Met (after 1 fix cycle — see Audit History) |
| T4 | Dirty→nudge, clean→silent, repeat→silent | Met |
| T5 | `LH-1-stop-spike.md` records verdict + evidence for all 3 variants | Met |
| All | Forced-crash exits 0 on every touched hook; `pytest tests/ -v` exit 0; deploy passes + live-verified | Met — 56/56 tests, exit 0; deploy 6/6 |

## Audit History (2-pass gate)

- **1st pass**: found 1 HIGH-severity gap — the T3 commit-trailer regex was order-dependent and
  could be bypassed by writing the trailer text to a file *before* the `git commit` invocation in
  the same command string (e.g. `echo "Co-Authored-By: Claude" >> msg.txt && git commit -F
  msg.txt`). Plus 2 MEDIUM findings: a missing BACKLOG doc-sync filing + self-contradictory
  header comment in `auto-lint.js`, and an unsubstantiated session-ID claim in the T5 spike
  report. One LOW: missing Windows-backslash-path test coverage in `guard-paths.js`.
- **2nd pass**: all four re-verified live (not re-read from the coder's summary). The T3 fix
  replaced the single positional regex with two independent boolean conditions
  (`hasGitCommit(command) && hasTrailerText(command)`), re-probed against 11 adversarial cases
  including the original bypass — all correct. Regression-sensitivity re-confirmed by reverting
  the fix live and observing the new test fail, then restoring it. Fail-open re-confirmed against
  the new `{test: fn}` matcher shape with forced-crash payloads (non-string/null/array/object
  `command`). Full suite: 56/56 passed, exit 0.

## Deploy + Live-Wiring Evidence

- `bash scripts/deploy.sh`: 6/6 validation steps passed, `pytest` 56/56 exit 0, backup created at
  `~/.claude.backup-20260708-105049`.
- Live hook files (`auto-lint.js`, `guard-paths.js`, `guard-commands.js`, `nudge-handoff.js`) in
  `~/.claude/hooks/` confirmed content-identical to repo source (diffed, only CRLF line-ending
  differences).
- `~/.claude/settings.json` confirmed live: `PreToolUse` matcher for `guard-paths.js` widened to
  `Edit|MultiEdit|Write|NotebookEdit`; new `Stop` block registered, wired to `nudge-handoff.js`.
- Merge: fast-forward to `main` at `14716e4`; `phase-lh-1-mechanical-hooks` branch deleted.

## Carried-Forward Findings

- **LOW (tracked for LH-3):** `CLAUDE-global.md:147` and `rules/common/coding-style.md`'s
  report-only stance are now stale relative to `auto-lint.js`'s actual "fix before proceeding"
  behavior. The required `Artifacts/BACKLOG.md` breadcrumb for this doc-sync was never filed
  during LH-1 — file it before or during LH-3 §T3b so the line isn't forgotten when prose is
  split out.
- **INFO (structural, not a defect):** command-string regex matching (T3's approach) cannot
  detect an attribution trailer written to a file in a *separate, prior* tool call and referenced
  via `git commit -F <file>` — inherent to the chosen approach, flagged for LH-2/LH-3 awareness.
- **INFO:** T5's empirical finding — all three Stop-hook variants (exit-2, `decision:block`,
  `additionalContext`-only) blocked or delayed turn-end in this runtime — contradicts the plan's
  B5 doc-only assumption. LH-2's design should treat `decision:block` + `stop_hook_active`
  honoring as the only viable hard-gate path, defaulting to the evidence-nag design otherwise
  (see `Reports/LH-1-stop-spike.md` §Recommended LH-2 design).

## Honest Caveat

Hooks are structurally wired and deployed (files present, `settings.json` parses and shows the
correct matchers/blocks), but **true live-fire behavior** — the Stop nudge actually firing on a
dirty tree, the widened `PreToolUse` matcher actually intercepting a `NotebookEdit` — has not
been observed in a live session, since hook registration only takes effect from the *next*
session restart onward. This is the same caveat carried through every OSH deploy phase; it is
not a gap specific to LH-1.
