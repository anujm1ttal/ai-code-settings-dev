# LH-2 Report — Evidence Gate (Iron Law Mechanized)

**Phase:** LH-2 · **Branch:** `phase-lh-2-evidence-gate` (merged fast-forward to `main`, deleted)
**Commit:** `541362c` · **Deployed:** 2026-07-08 · **Gate:** auditor, 2-pass · **Status:** **SHIPPED**
**Full findings:** `Artifacts/AUDIT_REPORT.md`

## Summary

T1 (detection core), T2 (Stop wrapper), T3 (fixture suite, 8 fixtures after the fix cycle), T5
(registration, deployed) are implemented, verified, and live. T4 is correctly descoped (Branch A
never built, per the LH-1 spike resolution). Pass 1 found one blocking HIGH finding — the claim
lexicon fired on non-claim uses of lexicon words (quoted literal text, hyphen-compound adjectives
like "fixed-size"). The coder's fix (`findQuotedSpans`/`isInsideQuotedSpan` skip-in-place with a
contraction guard, `isHyphenCompound`, and global per-pattern iteration in `matchCompletionClaim`)
was independently re-verified in pass 2 against the real `node hooks/evidence-gate.js`
subprocess — both original repro cases are now silent, no regressions on the original 6 fixtures,
and a second harder round of adversarial probing (decoy-claim, backtick fencing, hyphen at string
boundaries, contraction guard, quote-parsing stress) found no new false positives or false
negatives. Shipped on the pass-2 PASS verdict: committed, deployed, merged to `main`.

## Metrics Status (per `Plans/LH-2-Plan.md` §Success Metrics)

| # | Metric | Status |
|:--|:--|:--:|
| M1 | All 6 fixtures produce specified fire/silent result — `pytest tests/ -v` exit 0 | **Met** — 72/72 passed (6 original + 2 new regression fixtures) |
| M2 | N/A — Branch A descoped | N/A, correctly not built |
| M3 | Forced-crash test exits 0; gate emits `additionalContext` only, never a deny field | **Met** — re-grepped post-fix file, 0 matches for deny/decision/exit(2); exhaustive fail-open probing incl. quote-parsing stress case, all exit 0 |
| M4 | Design Fork resolved to Branch B with spike citation | Met (pre-existing, 2026-07-08) |
| M5 | Live-fire evidence captured in this report | **Met** — see §Deploy + Live-Wiring Evidence |

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

Deploy was performed after the pass-2 PASS verdict and explicit user approval (not by the
auditor). All of the following was **independently re-verified by the auditor post-deploy** — not
accepted from the deploy-completion claim alone:

- `git cat-file -t 541362c` → `commit` (exists); `git show --stat 541362c` confirms the commit
  contains the pass-2 state (17 files changed, 855 insertions / 212 deletions, matching
  `hooks/evidence-gate.js`, `hooks/lib/evidence.js`, `hooks/settings-template.json`, 8 fixtures,
  the two test files, and the audit artifacts).
- `git branch -a` confirms `phase-lh-2-evidence-gate` no longer exists; `git log --oneline -5`
  shows `main` at `541362c` directly following `a782390` (fast-forward, no merge commit).
- `bash scripts/deploy.sh`: 72 tests passed exit 0 (per commit message; consistent with the
  auditor's own fresh `pytest tests/ -v` run in pass 2). Backup `~/.claude.backup-20260708-114238`
  confirmed present via `ls`, containing the expected `DEPLOYED_ITEMS` set
  (`agents/rules/skills/templates/commands/hooks/CLAUDE.md/cheatsheet.md/README.md`) —
  `settings.json` is correctly **absent** from the backup, matching `deploy.sh`'s documented scope
  (it only backs up items it deploys; `settings.json` is edited separately, same as LH-1).
- Live `~/.claude/hooks/evidence-gate.js` and `~/.claude/hooks/lib/evidence.js` diffed against repo
  source with `diff --strip-trailing-cr`: **clean** (content-identical; `lib/evidence.js` is
  byte-identical, `evidence-gate.js` differs only in CRLF line endings — same pattern LH-1
  recorded).
- Live `~/.claude/settings.json`: `python3 -c "json.load(...)"` confirms valid JSON; `Stop` block
  contains both hooks in order `[nudge-handoff.js, evidence-gate.js]`, each with `"timeout": 5`.
- **Live-fire, not just exit-0 smoke check**: fed a fresh, auditor-authored unevidenced-claim
  transcript (source edit to a probe file + "Fixed the off-by-one bug. Done.", no test run) as
  `transcript_path` directly to the **deployed** `node C:/Users/44547/.claude/hooks/evidence-gate.js`.
  It correctly resolved its `require('./lib/evidence')` from the live `~/.claude/hooks/lib/`
  directory and emitted the IRON LAW `additionalContext` nag with the matched claim text, exit 0.
  This is stronger evidence than the coordinator's reported empty-stdin exit-0 check, which only
  proves the `require` doesn't throw on trivial input, not that the deployed logic is correct.

## Carried-Forward Findings

- **INFO (non-blocking):** unbalanced/malformed quote spans in the final assistant text fall back
  to normal (unguarded) lexicon matching, since `findQuotedSpans` cannot bound an unpaired quote
  character. This fires in the safe direction (no missed real claim) and was not a required-silent
  case; flagged for awareness only, not a fix requirement.
- **INFO (carried from pass 1, unchanged):** claim-word-to-edit linkage is topic-blind by design
  (B2's trigger is claim-word-anywhere + source-edit-anywhere-in-session, not semantic linkage) —
  accepted heuristic limitation.

## Honest Caveat

Hooks are structurally wired and deployed (files present and content-identical to repo source,
`settings.json` parses and shows the correct `Stop` matcher/block, a direct subprocess invocation
against the deployed hook correctly fires on a genuine unevidenced-claim transcript) — but **true
live-fire behavior inside a running interactive session** (the harness itself invoking the Stop
hook mid-conversation, as opposed to the auditor driving the same script directly via stdin) has
not been observed, since hook registration only takes effect from the *next* session restart
onward. This is the same caveat carried through every LH-1/OSH deploy phase; it is not a gap
specific to LH-2. The direct-subprocess live-fire test in this report is the strongest evidence
obtainable without waiting for that restart, and is materially stronger than an empty-stdin
smoke check (it proves the deployed detection logic is correct, not merely that the `require`
resolves).

This report closes both the audit gate and the phase. Per `orchestration.md` TODO authority, the
auditor has marked T0/T1/T2/T3/T5 and the auditor-gate line `[x]` in `Artifacts/Plans/LH-2-TODO.md`
(T4 remains `[~]` DESCOPED, correctly not `[x]`) and the top-level `LH-2 — Evidence Gate` line
`[x]` in `Artifacts/TODO.md`, both independently re-verified against the deployed artifacts and
git history per §Deploy + Live-Wiring Evidence above — not accepted from the coordinator's
completion claim alone.
