# LH-2 TODO — Evidence Gate

**Plan:** `Artifacts/Plans/LH-2-Plan.md` · **Branch:** `phase-lh-2-evidence-gate`
**Unblocked:** LH-1 shipped 2026-07-08. Design Fork resolved to **Branch B (evidence-nag)** from the spike — LH-2 is kickoff-ready.

- [x] [strategist] T0 — Resolve Design Fork from spike verdict — DONE 2026-07-08: resolved to Branch B (additionalContext nag, no hard block); spike proved all hard-block variants hang/blank the turn. `LH-2-Plan.md` §Design Fork + B1 updated.
- [-] [coder] T3 — Author 6 fixture transcripts (`tests/fixtures/lh2/`) + failing tests first (TDD) — Success: tests exist, fail against a stub
- [-] [coder] T1 — Detection core `hooks/lib/evidence.js` (claim / source-edit / fresh-evidence, pure functions) — Success: fixtures 1–6 produce specified results
- [-] [coder] T2 — Hook wrapper `hooks/evidence-gate.js` (Branch B: additionalContext nag only, never a deny field; respect `stop_hook_active`; model on `nudge-handoff.js`) — Success: end-to-end fixture run correct; emits no deny field; forced-crash exits 0
- [~] [coder] T4 — Loop-breaker — DESCOPED (Branch A only; fork resolved to B, no hard block to break out of)
- [-] [coder] T5 — Register Stop hook in `settings-template.json` (deploy NOT run — gated on user approval after audit) — Success: `bash scripts/deploy.sh` passes; live settings carry the entry
- [ ] [auditor] Gate LH-2 — verify M1–M5 per Plan; live-fire a seeded unevidenced claim; write `Artifacts/Reports/LH-2-Report.md` — Success: all tasks `[x]`, live-fire evidence captured
