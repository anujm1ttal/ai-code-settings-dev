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
