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
| B1 | **Design branches on the LH-1 spike verdict** (see §Design Fork). Do not assume Stop can block until the verdict says so. |
| B2 | **Trigger requires BOTH**: a completion claim in the final assistant text AND source edits earlier in the session. Either alone must not fire (doc-only sessions, conversational answers, `/handoff` turns are exempt by construction). |
| B3 | **TODO-authority enforcement is out of scope** — killed at grill (no caller identity in hook input). Do not resurrect via heuristics here. |
| B4 | Fail-open on script error; blocking (if available) reserved for the evaluated condition. |

## Design Fork (resolved by spike verdict — record choice in this file at kickoff)

- **Branch A — spike proves Stop can deny turn-end:** `evidence-gate.js` denies the stop
  with reason: `"IRON LAW: completion claimed without fresh test evidence. Run the relevant
  tests and report the output, or retract/qualify the claim."` Requires a self-built
  loop-breaker (T4) since no `stop_hook_active` flag is documented.
- **Branch B — Stop is feedback-only:** same detection, but inject `additionalContext` with
  the identical message. No loop-breaker needed (nothing blocks).
- Either branch ships the same detection core (T1) — the fork is wrapper-deep only.

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
- Stop event. Reads transcript, applies T1 logic, emits per the resolved Design Fork branch.
- Message must name the exact unblock condition (Hard Rule 2) and the claim text it matched
  (first 120 chars) so the model knows what triggered it.

### T3 — Fixture suite (coder, with T1/T2 — TDD: fixtures first)
Fixture transcripts under `tests/fixtures/lh2/`:
1. unevidenced-done (source edits + "done", no test run) → FIRES
2. evidenced-done (source edits + passing pytest after last edit) → silent
3. stale-evidence (tests passed, then more source edits, then "done") → FIRES
4. doc-only session ("done" but only .md/Artifacts edits) → silent
5. conversational ("here's how X works", no edits) → silent
6. handoff turn (`/handoff` present) → silent

### T4 — Loop-breaker (coder — Branch A only)
- Marker file in scratchpad keyed by `prompt_id`: max 2 denies per prompt, then allow with a
  logged concession line. Prevents infinite stop-block if the model cannot satisfy the gate.

### T5 — Deploy + live verification (coder → auditor)
- `settings-template.json` + live settings gain the Stop hook entry; `bash scripts/deploy.sh`
  passes; live-fire verified in a real session (seeded unevidenced claim).

## Success Metrics (auditor gate)

| # | Metric |
|:--|:---|
| M1 | All 6 fixtures produce the specified fire/silent result — `pytest tests/ -v` exit 0 |
| M2 | Branch A only: 3rd consecutive deny for same prompt_id allows + logs concession (test) |
| M3 | Forced-crash test exits 0 (fail-open) |
| M4 | Design Fork section of this file updated with the chosen branch + spike citation before coder starts (strategist) |
| M5 | Live-fire evidence captured in `Artifacts/Reports/LH-2-Report.md` |

## Hard Rules (phase-local, plus initiative rules 1–4)

1. The gate must NEVER fire on a turn with no completion claim — silence is the default.
2. Branch A: a deny without a reachable unblock path is a wedge — the loop-breaker is not optional.
3. Claim-lexicon changes require re-running the full fixture suite (no tuning by eyeball).
