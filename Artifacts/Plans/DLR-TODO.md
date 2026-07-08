# DLR TODO — DECISION_LOG Rotation

**Plan:** `Artifacts/Plans/DLR-Plan.md` · **Branch:** `phase-dlr-decision-log-rotation`

- [ ] [coder] T1 — Add DECISION_LOG Rotation policy to `rules/common/orchestration.md` (threshold >400 lines OR >40 entries; oldest resolved → `History/DECISION_LOG-archive.md` newest-first; never delete; unresolved never rotate; trigger = concierge at `/handoff`) + update DECISION_LOG persistence-table row — Success: M1
- [ ] [coder] T2 — Add newest-first/head read-discipline for DECISION_LOG to `commands/sync.md` (Step 4) + `commands/handoff.md` (Step 3, incl. rotation check) — Success: M2
- [ ] [coder] T3 — Create `Artifacts/History/DECISION_LOG-archive.md` (header + back-pointer, no entries) + forward-pointer atop `Artifacts/DECISION_LOG.md`; do NOT move the 11 under-threshold entries — Success: M3
- [ ] [auditor] T4 — Gate M1–M4; `bash scripts/deploy.sh` (deploy-guard + 105 tests); merge ff to `main` — Success: all tasks `[x]`, deployed, initiative closed
