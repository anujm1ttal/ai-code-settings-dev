# AUDIT_REPORT — LH-2 Evidence Gate

**Branch:** `phase-lh-2-evidence-gate` · **Auditor pass:** 2 (final) · **Date:** 2026-07-08
**Authority:** `Artifacts/Plans/LH-2-Plan.md` (Design Fork RESOLVED to Branch B) + `Artifacts/Reports/LH-1-stop-spike.md`
**Mode:** VERIFICATION gate, report-first. No deploy, no commit, no `[x]` marks performed.

## Overall Verdict: **PASS** — deploy-ready on user approval

Pass 1's blocking HIGH finding (claim-lexicon false positives on quoted literal text and
hyphen-compound adjectives) is fixed, re-verified independently against the real
`node hooks/evidence-gate.js` subprocess (not re-read from the coder's summary), and shows no
regressions or new holes under a second, harder round of adversarial probing. All 8 gates now
PASS. **Deploy and `[x]` marking are still gated on explicit user approval** — neither performed
by this audit.

---

## Pass 2 — Fix Verification (Gate 3 re-audit)

**Fix scope confirmed correct**: `hooks/lib/evidence.js` claim lexicon only —
`findQuotedSpans`/`isInsideQuotedSpan` (skip-in-place, contraction-guarded), `isHyphenCompound`
(rejects letter-hyphen adjacency either side of a match), and `matchCompletionClaim` switched to
global per-pattern iteration so a rejected quoted/hyphen match doesn't suppress a later genuine
claim in the same sentence. `hooks/evidence-gate.js`, `hooks/settings-template.json`, and the
original 6 fixtures are untouched, confirmed by re-diffing.

### 1. Original two adversarial cases re-run against the real hook

| Fixture (from pass 1) | Pass 1 result | Pass 2 result |
|:---|:---:|:---:|
| quoted `"done"` in narration + source edit | FIRED (bug) | **SILENT** (fixed) |
| `"fixed-size buffer"` + source edit | FIRED (bug) | **SILENT** (fixed) |

### 2. New adversarial probing of the new guards (6 fresh fixtures, real hook, this pass)

| Case | Expected | Actual | Result |
|:---|:---|:---:|:---:|
| Unbalanced quote (`he said "I'm done...` never closes) | ambiguous/no spec | FIRES | Not a regression — see note below |
| Genuine claim + quoted decoy in same text (`Fixed it. The log prints "done".`) | FIRE on "Fixed it." | FIRES, matched text = `"Fixed it."` | **PASS** |
| Backtick-fenced `` `done` `` value in explanatory prose | SILENT | SILENT | **PASS** |
| Hyphen compound at sentence **start** (`fixed-point arithmetic is now used...`) | SILENT | SILENT | **PASS** |
| Hyphen compound at sentence **end** (`...is now size-fixed`) | SILENT | SILENT | **PASS** |
| Contraction guard (`The migration is complete, it's done.`) | FIRE on "done"/"complete" | FIRES, matched full sentence | **PASS** |

**Unbalanced-quote note**: `findQuotedSpans` pairs consecutive same-type quote characters; an odd
count leaves the final quote unpaired, forming no span, so text after it is matched normally. This
fires (safe direction — no missed real claim), and is a defensible outcome for genuinely malformed
quoting the parser cannot reliably bound. It was not one of the coordinator's required-silent
cases, and correcting it would require heavier quote-balance heuristics with their own new
false-negative risk (an actual unclosed quote spanning a real claim later in the sentence). Not
blocking; noted as a residual INFO item, not a regression from the fix.

**No new false negative found.** The global-iteration change was the highest-risk part of this fix
(a naive implementation could let a rejected quoted/hyphen match consume the loop and miss a real
claim after it) — the decoy fixture was built specifically to catch that class of bug, and it
correctly still fires on the genuine claim.

### 3. Original 6 fixtures — no flips

| Fixture | Expected | Pass 2 actual | Result |
|:---|:---:|:---:|:---:|
| unevidenced-done.jsonl | FIRE | FIRE | OK |
| stale-evidence.jsonl | FIRE | FIRE | OK |
| evidenced-done.jsonl | SILENT | SILENT | OK |
| doc-only.jsonl | SILENT | SILENT | OK |
| conversational.jsonl | SILENT | SILENT | OK |
| handoff.jsonl | SILENT | SILENT | OK |

### 4. Independent test run + regression proof (pass 2)

```
Fresh run:  pytest tests/ -v → 72 passed, exit 0
            (2 new tests vs pass 1's 70: silent-on quoted-literal-done.jsonl +
            hyphen-compound-fixed.jsonl fixtures folded into the existing
            parametrized SILENT test, plus 3 new CLAIM_CASES entries folded
            into the existing lexicon unit test — net +2 collected test IDs)
Break:      isHyphenCompound() body replaced with `return false;`
After:      2 FAILED — test_evidence_gate_silent_on_evidenced_or_exempt_sessions
            [hyphen-compound-fixed.jsonl] and
            test_completion_claim_lexicon_excludes_negations_and_questions
            (index 10 mismatch: "fixed-size buffer" case flips True)
Restore:    byte-for-byte from pre-edit copy; md5sum c6675ac6690c2da597148013396a3a43
            (match, confirmed both pre- and post-restore)
Re-run:     pytest tests/ -v → 72 passed, exit 0
```

### 5. Invariants re-confirmed on the changed file

- **No-deny-field**: re-grepped `hooks/lib/evidence.js` for
  `permissionDecision|"decision"|decision:|exit\(2\)` post-fix — 0 matches (clean; the fix touched
  only the claim-lexicon internals, no output-shaping code).
- **Fail-open under quote-parsing stress**: built a fixture with a deliberately malformed mix of
  double quotes, backticks, and an odd total quote count in the final assistant text (stresses
  `findQuotedSpans`' pairing loop). Result: exit 0, no throw, correctly fires on the plain "Done,"
  at sentence start. Re-ran the 4 pass-1 fail-open probes (`transcript_path` as number/object/
  `null`/missing) — all still exit 0.

### 6. Scope

`git status --porcelain` shows the identical file set as pass 1
(`hooks/lib/evidence.js` content changed, `tests/test_evidence_gate.py` content changed, 2 new
fixtures under `tests/fixtures/lh2/`) — no `evidence-gate.js`, `settings-template.json`, or
original-6-fixture changes. `rules/common/coding-style.md` and `CLAUDE-global.md`: `git diff
--stat` empty (untouched). Live `~/.claude/settings.json`: `grep -c evidence-gate` → 0 (no deploy
occurred).

---

## Full Gate Table (final)

| # | Gate | Result |
|:--|:---|:--:|
| 1 | No-deny-field invariant | **PASS** |
| 2 | Fail-open (Hard Rule 1) | **PASS** |
| 3 | Claim-lexicon precision | **PASS** (fixed, pass 2) |
| 4 | Source-edit exclusion | **PASS** |
| 5 | Fresh-evidence correlation | **PASS** |
| 6 | `stop_hook_active` honored | **PASS** |
| 7 | Independent test run + regression proof | **PASS** — 72/72, exit 0 |
| 8 | Scope (Hard Rule 3) | **PASS** |

Pass-1 findings for gates 1, 2, 4, 5, 6, 7, 8 and the Strengths section are unchanged from the
pass-1 report and are not repeated here in full; see git history of this file / `Reports/LH-1-`
style precedent, or the pass-1 evidence already on record in this session for: exhaustive
fail-open probing (11 cases), tool_use_id-keyed evidence correlation (narrated-only and
mismatched-id fixtures), the stale/failing-evidence case, `MultiEdit` inclusion, and the
architecture/deep-module review.

## Residual Items (non-blocking)

- **INFO**: unbalanced/malformed quote spans fall back to normal (unguarded) matching — see §2
  above. Acceptable; flagged for awareness only.
- **INFO** (carried from pass 1): claim-word-to-edit linkage is topic-blind by design (B2's
  trigger is claim-word-anywhere + source-edit-anywhere-in-session) — accepted heuristic
  limitation, not a defect.

## Sign-off

Phase is **deploy-ready** pending explicit user approval. Recommended next steps (not performed by
this audit): `bash scripts/deploy.sh`, live-fire verification (M5), then auditor marks T1/T2/T3/T5
`[x]` in `Artifacts/Plans/LH-2-TODO.md` per TODO authority.
