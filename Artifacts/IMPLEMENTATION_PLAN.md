# Agent OS Hardening - Wave 2: Operational Rigor

Addressing 10 structural inconsistencies to move from a "documented" OS to a "performant" one.

## User Review Required

> [!IMPORTANT]
> This plan introduces the **Micro-Task Protocol**, which significantly reduces ceremonial overhead for small edits (≤1 file, ≤30 lines).

## Proposed Changes

### 1. Orchestration & Interaction Standards
#### [MODIFY] [orchestration.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/orchestration.md)
- **Micro-Task Protocol**: Define the lightweight path for minor edits (Skip full Step 0, use one-line `VALUE_CHECK`).
- **Refined Routing**: Update project types to distinguish between **Core** agents (auto-activated) and **Available** agents (on-demand).
- **Status Hierarchy**: Standardize `DONE` (Claim), `PASS` (Audit), `[x]` (Complete), `CLEAN` (Security), `RECONCILED` (Sync).
- **Severity Scale**: Unified `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`.

#### [MODIFY] [standards.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/standards.md)
- Consolidate "Artifact Mirroring" and "No Fluff" rules.
- Explicitly document the `README.md` and `Artifacts/` exception logic.

### 2. Language & Testing Taxonomy
#### [MODIFY] [coding-style.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/coding-style.md)
- **Python Runtime Matrix**: Define the 3 contexts (Host 3.12, Rhino 3.9, Rhino.Inside 3.12) and their library/syntax limits.
- **Test Taxonomy**: Standardize `Unit`, `Boundary`, `Integration`, `E2E`, `Smoke`, `Regression`.

### 3. Agent & Skill Alignment
#### [MODIFY] [agents/*.md](file:///c:/Users/44547/source/repos/ai-code-settings/agents/)
- Hardening capability notes: Auditor write authority, Concierge cleanup ownership, etc.

#### [MODIFY] [cd-foundations](file:///c:/Users/44547/source/repos/ai-code-settings/skills/cd-foundations/SKILL.md)
- Strip runtime-routing bloat. Re-focus on always-on standards.

### 4. Workflow Hardening (Commands)
#### [MODIFY] [/sync](file:///C:/Users/44547/.gemini/antigravity/commands/sync.md) & [/audit](file:///C:/Users/44547/.gemini/antigravity/commands/audit.md)
- Implement **Artifact Drift** detection (Shadow vs. Workspace).

## Verification Plan

### Automated Verification
- Run `/audit` to check for circular references or broken links in the new taxonomy.
- Verify that the Micro-Task protocol is correctly referenced in the `strategist` routing.

### Manual Verification
- Visual inspection of the Python Runtime Matrix for clarity.
- Verify that status hierarchy is applied in the updated `task.md` template.
