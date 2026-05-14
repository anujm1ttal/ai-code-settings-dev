# TODO: Anthropic Patterns Adoption

## Phase 1 — Quick Wins

- [/] [coder] **Action 1**: Expand skill descriptions with trigger keywords — Success: all 18 skills have ≥40-word descriptions
  - [/] `systematic-debugging`
  - [/] `verification-gate`
  - [/] `implementation-dispatch`
  - [/] `project-planner`
  - [/] `project-journal`
  - [/] `doc-updater`
  - [/] `banana-prompt`
  - [/] `typescript-mcp`
- [x] [coder] **Action 1**: Expand skill descriptions with trigger keywords — Success: all 18 skills have ≥40-word descriptions
  - [x] `systematic-debugging`
  - [x] `verification-gate`
  - [x] `implementation-dispatch`
  - [x] `project-planner`
  - [x] `project-journal`
  - [x] `doc-updater`
  - [x] `banana-prompt`
  - [x] `typescript-mcp`
  - [x] `python-patterns`
  - [x] `rhino-unit-testing`
  - [x] `rhino-e2e-testing`
  - [x] `cd-foundations`
  - [x] `powerbi-report`
  - [x] `visual-composition`
  - [x] `youtube-retention`
  - [x] `youtube-scriptwriting`
  - [x] `youtube-strategy`
  - [x] `dax-modeling`
- [x] [coder] **Action 3**: Add "Assume Bugs Exist" framing to auditor — Success: `agents/auditor.md` contains adversarial QA section + subagent visual QA rule
- [x] [coder] **Action 8**: Merge `powerpoint-patterns` into `pptx`, then delete — Success: zero references to `powerpoint-patterns` across all registry files
  - [x] Create `skills/pptx/references/python-pptx-patterns.md` with migrated content
  - [x] Add pointer in `skills/pptx/SKILL.md` to reference file
  - [x] Delete `skills/powerpoint-patterns/` directory
  - [x] Update `skills/skills.overview.md` — remove old row, add `pptx`, `docx`, `xlsx`
  - [x] Update `GEMINI.md` — remove `powerpoint-patterns`, add document skills to routing
  - [x] Update `CLAUDE.md` — same changes as GEMINI.md

## Phase 2 — Structural Improvements

- [x] [coder] **Action 2**: Adopt progressive disclosure (L3 `references/`) — Success: heavy skills have SKILL.md <500 lines with reference files split out
  - [x] `python-rhino-grasshopper` → split API reference
  - [x] `typescript-mcp` → split Zod patterns
  - [x] `dax-modeling` → split DAX function reference
- [x] [coder] **Action 5**: Ship anti-slop patterns in `visual-composition` — Success: skill contains banned fonts, banned layouts, concrete palettes, typography pairings
  - [x] Add `## Anti-Slop Deny List` section
  - [x] Add `## Concrete Palette Options` section (5-10 named palettes)
  - [x] Add `## Typography Pairings` section (5+ pairings)
- [x] [coder] **Action 6**: Add decision trees to routing-heavy skills — Success: 3 skills have ASCII decision trees with no dead ends
  - [x] `systematic-debugging` — bug type routing tree
  - [x] `rhino-e2e-testing` — test lane selection tree
  - [x] `verification-gate` — evidence type routing tree

## Phase 3 — Advanced Patterns

- [x] [coder] **Action 4**: Bundle reusable scripts with `--help` interfaces — Success: ≥3 skills have `scripts/` directories with `--help`-documented tools
  - [x] `verification-gate/scripts/evidence_checker.py`
  - [x] `rhino-e2e-testing/scripts/run_headless.py`
  - [x] Inventory existing `pptx/scripts/` for `--help` compliance
- [x] [coder] **Action 7**: Reader-testing pattern for plan/doc verification — Success: auditor.md has clean-room review section, `/audit --reader-test` flag documented
  - [x] Add `## Clean-Room Document Review` section to `agents/auditor.md`
  - [x] Add `--reader-test` flag to `commands/audit.md`

## Post-Implementation

- [x] [auditor] Run `/registry-audit` to verify zero drift
- [x] [auditor] Verify all SKILL.md description lengths ≥40 words
- [x] [auditor] Verify zero references to `powerpoint-patterns` in registry
- [x] [coder] Git commit with message: "feat: adopt Anthropic skill patterns — descriptions, L3, anti-slop, decision trees, auditor hardening"
