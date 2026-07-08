# LH-3 TODO — Telemetry Loop + Prose Split

**Plan:** `Artifacts/Plans/LH-3-Plan.md` · **Branch:** `phase-lh-3-telemetry-prose`
**BLOCKED until:** LH-1 and LH-2 merged + deployed

- [ ] [coder] T2a — `hooks/enforced-rules.json` manifest (rule_id, prose_pointer, hook_file, event, blocking flag) — Success: covers commit-trailer + scratch-gate (+ evidence-gate iff LH-2 Branch A); validates against T4 checks
- [ ] [coder] T2b — deploy.sh assertion step: blocking-rule hooks present in `~/.claude/hooks/` + referenced in live settings, else FAIL — Success: simulated missing hook FAILs deploy naming the rule (test)
- [ ] [coder] T1a — `scripts/gate_telemetry.py` (per-hook fire/allow/deny counts, `--since`, fixture-tested) — Success: correct counts on fixture jsonl (test)
- [ ] [coder] T1b — `commands/handoff.md` gains telemetry step; brief includes gate table — Success: /handoff output contains per-gate counts
- [ ] [coder] T4 — Extend `/registry-audit`: manifest ↔ hooks ↔ gemini-only.md ↔ pointers 1:1, orphans FAIL — Success: seeded orphan caught (test)
- [ ] [scribe] T3 — Prose split per manifest (1-line pointer Claude-side; verbatim text → single `rules/gemini-only.md`; GEMINI.md pointer; deploy excludes the file) — Success: net always-loaded lines removed ≥ 20; zero-loss diff evidence per rule — **BLOCKED until T2b `[x]`**
- [ ] [coder] T5 — Test suite for M1–M4 + deploy exclusion — Success: `pytest tests/ -v` exit 0
- [ ] [auditor] Gate LH-3 (initiative-terminal) — verify M1–M6; write `Artifacts/Reports/LH-3-Report.md` with line accounting; confirm deploy end-to-end — Success: all tasks `[x]`, initiative closed
