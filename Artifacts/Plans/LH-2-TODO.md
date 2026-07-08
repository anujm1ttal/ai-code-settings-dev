# LH-2 TODO — Evidence Gate

**Plan:** `Artifacts/Plans/LH-2-Plan.md` · **Branch:** `phase-lh-2-evidence-gate`
**BLOCKED until:** `Artifacts/Reports/LH-1-stop-spike.md` verdict filed (LH-1 T5)

- [ ] [strategist] T0 — Resolve Design Fork from spike verdict; record Branch A/B choice + citation in `LH-2-Plan.md` §Design Fork — Success: plan updated before any coder work
- [ ] [coder] T3 — Author 6 fixture transcripts (`tests/fixtures/lh2/`) + failing tests first (TDD) — Success: tests exist, fail against a stub
- [ ] [coder] T1 — Detection core `hooks/lib/evidence.js` (claim / source-edit / fresh-evidence, pure functions) — Success: fixtures 1–6 produce specified results
- [ ] [coder] T2 — Hook wrapper `hooks/evidence-gate.js` per resolved branch (deny reason names claim + unblock condition) — Success: end-to-end fixture run correct; forced-crash exits 0
- [ ] [coder] T4 — Loop-breaker (Branch A only): max 2 denies per prompt_id, then allow + log — Success: 3rd deny allows with concession line (test)
- [ ] [coder] T5 — Register Stop hook in `settings-template.json`; deploy — Success: `bash scripts/deploy.sh` passes; live settings carry the entry
- [ ] [auditor] Gate LH-2 — verify M1–M5 per Plan; live-fire a seeded unevidenced claim; write `Artifacts/Reports/LH-2-Report.md` — Success: all tasks `[x]`, live-fire evidence captured
