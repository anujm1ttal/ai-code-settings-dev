# [Goal Description]
Establish a new high-rigor `python-mcp` skill to standardize the creation and maintenance of MCP servers in Python. This skill will bridge the gap between strategic design (discovery/planning) and tactical implementation (FastMCP/Pydantic).

## User Review Required

> [!IMPORTANT]
> The new skill will mandate **Pydantic v2** and **FastMCP** as the default stack for Python MCP development to ensure maximum type safety and schema generation quality.

## Proposed Changes

### Domain: Specialized

#### [NEW] [SKILL.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/python-mcp/SKILL.md)
Creation of the primary skill definition.
- **Strategic Layer**: Adopt the "Phase 1: Discovery" and "Phase 2: Planning" workflow from `mcp-builder`.
- **Implementation Layer**: Standardize FastMCP setup, tool registration, and Pydantic v2 input modeling.
- **Verification Layer**: Mandate `--help` CLI checks and unit testing for tool logic.

#### [NEW] [fastmcp-patterns.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/python-mcp/references/fastmcp-patterns.md)
Deep-load reference for technical implementation details.
- Standard imports and server initialization.
- Pydantic model configuration (`model_config`).
- Error handling utilities.
- Response formatting (Markdown vs. JSON).

#### [NEW] [planning-checklist.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/python-mcp/references/planning-checklist.md)
Deep-load reference for the strategic design phase.
- API mapping and tool selection criteria.
- Naming conventions (`{service}_mcp`).

### Core Registry

#### [MODIFY] [skills.overview.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/skills.overview.md)
Add `python-mcp` to the "Domain: Development" section.

#### [MODIFY] [orchestration.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/orchestration.md)
Add `python-mcp` to the `code` and `hybrid` project types.

#### [MODIFY] [GEMINI.md](file:///c:/Users/44547/source/repos/ai-code-settings/GEMINI.md)
Update the skills list to include the new skill.

---

## Verification Plan

### Automated Tests
- Run a `registry-audit` to ensure the new skill is correctly wired.
- Validate that the new `SKILL.md` passes the frontmatter and word-count checks (≥40 words).

### Manual Verification
- None required for skill creation itself, but the auditor will verify the "Right to Exist" and "Architectural Alignment" of the new files.
