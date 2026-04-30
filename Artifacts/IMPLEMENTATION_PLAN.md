# Implementation Plan: Agent OS Hardening (Tier 1 & 2)

This plan incorporates advanced orchestration and efficiency patterns inspired by KARIMO into the Agent OS.

## User Review Required

> [!IMPORTANT]
> **Context Layering Impact**: Moving to L0/L1/L2 means agents will stop loading full skill files by default. They will load Overviews first, then Abstracts, then full files only when necessary. This significantly saves tokens but requires agents to be "Overview-aware."

> [!WARNING]
> **Learning Migration**: The flat `Artifacts/LEARNINGS.md` will be moved to `Artifacts/learnings/`.

## Proposed Changes

### Phase 1: Context Layering (Tier 1)

#### [NEW] [agents.overview.md](file:///c:/Users/44547/source/repos/ai-code-settings/agents/agents.overview.md)
#### [NEW] [skills.overview.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/skills.overview.md)
#### [NEW] Abstracts for core agents and high-use skills (`*.abstract.md`)

### Phase 2: Knowledge & Economics (Tier 1 & 2)

#### [MODIFY] [orchestration.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/orchestration.md)
- Formalize the **Findings Protocol** (ephemeral per-phase knowledge).
- Add **Semantic Loop Detection** rules.

#### [NEW] [TOKEN-ECONOMICS.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/TOKEN-ECONOMICS.md)
- Define bootstrap costs, slicing thresholds, and context pressure management.

#### [NEW] [learnings/](file:///c:/Users/44547/source/repos/ai-code-settings/Artifacts/learnings/)
- Categorized directory structure (`patterns/`, `anti-patterns/`, `project-notes/`, `execution-rules/`).

### Phase 3: Logic & Templates (Tier 2)

#### [MODIFY] [implementation-dispatch/SKILL.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/implementation-dispatch/SKILL.md)
- Implement loop detection fingerprinting logic.

#### [MODIFY] [implementation_plan.md template]
- Standardize the **Task Brief** format for independent execution units.

## Verification Plan

### Automated Tests
- `registry-audit` to verify L1/L0 link integrity.
- `audit` on `implementation-dispatch` to verify loop detection logic.

### Manual Verification
- Verify `Artifacts/learnings/` structure is correctly initialized.
- Verify agent can successfully navigate from L1 -> L0 -> L2 in a sample task.
