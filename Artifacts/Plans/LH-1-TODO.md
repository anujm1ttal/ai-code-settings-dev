# LH-1 TODO — Mechanical Hooks + Stop-Block Spike

**Plan:** `Artifacts/Plans/LH-1-Plan.md` · **Branch:** `phase-lh-1-mechanical-hooks`

- [-] [coder] T1 — Upgrade `auto-lint.js` to loud additionalContext feedback (per-extension linter map, 30-line cap, fail-open on missing linter) — Success: seeded `.py` violation injects lint output + directive; clean edit silent; ruff-absent exits 0
- [-] [coder] T2 — Extend `guard-paths.js` with scratch-gate (state basenames under shadow paths; memory/ + tool-results allowlisted) — Success: seeded shadow TODO.md write denied with Artifacts/ reason; memory/MEMORY.md write allowed
- [-] [coder] T3 — Extend `guard-commands.js` with commit-trailer deny (Bash heredoc + PowerShell here-string forms) — Success: both seeded trailer forms denied; trailer-free and prose-"Claude" commits allowed
- [-] [coder] T4 — New `nudge-handoff.js` Stop hook (dirty-tree → /handoff nudge, once per session, never blocks) — Success: dirty stop nudges; clean stop silent; repeat stop silent
- [-] [coder] T5 — Stop-block spike: test exit-2 / decision:block / additionalContext variants empirically — Success: `Artifacts/Reports/LH-1-stop-spike.md` records verdict + transcript evidence for all 3 variants
- [-] [coder] T6 — Extend `tests/` hook suite to cover T1–T4 behaviors + forced-crash fail-open on every touched hook — Success: `pytest tests/ -v` exit 0, new tests fail on reverted hook
- [ ] [auditor] Gate LH-1 — verify all metrics per Plan §Success Metrics; deploy via `bash scripts/deploy.sh` + live `~/.claude/hooks/` verification — Success: all tasks `[x]`, deploy validation passes, spike verdict filed
