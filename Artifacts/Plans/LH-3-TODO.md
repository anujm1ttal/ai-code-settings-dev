# LH-3 TODO — Deploy-Guard + Telemetry + Doc-Sync (Terminal)

**Plan:** `Artifacts/Plans/LH-3-Plan.md` · **Branch:** `phase-lh-3-telemetry-prose`
**Re-scoped 2026-07-08:** prose-split + gemini-only.md + registry-audit DROPPED (see plan §Cut / DECISION_LOG).

- [-] [coder] T2a — `hooks/enforced-rules.json` manifest (all 7 hooks per settings-template.json; rule_id, hook_file, event, matcher, blocking) — Success: valid JSON, one entry per deployed hook, blocking:true only for the 2 PreToolUse deny hooks
- [-] [coder] T2b — deploy.sh guard: each manifest hook present in `~/.claude/hooks/` AND referenced in live settings for its event, else FAIL naming the rule (fail-CLOSED) — Success: simulated missing hook FAILs deploy naming the rule (test)
- [-] [coder] T1a — `hooks/lib/gate-log.js` shared helper (append to `gate_events.jsonl`, fully try/catch-swallowed) — Success: logs an event; forced write-failure returns silently, never throws
- [-] [coder] T1b — Call `logGateEvent` at the fire point in guard-paths, guard-commands (deny), auto-lint, nudge-handoff, evidence-gate (nag) — Success: each hook logs only when it fires; decision + exit code unchanged with logging broken (test)
- [-] [coder] T1c — `scripts/gate_telemetry.py` (per-hook deny/nag counts, `--since`, fixture-tested) — Success: correct counts on fixture `gate_events.jsonl`
- [-] [coder] T1d — `commands/handoff.md` gains telemetry step; brief includes gate table — Success: /handoff output contains per-gate counts
- [ ] [scribe] T3 — Doc-sync: CLAUDE-global hooks table (fix auto-lint, add nudge-handoff + evidence-gate); coding-style.md auto-lint mention; hooks/README.md — Success: table describes all 7 deployed hooks accurately; correctness-only, zero coverage cut
- [-] [coder] T5 — Test suite for M1–M4 + fail-open on every instrumented hook — Success: `pytest tests/ -v` exit 0
- [ ] [auditor] Gate LH-3 (initiative-terminal) — verify M1–M5; deploy via deploy.sh (exercises the new guard); write `Artifacts/Reports/LH-3-Report.md` — Success: all tasks `[x]`, initiative closed
