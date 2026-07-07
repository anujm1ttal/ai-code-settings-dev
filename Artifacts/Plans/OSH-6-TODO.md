# Phase OSH-6: Tooling & Repo Hygiene — Tasks

See `Artifacts/Plans/OSH-6-Plan.md`. Findings: TL-*, CM-13 (script half).

## Tasks

- [ ] [coder] Create branch `phase-osh-6-tooling-hygiene` — Success: no work on main
- [ ] [coder] model_router.py: plugin lookup root (or frontmatter-driven); targeted exceptions; type modernization (TL-H1, M9, L7) — Success: `--lookup skill manuscript-review scribe` → sonnet
- [ ] [coder] skill_graph_analyzer.py: honest types, dead code out, unused imports, plugin scan (TL-M7, CM-13) — Success: pyright-strict clean (or documented remainder); plugin skills in output
- [ ] [coder] deploy.sh: no optional_plugins; backup scope + prune 5; --force decision; pytest-hint reachable; vestigial mkdir out (TL-H2, M3, M4, L1, L2) — Success: full run passes; backup <10 MB
- [ ] [user-approval] Delete stale `~/.claude/optional_plugins/` (TL-H2) — Success: explicit approval label
- [ ] [coder] tests/: 4 new test files (router matrix, audit parsing, hooks smoke, registry integrity) (TL-M1) — Success: pytest ≥8 pass exit 0; revert-check proves regression lock
- [ ] [coder] DEPLOY.md + cheatsheet.md + CLAUDE.md refresh (TL-M5, M6, M8) — Success: zero phantom refs; commands runnable as documented
- [ ] [coder] templates: Hard Rules section; README row (TL-L4, L5) — Success: template matches standards.md mandate
- [ ] [coder] .gitattributes for line endings (TL-L6) — Success: repo↔deployed diff empty after normalize
- [ ] [coder] Artifacts sweep: git mv 14 files → History/ (+Plans/ for CMD-Plan); delete task.md + SESSIONS/; git rm --cached Temp file; check NEXT_SESSION content before archiving (TL-H4, M2, L8) — Success: root schema-clean; nothing lost (moves only)
- [ ] [coder] Delete local __pycache__ ghosts (TL-L3) — Success: untracked cruft gone
- [ ] [coder] Full deploy + verification commands (plan §Verification) → Artifacts/Temp/osh-6_verify.txt — Success: all green
- [ ] [auditor] Verify moves-not-deletes + regression-lock hard rules; mark `[x]` — Success: PASS

## Status

- [x] Strategist approval (Step 0 — user accepted 2026-07-07)
- [ ] Git branch created
- [ ] Implementation complete
- [ ] Auditor verification complete
