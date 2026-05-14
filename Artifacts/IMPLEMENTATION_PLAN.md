# Agent OS Hardening: Anthropic Patterns Adoption

Comprehensive plan to adopt 7 structural improvements from Anthropic's official skills repository, plus a skill consolidation.

## User Review Required

> [!IMPORTANT]
> This plan touches **all 28 skills**, the **auditor agent**, **visual-composition**, **coding-style.md**, and the **skills.overview.md** registry. It does NOT change any runtime code or project source — only Agent OS configuration files.

> [!WARNING]
> **Action 8 (powerpoint-patterns merge)** will delete a skill directory. Ensure no active projects reference `powerpoint-patterns` by name before executing.

## Open Questions

> [!IMPORTANT]
> **Q1**: For Action 4 (bundled scripts), which skills would benefit most from reusable CLI scripts? Initial candidates: `pptx`, `rhino-e2e-testing`, `verification-gate`. Confirm or add others.

> [!IMPORTANT]
> **Q2**: For Action 2 (progressive disclosure), which skills feel too heavy when loaded? Initial candidates for L3 refactoring: `python-rhino-grasshopper`, `typescript-mcp`, `dax-modeling`, `claude-api`. Confirm.

---

## Proposed Changes

### Phase 1 — Quick Wins (Low Risk, High ROI)

---

#### Action 1: Expand Skill Descriptions with Trigger Keywords

**Goal**: Combat under-triggering by adopting Anthropic's "pushy" description style.

**Scope**: 15 skills with terse descriptions (excluding the 3 newly adopted Anthropic skills which already have rich descriptions, and `skill-creator`/`codebase-navigator` which are already verbose).

**Skills to update** (current description → proposed expansion):

| Skill | Current Length | Status |
|:---|:---|:---|
| `systematic-debugging` | 13 words | Needs expansion |
| `verification-gate` | 21 words | Needs expansion |
| `implementation-dispatch` | 16 words | Needs expansion |
| `project-planner` | 12 words | Needs expansion |
| `project-journal` | 12 words | Needs expansion |
| `doc-updater` | 12 words | Needs expansion |
| `banana-prompt` | 12 words | Needs expansion |
| `typescript-mcp` | 11 words | Needs expansion |
| `python-patterns` | 14 words | Needs expansion |
| `rhino-unit-testing` | 12 words | Needs expansion |
| `rhino-e2e-testing` | 10 words | Needs expansion |
| `cd-foundations` | 12 words | Needs expansion |
| `powerbi-report` | 20 words | Needs expansion |
| `visual-composition` | 18 words | Needs expansion |
| `youtube-*` (3 skills) | 12-14 words each | Needs expansion |

**Pattern to follow**: Anthropic's `docx` description — states what the skill does, lists trigger phrases, provides boundary conditions (when NOT to use).

#### [MODIFY] Each `SKILL.md` frontmatter `description` field
- Add trigger phrases ("Use whenever the user mentions X, Y, Z")
- Add boundary conditions ("Do NOT use for...")
- Target: 40-80 words per description

---

#### Action 3: Add "Assume Bugs Exist" Framing to Auditor

**Goal**: Adopt Anthropic's adversarial QA mindset explicitly.

#### [MODIFY] [auditor.md](file:///c:/Users/44547/source/repos/ai-code-settings/agents/auditor.md)
- Add a new section: `## Adversarial QA Mindset`
- Include: "Assume there are problems. Your job is to find them. If you found zero issues on first inspection, you weren't looking hard enough."
- Add: "For visual outputs (PPTX, PDF, HTML), delegate visual QA to a fresh subagent to avoid confirmation bias."

---

#### Action 8: Merge powerpoint-patterns into pptx, Then Delete

**Goal**: Consolidate the two overlapping PPTX skills into one, following Anthropic's L3 progressive disclosure.

#### [NEW] `skills/pptx/references/python-pptx-patterns.md`
- Migrate python-pptx-specific content from `powerpoint-patterns/SKILL.md`:
  - Placeholder discovery patterns
  - `style_constants.py` convention
  - File conventions table (templates/, assets/, output/)
  - Anti-pattern deny list (9 items)
  - EMU helper rules
  - Template validation function

#### [MODIFY] `skills/pptx/SKILL.md`
- Add pointer: "For python-pptx-specific patterns, read `references/python-pptx-patterns.md`"

#### [DELETE] `skills/powerpoint-patterns/` (entire directory)

#### [MODIFY] [skills.overview.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/skills.overview.md)
- Remove `powerpoint-patterns` row
- Add `pptx`, `docx`, `xlsx` rows to "Domain: Design & Visuals" or new "Domain: Documents" section

