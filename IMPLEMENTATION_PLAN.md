# Explain Mode Implementation

Add a "teacher/explainer" capability to the AI settings. This allows users to ask how a codebase works, walk through call chains, and understand design decisions interactive-style, rather than just generating static documentation.

## User Review Required

- **Agent Choice**: Capability implemented as a skill (`codebase-navigator`) on the `scribe` agent rather than a standalone agent.
- **Trigger**: New `/explain` command added to the fleet.

## Proposed Changes

### [Core]
#### [NEW] [codebase-navigator](file:///C:/Users/44547/source/repos/ai-code-settings/skills/codebase-navigator/SKILL.md)
Implements four explanation tiers (Overview, Module Map, Call Chain, Code Spotlight) and templates for design decision rationale.

#### [NEW] [explain.md](file:///C:/Users/44547/source/repos/ai-code-settings/commands/explain.md)
New slash command that wires the scribe to the navigator skill.

### [Fleet Configuration]
#### [MODIFY] [scribe.md](file:///C:/Users/44547/source/repos/ai-code-settings/agents/scribe.md)
Updated to support two distinct modes: **Docs** (via `doc-updater`) and **Explain** (via `codebase-navigator`).

#### [MODIFY] [orchestration.md](file:///C:/Users/44547/source/repos/ai-code-settings/rules/common/orchestration.md)
Updated project routing and automatic command routing tables.

#### [MODIFY] [CLAUDE.md](file:///C:/Users/44547/source/repos/ai-code-settings/CLAUDE.md) / [GEMINI.md](file:///C:/Users/44547/source/repos/ai-code-settings/GEMINI.md)
Updated quick-reference tables and architecture notes.

## Verification Plan

### Manual Verification
- Verify `/explain` is listed in `CLAUDE.md` and `GEMINI.md`.
- Verify `scribe.md` correctly references `codebase-navigator`.
- Verify `orchestration.md` routing table covers all project types for the new skill.
