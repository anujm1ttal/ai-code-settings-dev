# LH-2 Plan — Evidence Gate (Iron Law Mechanized)

**Initiative:** LH — Loop Hardening · **Owner:** strategist · **Implementer:** coder · **Gate:** auditor
**Status:** BLOCKED until LH-1 T5 spike verdict is filed (`Artifacts/Reports/LH-1-stop-spike.md`)
**Branch:** `phase-lh-2-evidence-gate` (cut from `main` after LH-1 merges)

## Purpose

Mechanize `verification-gate`'s Iron Law — *evidence before assertions* — at the Stop
boundary: a turn that claims completion without fresh test evidence gets challenged by the
harness, not by a rule the model may skip.

## Binding decisions (carried from grill — coder does not re-litigate)

| # | Decision |
|:--|:---|
| B1 | **Fork RESOLVED by the LH-1 spike (2026-07-08) → Branch B (evidence-nag).** The spike (`Reports/LH-1-stop-spike.md`) proved Stop *can* block, but every hard-block variant is unsafe/broken in this runtime (see §Design Fork). Ship the `additionalContext` nag; do NOT build a hard gate. Branch A stays documented only as a conditional future path behind a follow-up spike. |
| B2 | **Trigger requires BOTH**: a completion claim in the final assistant text AND source edits earlier in the session. Either alone must not fire (doc-only sessions, conversational answers, `/handoff` turns are exempt by construction). |
| B3 | **TODO-authority enforcement is out of scope** — killed at grill (no caller identity in hook input). Do not resurrect via heuristics here. |
| B4 | Fail-open on script error; blocking (if available) reserved for the evaluated condition. |

## Design Fork — RESOLVED to Branch B (LH-1 spike, 2026-07-08)

