# Phase OSH-5: Token-Economy Diet & Precedence — Tasks

See `Artifacts/Plans/OSH-5-Plan.md` (canonical-home table is binding). Findings: RU-D*, RU-T*, RU-P*, RU-S2/S4, RU-F11/F12.

## Tasks

- [x] [coder] Create branch `phase-osh-5-token-diet` — Success: no work on main
- [x] [coder] Baseline line counts of the 12 always-loaded files → Artifacts/Temp/osh-5_linecounts.txt — Success: before-snapshot captured
- [x] [coder] standards.md: single Mirroring Rule; merge duplicate communication sections; status vocab → pointer (RU-D5, D7, D8) — Success: no rule lost (zero-loss map entry)
- [x] [coder] orchestration.md: routing → pointer+precedence; command table → pointer; high-rigor → pointer-only; script commands out; scribe grant narrowed; +AUDIT_REPORT row (RU-D1, D2, D9, D10, F11, P3) — Success: no duplicated table remains
- [x] [coder] CLAUDE-global.md: persistence/project-routing/mirroring/learnings → pointers; +Precedence block; architecture map lists 10 rules (RU-D3, D4, D5, D6, P4, P5) — Success: D2/D6 dimensions curable
- [x] [coder] model-routing.md → ~40-line rule; docs → scripts/README.md (RU-T1, RU-S2) — Success: behavioral content complete (tier table, bindings, overrides, hard rules, fallback)
- [x] [coder] `git mv` high-rigor-engineering.md → skills/high-rigor-engineering/SKILL.md + frontmatter + precedence header; register; drop footer (RU-T2, RU-P2, RU-S2) — Success: loads on-demand; absent from rules/
- [x] [coder] TOKEN-ECONOMICS.md trim (RU-T3) — Success: actionable content only
- [x] [coder] Zero-loss map: every deleted block → canonical home, block-by-block → Artifacts/Temp/osh-5_zeroloss.txt — Success: complete mapping
- [x] [auditor] Run `/claude-md CLAUDE-global.md` + `/claude-md CLAUDE.md` — Success: ≥10/12 no zeros; repo stays 12/12
- [x] [coder] After line counts: total ≤ ~1,300 — Success: ~30% reduction evidenced
- [x] [coder] Deploy; verify ~/.claude/rules/ excludes high-rigor; skill deployed — Success: validation passes
- [x] [auditor] Verify zero-loss hard rule against the map; mark `[x]` — Success: PASS

## Status

- [x] Strategist approval (Step 0 — user accepted 2026-07-07)
- [x] Git branch created (`phase-osh-5-token-diet`, 2026-07-07)
- [x] Implementation complete
- [x] Auditor verification complete — Content Gate PASS (AUDIT_REPORT.md §OSH-5), commit `9174be5`, deploy verified live
- [ ] Merge `phase-osh-5-token-diet` → `main` and delete branch — NOT done; requires explicit user approval per orchestration.md merge-requirement (auditor does not self-authorize merges)
