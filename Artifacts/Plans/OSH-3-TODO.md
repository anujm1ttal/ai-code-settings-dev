# Phase OSH-3: One Name for Every State File — Tasks

See `Artifacts/Plans/OSH-3-Plan.md` (canonical-decisions table is binding). Findings: RU-F1..F5, F9, F10; CM-4, CM-15, CM-20; TL-H5; RU-S3 (partial).

## Tasks

- [ ] [coder] Create branch `phase-osh-3-naming-unification` — Success: no work on main
- [ ] [coder] orchestration.md: learnings/ ×3, History/ casing ×4, archive naming, Approval Rubric, /handoff destination, GLOBAL_INBOX path (RU-F1, F4, F9, F10, RU-S3) — Success: file-local grep clean
- [ ] [coder] TOKEN-ECONOMICS.md: Finding Protocol → BACKLOG.md + /handoff; header typo (RU-F2, RU-F12) — Success: no findings.md/sync-promotion claims
- [ ] [coder] CLAUDE-global.md: DECISION_LOG → Root Files; history casing (RU-F3, RU-F4) — Success: archive section clean
- [ ] [coder] CLAUDE.md:65 casing (RU-F4) — Success: History/
- [ ] [coder] learn.md: frontmatter learnings/; machine path removed (CM-4, CM-20) — Success: picker text names real registry
- [ ] [coder] handoff.md: History/Plans|Reports scheme, keep-names; brief-at-root clarified (CM-15, RU-F10) — Success: matches CLAUDE-global layout
- [ ] [coder] coding-style.md: relative testing-strategy link (RU-S3) — Success: no file:/// URI
- [ ] [coder] `git mv` history/ → History/Plans/ (two-step for NTFS); verify single casing (TL-H5) — Success: `git ls-files | grep -i history` single-cased
- [ ] [coder] Verify security.md + session-boot.js + concierge.abstract already-consistent (no edit) — Success: confirmed in evidence file
- [ ] [coder] Run grep matrix → Artifacts/Temp/osh-3_verify.txt — Success: all zero
- [ ] [coder] Deploy — Success: validation passes
- [ ] [auditor] Verify names-only hard rule on the diff; mark `[x]` — Success: PASS

## Status

> **Coder status (2026-07-07):** naming unified + verified. Final grep matrix all zero
> (LEARNINGS.md, findings.md, lowercase Artifacts/history/, "Approval Label Rubric", hardcoded
> machine paths). DECISION_LOG moved to Root Files (out of Archive) in CLAUDE-global. `git mv`
> collapsed the history casing collision — only `Artifacts/History/` tracked now.
> **Scope note:** the repo-wide casing sweep caught 4 files beyond the plan's enumerated list
> (concierge.md, project-journal/SKILL.md, blueprint.md, handoff.md) — all pure RU-F4 casing
> fixes, kept in scope since leaving them would defeat the single-casing goal. session-boot.js
> (learnings path, OSH-1) and security.md (DECISION_LOG root) needed no change. Stacked on OSH-2.

- [x] Strategist approval (Step 0 — user accepted 2026-07-07)
- [x] Git branch created (`phase-osh-3-naming-unification`, stacked on OSH-2)
- [x] Implementation complete (coder) — grep matrix clean; single History/ casing
- [ ] Deployed to `~/.claude/` (deferred with OSH-1/2)
- [ ] Auditor verification complete