The LH-1 T5 spike (`Artifacts/Reports/LH-1-stop-spike.md`) ran all three Stop variants
empirically. It overturned the planning assumption (old B5: "`additionalContext` is
feedback-only, no blocking power") — **all three variants blocked turn-end and forced Stop
re-invocation**. But blocking is not the win it looked like:

| Variant | Blocks? | Why it's unusable as a hard gate |
|:--|:--|:--|
| (a) `exit 2` + stderr | Yes, most aggressively | **No observed ceiling** — never self-resolved in 55s, had to be SIGTERM'd. Unbounded-hang risk on a live session. |
| (b) stdout `decision:block` | Yes, ~9-attempt ceiling | Harness give-up path produced **`result:""`** — empty final assistant output. Broken UX for a documented-adjacent mechanism. |
| (c) `additionalContext`-only | Yes, in practice (~9 re-invokes) | **Not the documented mechanism** (schema has no deny field) — a fragile side effect of block-styled text; the model narrated its own confusion. |

**→ Chosen: Branch B (evidence-nag).** `evidence-gate.js` injects `additionalContext` with the
Iron-Law message when the trigger fires; it never attempts a hard block. Rationale: the only
variant with both a bounded ceiling and a JSON contract (b) still returns broken empty output,
and (a) can hang a session. A soft, reliable nag beats a hard gate that wedges or blanks the
turn. This aligns with initiative Hard Rule 2 (a deny without a reachable, clean unblock path
is a wedge — none of the hard-block variants clear that bar today).

**Message (Branch B):** `"IRON LAW (verification-gate): a completion claim was made without
fresh test evidence this session. Run the relevant tests/lint and report the output, or
retract/qualify the claim before ending the turn."` (matched claim text appended, per T2.)

**Branch A (hard gate) — DEFERRED, conditional revival only.** Revisit ONLY if a follow-up
spike shows variant (b) `decision:block` producing clean, non-empty completions *while honoring
`stop_hook_active`*. Correction to the earlier plan text: the harness **does** pass a
`stop_hook_active` field on the Stop event (documented anti-infinite-loop contract) — the spike
hooks ignored it deliberately to measure the raw ceiling. So a future Branch A would honor that
flag to block **at most once per Stop chain**, NOT a self-built marker file. File the follow-up
spike to BACKLOG if Branch A is ever wanted; it is out of LH-2 scope.

Both branches share the same detection core (T1) — the resolution is wrapper-deep, so LH-2's
substantive work (detection + fixtures) is unaffected by the choice.

## Tasks — Technical Approach

### T1 — Detection core: `hooks/lib/evidence.js` (coder) — pure functions, Lane B testable
- `hasCompletionClaim(finalText)`: claim lexicon regex (done / complete(d) / fixed /
  finished / passing / "all tests pass" / "works now"), case-insensitive, tuned against the
  T3 fixture suite. Negations ("not done", "almost done") and questions must not match.
- `hasSourceEdits(transcript)`: Edit/Write/NotebookEdit tool calls targeting source
  extensions (`.py .ts .js .cs .yaml .json .sh` + hooks/scripts paths). Excludes
  `Artifacts/**`, `**/*.md`, scratchpad/temp paths — doc/state work is not "source".
- `hasFreshEvidence(transcript)`: a Bash/PowerShell tool result AFTER the last source edit
  whose command matches a test/lint runner (`pytest`, `npm test`, `ruff`, `deploy.sh`, …)
  and whose output indicates success (exit 0 / passing summary). Freshness = ordering, not
  wall-clock (no Date.now in fixtures).
- All three operate on parsed `transcript_path` JSONL. No network, no git calls.

### T2 — Hook wrapper: `hooks/evidence-gate.js` (coder)
- Stop event. Reads transcript, applies T1 logic; on trigger emits the Branch B
  `additionalContext` nag (§Design Fork). **Never emits a deny/block field** — additionalContext
  only, exit 0 always. Model the plumbing on the shipped `nudge-handoff.js` (LH-1 T4): same
  Stop-event, feedback-only, rate-limit shape.
- Message must name the exact unblock condition (Hard Rule 2) and the claim text it matched
  (first 120 chars) so the model knows what triggered it.
- Read and respect `stop_hook_active` — if already set, do NOT re-nag (avoids piling context on
  a Stop chain the harness is already retrying).

### T3 — Fixture suite (coder, with T1/T2 — TDD: fixtures first)
Fixture transcripts under `tests/fixtures/lh2/`:
1. unevidenced-done (source edits + "done", no test run) → FIRES
2. evidenced-done (source edits + passing pytest after last edit) → silent
3. stale-evidence (tests passed, then more source edits, then "done") → FIRES
4. doc-only session ("done" but only .md/Artifacts edits) → silent
5. conversational ("here's how X works", no edits) → silent
6. handoff turn (`/handoff` present) → silent

### T4 — Loop-breaker — DESCOPED (Branch A only; fork resolved to B)
- Not built. No hard block ships, so there is nothing to break out of. Retained here only as
  the design note for a future conditional Branch A: honor `stop_hook_active` (harness-provided)
  to block at most once per Stop chain — do NOT reintroduce a self-built marker-file scheme.

### T5 — Deploy + live verification (coder → auditor)
- `settings-template.json` + live settings gain the Stop hook entry; `bash scripts/deploy.sh`
  passes; live-fire verified in a real session (seeded unevidenced claim).

## Success Metrics (auditor gate)

| # | Metric |
|:--|:---|
| M1 | All 6 fixtures produce the specified fire/silent result — `pytest tests/ -v` exit 0 |
| M2 | N/A — Branch A descoped (fork resolved to B). No loop-breaker to test. |
| M3 | Forced-crash test exits 0 (fail-open); gate emits additionalContext only, never a deny field (test) |
| M4 | ✅ Done 2026-07-08 — Design Fork resolved to Branch B with spike citation (this edit, pre-kickoff) |
| M5 | Live-fire evidence captured in `Artifacts/Reports/LH-2-Report.md` |

## Hard Rules (phase-local, plus initiative rules 1–4)

1. The gate must NEVER fire on a turn with no completion claim — silence is the default.
2. The gate emits `additionalContext` only — it MUST NOT emit a deny/block field or `exit 2`
   (the spike proved all three hard-block variants either hang or blank the turn).
3. Claim-lexicon changes require re-running the full fixture suite (no tuning by eyeball).
