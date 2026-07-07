# Phase OSH-2: Fix Broken Gates & Capability Mismatches — Tasks

See `Artifacts/Plans/OSH-2-Plan.md`. Findings: AUDIT_REPORT.md §2 (AG-*) + §3 (CM subset).

## Tasks

- [ ] [coder] Create branch `phase-osh-2-agent-gates` — Success: no work on main
- [ ] [coder] auditor.md: tools +Edit,Write; drop "Read-only"; visual-auditor → auditor+visual-composition; geometry path; scribe-dispatch fix; csharp-grasshopper fix; delete fragment; severity → pointer (AG-1,3,4,6,7,14,16) — Success: grep matrix clean for this file; YAML valid
- [ ] [coder] council.md + abstract: +Write,Edit; authority reworded to consensus-recommendation (AG-2, AG-8) — Success: no "final architectural authority" claim remains
- [ ] [coder] coder.md: geometry path; subagent_type coder (AG-4, AG-17) — Success: grep clean
- [ ] [coder] strategist.md: +Edit; PLAN.md → IMPLEMENTATION_PLAN.md; business-analyst "when available" (AG-5, AG-13, AG-11) — Success: description names real file
- [ ] [coder] scribe.md: +Edit; README exception (AG-13, AG-20) — Success: rule + exception co-located
- [ ] [coder] concierge.md + abstract: +Edit; +/clean,/graduate; delete fragment; abstract → learnings/ (AG-13, AG-10, AG-14, AG-9) — Success: owned commands = 6
- [ ] [coder] creative-director.md: +Edit (AG-13) — Success: tool list updated
- [ ] [coder] geometry-validator.md: explicit resources path; split IsSolid/IsManifold checks (AG-19) — Success: two distinct invariants named
- [ ] [coder] agents.overview.md: relative links (AG-15) — Success: zero file:/// URIs
- [ ] [coder] commands/audit.md: Action Items → AUDIT_REPORT+BACKLOG; dispatch fix; skill fix; delete stale registry section (CM-1, CM-11, CM-6, CM-19) — Success: no TODO-write instruction remains
- [ ] [coder] commands/script.md + pack.md: Artifacts/SCRIPT.md + Artifacts/METADATA.md; /review → /audit (CM-3, CM-25) — Success: /pack precondition == /script output
- [ ] [coder] commands/registry-audit.md + snapshot.md: global_workflows out; CLAUDE-global in; report → Artifacts/; tool names (CM-8, CM-12) — Success: grep clean
- [ ] [coder] commands/deck.md: insert `### /deck audit [--team]` heading (CM-7) — Success: 3 action headings present
- [ ] [coder] business-analyst SKILL.md:111 csharp-grasshopper fix (AG-7) — Success: grep clean
- [ ] [coder] Run verification grep matrix (plan §Verification); save to Artifacts/Temp/osh-2_verify.txt — Success: all 0-hit
- [ ] [coder] Deploy (`bash scripts/deploy.sh`) — Success: 6-step validation passes
- [ ] [auditor] Verify hard rules (no authority change, surgical scope, refs exist); mark phase `[x]` — Success: PASS

## Status

- [x] Strategist approval (Step 0 — user accepted 2026-07-07)
- [ ] Git branch created
- [ ] Implementation complete
- [ ] Auditor verification complete