#### [MODIFY] `GEMINI.md` and `CLAUDE.md`
- Remove `powerpoint-patterns` from project type routing
- Add `pptx`, `docx`, `xlsx` to relevant project type routes

---

### Phase 2 — Structural Improvements (Medium Effort)

---

#### Action 2: Adopt Progressive Disclosure (L3 references/)

**Goal**: Reduce context pressure by moving heavy reference content into on-demand `references/` subdirectories.

**Candidates** (skills currently >200 lines in SKILL.md):

| Skill | Current Lines | Refactor Target |
|:---|:---|:---|
| `python-rhino-grasshopper` | ~400+ | Split API reference into `references/rhinocommon-api.md` |
| `typescript-mcp` | ~300+ | Split Zod patterns into `references/zod-patterns.md` |
| `dax-modeling` | ~250+ | Split DAX function reference into `references/dax-functions.md` |

#### For each candidate skill:
- Identify content that is **reference material** (API docs, function lists, schema examples)
- Move to `references/<topic>.md`
- Add pointer in SKILL.md: "For [topic] details, read `references/<topic>.md`"
- Keep SKILL.md body under 500 lines (Anthropic's target)

---

#### Action 5: Ship Concrete Anti-Slop Patterns in visual-composition

**Goal**: Replace abstract "be creative" guidance with explicit banned patterns and concrete alternatives.

#### [MODIFY] [visual-composition/SKILL.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/visual-composition/SKILL.md)
- Add `## Anti-Slop Deny List` section with:
  - **Banned fonts**: Inter, Roboto, Arial, system defaults (for display/heading use)
  - **Banned layouts**: centered everything, uniform rounded corners, purple-gradient-on-white
  - **Banned patterns**: accent lines under titles, cookie-cutter card grids, generic hero sections
- Add `## Concrete Palette Options` section with 5-10 named palettes (adapt from Anthropic's pptx skill)
- Add `## Typography Pairings` section with 5+ distinctive header/body combinations

---

#### Action 6: Add Decision Trees to Routing-Heavy Skills

**Goal**: Replace prose-based routing with scannable ASCII decision trees.

#### [MODIFY] `skills/systematic-debugging/SKILL.md`
- Add decision tree for: "What type of bug is this?" → investigation strategy routing

#### [MODIFY] `skills/rhino-e2e-testing/SKILL.md`
- Add decision tree for: "Which test lane?" → Lane A-headless vs Lane A-full vs Lane B

#### [MODIFY] `skills/verification-gate/SKILL.md`
- Add decision tree for: "What evidence is needed?" → test type routing

---

### Phase 3 — Advanced Patterns (Higher Effort)

---

#### Action 4: Bundle Reusable Scripts with `--help` Interfaces

**Goal**: Ship executable helper scripts as black-box tools that models call without reading source.

**Initial candidates**:
- `skills/pptx/scripts/` — already has scripts from Anthropic adoption
- `skills/verification-gate/scripts/evidence_checker.py` — validate test output format
- `skills/rhino-e2e-testing/scripts/run_headless.py` — standard rhinoinside test runner

#### For each script:
- Add `--help` flag with usage documentation
- Add instructions in SKILL.md: "Run with `--help` first. Do NOT read the source."
- Keep scripts self-contained (no imports from SKILL.md)

---

#### Action 7: Reader-Testing Pattern for Plan/Doc Verification

**Goal**: Adopt Anthropic's "fresh sub-agent, no context" pattern for verifying plans and documentation.

#### [MODIFY] [auditor.md](file:///c:/Users/44547/source/repos/ai-code-settings/agents/auditor.md)
- Add `## Clean-Room Document Review` section
- Protocol: After a plan or specification is finalized, spawn a sub-agent with ONLY the artifact (no conversation context) and ask it to:
  1. Identify ambiguities
  2. Find assumptions that aren't stated
  3. List questions a reader would have
- Results feed back into refinement before approval

#### [MODIFY] `commands/audit.md`
- Add `--reader-test` flag to the `/audit` command
- When flagged, auditor spawns clean-room sub-agent before completing the audit

---

## Verification Plan

### Automated Tests
- `grep_search` all SKILL.md files for `description:` field length — verify ≥40 words after Action 1
- `grep_search` for `powerpoint-patterns` across GEMINI.md, CLAUDE.md, orchestration.md, skills.overview.md — verify zero hits after Action 8
- Verify `skills/pptx/references/python-pptx-patterns.md` exists after Action 8
- Count lines in refactored SKILL.md files — verify <500 lines after Action 2

### Manual Verification
- Read through expanded descriptions to confirm they feel natural, not padded
- Review visual-composition anti-slop section for completeness
- Test decision trees for logical coverage (no dead ends)
