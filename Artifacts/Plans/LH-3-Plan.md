# LH-3 Plan — Telemetry Loop + Prose Split (Terminal)

**Initiative:** LH — Loop Hardening · **Owner:** strategist · **Implementer:** coder (+ scribe for prose moves) · **Gate:** auditor
**Depends on:** LH-1 and LH-2 merged + deployed (prose may only replace *verified, deploy-guarded* hooks)
**Branch:** `phase-lh-3-telemetry-prose` (cut from `main` after LH-2 merges)

## Purpose

Close the initiative's two remaining loops: (1) make the write-only `audit_trail.jsonl`
readable so gate behavior is observed, not assumed; (2) collect the token payoff — enforced
prose shrinks to pointers in Claude's always-loaded context, with full text preserved for the
hook-less Gemini consumer in exactly one file.

## Binding decisions (carried from grill — coder does not re-litigate)

| # | Decision |
|:--|:---|
| B1 | **Split by consumer (user override at grill):** Claude context keeps a one-line "enforced by <hook>" pointer; full rule text moves to `rules/gemini-only.md` — ONE file, never a tree (strategist constraint to bound drift). |
| B2 | **Delete-eligible = verified hard-blocking hooks only.** As of planning: commit-trailer (standards.md deny-list bullet) and scratch-gate (orchestration.md Scratch Strategy + shadow-state paragraphs). Evidence-gate prose joins ONLY if LH-2 shipped Branch A (hard deny). Advisory hooks (lint feedback, handoff nudge) earn NO prose deletion — feedback is not enforcement. |
| B3 | **Ordering inside the phase is a hard rule:** deploy-guard (T2) lands and passes BEFORE any prose moves (T3). |
| B4 | Telemetry must have a consumer ritual or it's another write-only artifact — `/handoff` surfaces it (T1b). |

## Tasks — Technical Approach

### T1 — Telemetry read side (coder)
- **T1a** `scripts/gate_telemetry.py`: parse `Artifacts/.agent/audit_trail.jsonl` → per-hook
  fire/allow/deny counts + last-fired timestamp; `--since YYYY-MM-DD` (reuse the
  model_routing_audit pattern); table to stdout. Pure stdlib + repo conventions (3.12,
  typed, ruff-clean).
- **T1b** `commands/handoff.md`: add a step — run the telemetry script, include the gate
  summary table in `HANDOFF_BRIEF.md`. This is the consumer ritual (B4).

### T2 — Deploy-guard: enforced-rules manifest + deploy.sh assertion (coder)
- **T2a** `hooks/enforced-rules.json` — single source of truth mapping each mechanically
  enforced rule: `{ rule_id, prose_pointer (file §), hook_file, event, blocking: true|false }`.
- **T2b** `scripts/deploy.sh` new step: for every manifest entry with `blocking: true`,
  assert the hook file exists in `~/.claude/hooks/` AND is referenced in live
  `~/.claude/settings.json` — any miss = deploy **FAIL** (non-zero exit, named rule in the
  error). This is the guard that makes prose deletion safe.

### T3 — Prose split (scribe, after T2 passes)
- For each `blocking: true` manifest entry: shrink the Claude-side prose to a 1-line
  invariant + `(mechanically enforced: <hook>.js)`; move the full text verbatim into
  `rules/gemini-only.md` under a `## <rule_id>` heading.
- `rules/gemini-only.md` header states its contract: "Rules mechanically enforced for
  Claude Code by hooks; full text retained here for hook-less consumers (Gemini). Claude
  sessions: do not load; pointers live in the owning rule files."
- `GEMINI.md` gains a pointer to the file. Deploy must NOT ship `gemini-only.md` to
  `~/.claude/rules/common/` (it would defeat the token payoff) — deploy.sh exclusion + test.
- Line accounting recorded in `Artifacts/Reports/LH-3-Report.md`: per-rule before/after,
  net always-loaded delta.

### T3b — Doc-sync: stale hook descriptions (scribe, with T3)
- Carried from LH-1 T1: `auto-lint.js` changed from report-only → fix-before-proceeding.
  Update the description in `CLAUDE-global.md` hooks table and the `coding-style.md`
  "report-only, no auto-fix" mention. Not a prose *move* — a correctness fix to stale text.

### T4 — `/registry-audit` extension (coder)
- New checks: every `enforced-rules.json` entry's hook file exists; every `gemini-only.md`
  section maps 1:1 to a manifest entry; every Claude-side pointer targets an existing
  manifest rule_id. Orphans in any direction = FAIL.

### T5 — Tests + deploy (coder → auditor)
- Tests: deploy-guard FAILs when a manifest hook is absent (simulated); telemetry counts
  correct on a fixture jsonl; deploy excludes gemini-only.md; registry-audit catches a
  seeded orphan. `bash scripts/deploy.sh` passes end-to-end.

## Success Metrics (auditor gate)

| # | Metric |
|:--|:---|
| M1 | Deploy FAILs on a removed enforced-by hook, naming the rule (test) |
| M2 | `gate_telemetry.py` produces correct per-gate counts on a fixture (test); `/handoff` brief includes the table |
| M3 | Net always-loaded lines removed ≥ 20, evidenced by per-rule accounting in `LH-3-Report.md` |
| M4 | `rules/gemini-only.md` is the only Gemini-side home; registry-audit passes; deploy excludes it (test) |
| M5 | Zero-loss check: every moved rule's full text survives verbatim in gemini-only.md (diff evidence, OSH-5 discipline) |
| M6 | `pytest tests/ -v` exit 0; deploy 6+ step validation passes |

## Hard Rules (phase-local, plus initiative rules 1–4)

1. T3 may not start until T2's deploy-guard is merged and passing (B3) — sequencing violation = automatic FAIL.
2. No advisory-hook prose may be deleted (B2) — feedback is not enforcement.
3. Zero behavioral loss on every prose move (OSH-5 standard: block map + verbatim survival evidence).
