---
description: Cross-reference integrity check to ensure global registry consistency and documentation health.
argument-hint: ""
model: claude-sonnet-5
---

# Command: /registry-audit

**Owner**: auditor
**Purpose**: Cross-reference integrity check for the Agent OS Registry.

## Objective
To ensure that all agents, skills, commands, and project types defined in the global registry are internally consistent, non-broken, and properly documented.

## The Registry Audit Checklist

### 1. Skill Integrity
- [ ] Every skill referenced in `CLAUDE-global.md`, `orchestration.md`, `cheatsheet.md`, or `GEMINI.md` exists in `skills/` or `optional_plugins/*/skills/`.
- [ ] No "orphan" skills (files exist but aren't referenced anywhere).
- [ ] All skill `SKILL.md` files have valid YAML frontmatter (`name`, `description`).

### 2. Command Integrity
- [ ] Every slash command referenced in `CLAUDE-global.md`, `orchestration.md`, or `GEMINI.md` has a corresponding `.md` file in `commands/`.
- [ ] Command ownership in `CLAUDE-global.md` and `orchestration.md` matches the "Owner" field in the command file.

### 3. PROJECT_TYPE Sync
- [ ] `PROJECT_TYPE` enum values in `project-planner/SKILL.md` match the `Project Type Routing` table in `orchestration.md`.
- [ ] All types in `cheatsheet.md` are accounted for in the core routing.

### 4. Agent & Artifact Ownership
- [ ] Every required artifact listed in `CLAUDE-global.md`, `orchestration.md`, or `GEMINI.md` has a defined owner agent.
- [ ] Every agent file in `agents/` has the required `name`, `role`, and `description` frontmatter.

### 5. Link Integrity
- [ ] All `file:///` links in rules and cheatsheets point to existing files.

## The Procedure
1. Run a global search (Grep) for command and skill references.
2. Cross-reference with directory listings (Glob) for `commands/`, `agents/`, `skills/`, and `optional_plugins/*/skills/`.
3. Compare `PROJECT_TYPE` strings across the canonical files (`CLAUDE-global.md`, `orchestration.md`, `project-planner/SKILL.md`).
4. Generate `Artifacts/REGISTRY_HEALTH_REPORT.md` if drift is found.

## Relationships
- **Sweep**: Invoked via `/sweep --registry`.
- **Hardening**: Use after any refactor of the global OS structure.
