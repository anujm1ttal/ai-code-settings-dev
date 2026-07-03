# Global Skill Audit Plan

Audit all skills in `skills/` against the `skill-creator` standards to ensure architectural integrity, optimal triggering, and high-quality instructions.

## User Review Required

> [!IMPORTANT]
> This is a broad sweep. I will prioritize identifying "shallow" or "bloated" skills that violate the 500-line soft cap or lack clear trigger descriptions.

## Open Questions

- Should I prioritize any specific category of skills (e.g., Rhino/Grasshopper vs. MCP)?
- Do you want me to automatically fix minor issues (like missing frontmatter) or just report them?

## Proposed Changes

### Phase 1: Structural Inventory

I will scan all skill directories to verify the presence of `SKILL.md`, YAML frontmatter, and basic directory structure (`scripts/`, `references/`).

#### [NEW] [SKILL_AUDIT_REPORT.md](file:///c:/Users/44547/source/repos/ai-code-settings/Artifacts/SKILL_AUDIT_REPORT.md)
Initial findings and status of all skills.

### Phase 2: Instruction Quality & Bloat Check

I will analyze each `SKILL.md` for:
- Line count (>500 lines requires splitting).
- Tone (Imperative, explains the "why").
- Progressive Disclosure (Proper use of `references/` for large docs).
- Example patterns.

### Phase 3: Triggering Description Optimization

I will review the `description` in frontmatter for:
- "Pushiness" (explicitly stating when to use).
- Clarity (what it enables Claude to do).

### Phase 4: Remediation

I will implement the recommendations from the audit report.

#### [MODIFY] [SKILL.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/docx/SKILL.md)
Splitting extensive docx-js API guide out of the main instructions.

#### [NEW] [api-guide.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/docx/references/api-guide.md)
Extracted docx-js API reference.
- Clarity (what it enables Claude to do).

## Verification Plan

### Automated Checks
- Script to count lines in all `SKILL.md` files.
- Regex check for YAML frontmatter presence.

### Manual Verification
- Qualitative review of instruction clarity.

---

# Phase 12: Standardize Artifacts Workflow

**Objective**: Formalize per-project Artifacts directory structure to reduce cognitive load and establish consistent patterns across all projects.

**Current state**: Projects have ad-hoc Artifacts layouts. This phase standardizes:
- Root level: high-level files (IMPLEMENTATION_PLAN.md, TODO.md, ARCH.md, MEMORY_ANCHORS.md, learnings/)
- Plans/: detailed phase plans and todos (created at phase start)
- Reports/: phase completion reports (created at phase end)
- History/: archived decisions, old plans, and ad-hoc artifacts

## Phase 12.1: Update Global Rules

- [coder] Update `CLAUDE.md` Artifacts section
  - Document new directory structure (Plans/, Reports/, History/)
  - Clarify what stays at root (IMPLEMENTATION_PLAN.md, TODO.md, ARCH.md, MEMORY_ANCHORS.md, learnings/)
  - Define lifecycle: when Plans → History, when Reports created

- [coder] Update `orchestration.md` persistence table
  - Add Plans/Phase-N-Plan.md and Plans/Phase-N-TODO.md rows
  - Add Reports/Phase-N-Report.md row
  - Clarify History/ as archive destination
  - Maintain learnings/ and MEMORY_ANCHORS.md at root (never archived)

- [coder] Create template files
  - `templates/Phase-N-Plan.md.template` (sections: Objectives, Technical Approach, File Changes, Dependencies, Success Metrics)
  - `templates/Phase-N-TODO.md.template` (format matching root TODO.md but phase-scoped)

## Phase 12.2: Update Documentation

- [scribe] Update `cheatsheet.md` Artifacts navigation section
  - Add visual tree showing new structure
  - Add lifecycle explanation (Plans → Reports → History)

- [scribe] Update `README.md` Artifacts references
  - Link to Plans/, Reports/, History/ in developer section

## Success Metrics

- ✓ New Artifacts structure documented in CLAUDE.md (persistence table)
- ✓ Templates created and ready for projects to use
- ✓ cheatsheet.md reflects new structure
- ✓ No breaking changes to existing projects (backward compatible)
