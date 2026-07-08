# LH-3 Plan — Deploy-Guard + Telemetry + Doc-Sync (Terminal)

**Initiative:** LH — Loop Hardening · **Owner:** strategist · **Implementer:** coder (+ scribe for doc-sync) · **Gate:** auditor
**Depends on:** LH-1 + LH-2 merged + deployed (both done 2026-07-08)
**Branch:** `phase-lh-3-telemetry-prose`
**Re-scoped 2026-07-08** after recon (see DECISION_LOG): the original prose-split payoff measured
~1 safely-removable line (not ≥20), and telemetry's data source doesn't hold gate decisions.
Prose-split + `gemini-only.md` + registry-audit drift checks **DROPPED**. See §Cut.

## Purpose

Close the initiative on its two real wins: (1) make hook-enforcement **safe to rely on** — a
deploy that leaves an enforced rule's hook unwired FAILs instead of silently shipping a dead
gate (the exact gap hit manually in LH-1 and LH-2); (2) make the gates **observable** — hooks
log their own fire/deny decisions, surfaced at `/handoff`. Plus a correctness doc-sync.

## Binding decisions (recon + re-scope — coder does not re-litigate)

| # | Decision | Evidence |
|:--|:---|:---|
| B1 | **Telemetry needs hook instrumentation first.** `audit_trail.jsonl` records `{ts,session,tool,input}` = tool invocations, NOT hook decisions; denied actions produce NO entry (blocked pre-exec, PostToolUse never fires). So hooks must emit their own decision events. | `audit-trail.js` + live trail sample, 2026-07-08 |
| B2 | **Prose-split DROPPED.** Delete-eligible prose (hard-blocking hooks only) = commit-trailer (`standards.md:128`, 1 line) + scratch-gate (`orchestration.md` §Scratch Strategy, ~3 lines but only *partially* hook-enforced — the hook doesn't enforce the positive "MUST use Artifacts/Temp/" rule). Removing ~1 safe line for a new `gemini-only.md` drift surface is a bad trade. | grep measurement 2026-07-08 |
| B3 | **Doc-sync is correctness-only** — fix stale/missing hook descriptions; NOT prose deletion. No always-loaded line-count target (the old M3 ≥20 was never achievable post-grill). | — |
| B4 | Gate-logging must be **fail-open within fail-open**: a logging error is swallowed and NEVER alters a hook's exit code or decision. | Initiative Hard Rule 1 |

## Tasks — Technical Approach

### T1 — Gate telemetry (instrument → read → surface) (coder)
- **T1a — `hooks/lib/gate-log.js`**: one shared helper, `logGateEvent({hook, event, decision, tool, ruleId})`,
  that appends a line to `gate_events.jsonl` next to `audit_trail.jsonl` (reuse `audit-trail.js`'s
  exact path resolution — workspace `Artifacts/.agent/`). Entirely wrapped in try/catch: any
  failure (path, permission, disk) is swallowed silently. It performs its own `fs.appendFileSync`
  (NOT a Claude tool call), so the scratch-gate does not intercept it.
- **T1b — call sites**: each firing hook calls `logGateEvent` at the moment it acts —
  `guard-paths.js` + `guard-commands.js` on deny (`decision:'deny'`); `auto-lint.js`,
  `nudge-handoff.js`, `evidence-gate.js` when they inject (`decision:'nag'`). Log ONLY when the
  hook fires (deny/nag) — not every allow (that duplicates audit_trail as noise). The call must
  sit AFTER the decision is made and be incapable of changing it.
- **T1c — `scripts/gate_telemetry.py`**: parse `gate_events.jsonl` → per-hook fire counts split
  by decision (deny vs nag), last-fired ts, `--since YYYY-MM-DD` (reuse the model_routing_audit
  pattern). Stdlib only, typed, ruff-clean. Table to stdout.
- **T1d — `commands/handoff.md`**: add a step running the telemetry script; include the gate
  summary table in `HANDOFF_BRIEF.md`. This is the consumer ritual (a read-side with no reader
  is just another write-only file).

### T2 — Deploy-guard (coder)
- **T2a — `hooks/enforced-rules.json`**: manifest of the deployed hook layer (source of truth for
  the deploy-guard). One entry per registered hook: `{ rule_id, hook_file, event, matcher,
  blocking }`. Cover all **7** registrations in `settings-template.json` (session-boot,
  guard-paths, guard-commands, auto-lint, audit-trail, nudge-handoff, evidence-gate) with
  `blocking:true` only for the two PreToolUse deny hooks. Enumerate from `settings-template.json`
  — do not hand-list.
- **T2b — `scripts/deploy.sh` new step (before or within step 6 validation)**: for every manifest
  entry, assert (a) `~/.claude/hooks/<hook_file>` exists AND (b) it is referenced in live
  `~/.claude/settings.json` under the declared `event`. Any miss = deploy **FAIL**, non-zero exit,
  naming the specific rule_id + what's missing. This is the guardrail that makes enforcement
  trustworthy. Keep it fail-CLOSED (deploy should abort) — this is a deploy gate, not a runtime
  hook, so the fail-open rule does NOT apply here; a deploy that can't verify wiring must stop.

### T3 — Doc-sync (scribe) — correctness only, NO deletion
- Fix `CLAUDE-global.md` hooks table: `auto-lint.js` description "report-only, no auto-fix" →
  reflects the LH-1 fix-before-proceeding directive; ADD rows for `nudge-handoff.js` (Stop
  handoff nudge) and `evidence-gate.js` (Stop evidence gate) — both currently undocumented there.
- Fix `coding-style.md` auto-lint "report-only" mention (carried from LH-1 T1 note / LH-3 §T3b).
- Update `hooks/README.md` to describe the LH hooks (guard-paths scratch-gate, commit-trailer,
  nudge-handoff, evidence-gate, gate-log) so it no longer understates the layer.

## Cut (was in the original LH-3 plan)

- **Prose-split** (Claude pointer + full text move) — dropped (B2).
- **`rules/gemini-only.md`** — not created (no drift surface introduced).
- **`/registry-audit` extension** for manifest↔gemini-only.md↔pointer 1:1 — dropped (nothing to
  audit without the split). The `enforced-rules.json`↔hooks check lives in T2b's deploy-guard instead.

## Success Metrics (auditor gate)

| # | Metric |
|:--|:---|
| M1 | Deploy FAILs (non-zero, names the rule) when a manifest hook is absent from `~/.claude/hooks/` OR unreferenced in live settings — proven by a simulated-missing test |
| M2 | `gate_telemetry.py` produces correct per-hook deny/nag counts on a fixture `gate_events.jsonl` (test); `/handoff` brief includes the table |
| M3 | `CLAUDE-global.md` hooks table accurately describes all 7 deployed hooks (auto-lint corrected; nudge-handoff + evidence-gate rows added — table currently lists 5) |
| M4 | Every instrumented hook still fails open on forced crash (test); gate-logging disabled/broken leaves each hook's decision + exit code byte-identical (test proves logging can't alter behavior) |
| M5 | `pytest tests/ -v` exit 0; `bash scripts/deploy.sh` passes its own new guard end-to-end |

## Hard Rules (phase-local, plus initiative rules 1–4)

1. Gate-logging is fail-open within fail-open — a logging error NEVER changes a hook's exit code or decision.
2. The deploy-guard fails CLOSED and names the missing rule — a wiring gap must stop the deploy, never pass silently.
3. No prose deleted this phase — doc-sync corrects stale/missing text only (a removed line must be a factual correction, not a coverage cut).
