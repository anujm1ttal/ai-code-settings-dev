# LH-2 Report — Evidence Gate (Iron Law Mechanized)

**Phase:** LH-2 · **Branch:** `phase-lh-2-evidence-gate` (not yet merged/deployed)
**Gate:** auditor, 2-pass · **Status:** **PASS — deploy-ready on user approval**
**Full findings:** `Artifacts/AUDIT_REPORT.md`

## Summary

T1 (detection core), T2 (Stop wrapper), T3 (fixture suite, 8 fixtures after the fix cycle), T5
(registration, not yet deployed) are implemented and verified. T4 is correctly descoped (Branch A
never built, per the LH-1 spike resolution). Pass 1 found one blocking HIGH finding — the claim
lexicon fired on non-claim uses of lexicon words (quoted literal text, hyphen-compound adjectives
like "fixed-size"). The coder's fix (`findQuotedSpans`/`isInsideQuotedSpan` skip-in-place with a
contraction guard, `isHyphenCompound`, and global per-pattern iteration in `matchCompletionClaim`)
was independently re-verified in pass 2 against the real `node hooks/evidence-gate.js`
subprocess — both original repro cases are now silent, no regressions on the original 6 fixtures,
and a second harder round of adversarial probing (decoy-claim, backtick fencing, hyphen at string
boundaries, contraction guard, quote-parsing stress) found no new false positives or false
negatives.

## Metrics Status (per `Plans/LH-2-Plan.md` §Success Metrics)

| # | Metric | Status |
|:--|:--|:--:|
| M1 | All 6 fixtures produce specified fire/silent result — `pytest tests/ -v` exit 0 | **Met** — 72/72 passed (6 original + 2 new regression fixtures) |
| M2 | N/A — Branch A descoped | N/A, correctly not built |
| M3 | Forced-crash test exits 0; gate emits `additionalContext` only, never a deny field | **Met** — re-grepped post-fix file, 0 matches for deny/decision/exit(2); exhaustive fail-open probing incl. quote-parsing stress case, all exit 0 |
| M4 | Design Fork resolved to Branch B with spike citation | Met (pre-existing, 2026-07-08) |
| M5 | Live-fire evidence captured in this report | **Not yet** — deploy remains gated on explicit user approval; not performed by this audit |

## Audit History (2-pass gate)

- **1st pass**: found 1 HIGH-severity gap — `hooks/lib/evidence.js`'s claim lexicon matched bare
  lexicon words with no quote-context or part-of-speech awareness, firing on (a) the literal word
  "done" inside quoted narration about what code prints, and (b) the word "fixed" inside the
  common compound adjective "fixed-size". Both violated Hard Rule 1 ("silence is the default").
  All other gates (no-deny-field, fail-open, source-edit exclusion, fresh-evidence correlation,
  `stop_hook_active`, regression-sensitivity, scope) passed on first read.
- **2nd pass**: fix re-verified live, not re-read from the coder's summary. Both original repro
  cases confirmed silent against the real hook subprocess. Re-probed with 6 new adversarial
  fixtures targeting the new guards specifically: a genuine claim + quoted decoy in the same text
  (must fire on the real claim, not be suppressed by the global-iteration change — confirmed
  correct), backtick-fenced code, hyphen compounds at sentence start/end, the contraction guard
  (`it's done` must still fire), and a deliberately malformed/unbalanced quote-count stress case
  (fails open safely, fires on the plain unquoted claim rather than throwing). All 6 original
  fixtures re-confirmed unchanged (no flips). Full suite: 72/72 passed, exit 0. Regression-proof:
  broke `isHyphenCompound` → 2 tests failed as expected → restored byte-identical (md5 match).

## Deploy + Live-Wiring Evidence

**Not performed** — deploy remains explicitly out of scope for this audit (report-first, gated on
user approval). `hooks/settings-template.json`'s `Stop` entry for `evidence-gate.js` was reviewed
in pass 1 and confirmed unchanged in pass 2. Live `~/.claude/settings.json` confirmed to still
**not** contain `evidence-gate` (`grep -c` → 0) — no deploy occurred during either audit pass.

## Carried-Forward Findings

- **INFO (non-blocking):** unbalanced/malformed quote spans in the final assistant text fall back
  to normal (unguarded) lexicon matching, since `findQuotedSpans` cannot bound an unpaired quote
  character. This fires in the safe direction (no missed real claim) and was not a required-silent
  case; flagged for awareness only, not a fix requirement.
- **INFO (carried from pass 1, unchanged):** claim-word-to-edit linkage is topic-blind by design
  (B2's trigger is claim-word-anywhere + source-edit-anywhere-in-session, not semantic linkage) —
  accepted heuristic limitation.

## Honest Caveat

This report closes the audit gate, not the phase. Per `orchestration.md` TODO authority, the
auditor has **not** marked any T1/T2/T3/T5 task `[x]` in `Artifacts/Plans/LH-2-TODO.md` — that
happens after the user approves deploy. M5 (live-fire evidence) cannot be produced until after
`bash scripts/deploy.sh` runs and the hook is exercised in a live session, which is gated on
explicit user approval, not this audit.
