# 🗺️ Phased Rigor Upgrades: Planning & Interaction

Enhance the Agent OS with high-rigor planning patterns derived from the ADD-02 Viewport Layout plan. This ensures all future projects prioritize token economy, interface stability, and explicit architectural invariants.

---

## Phase PR-A — Planning Skill Upgrade

**Agent role:** Strategist (decision) → Scribe (document)
**Prerequisites:** None.

### Scope
Update `skills/project-planner/SKILL.md` to formalize the "Interface-First" and "ROI Escalation" patterns.

### Tasks
1. **[MODIFY] [SKILL.md](file:///c:/Users/44547/.gemini/antigravity/skills/project-planner/SKILL.md)**:
   - Add **"Interface-First Pattern"**: Mandate Phase 1 as a Schema/Contract definition for any data-heavy tool.
   - Add **"ROI Escalation Pattern"**: Define the hierarchy of context (Metadata -> JSON -> Visuals).
   - Add **"Hard Rules Template"**: Provide the structure for phase-level invariants.

---

## Phase PR-B — Workflow Upgrade

**Agent role:** Strategist
**Prerequisites:** PR-A complete.

### Scope
Update `global_workflows/blueprint.md` to enforce the new ROI checks during Step 0.

### Tasks
1. **[MODIFY] [blueprint.md](file:///c:/Users/44547/.gemini/antigravity/global_workflows/blueprint.md)**:
   - Update Step 0 Challenge to include **VALUE_ROI** (Token cost vs. Information gain).
   - Update the `/blueprint` response template to include a **Hard Rules** summary for the first phase.

---

## Phase PR-C — Standards Upgrade

**Agent role:** Auditor (gate) → Scribe (document)
**Prerequisites:** PR-B complete.

### Scope
Update `rules/common/standards.md` to define "Decision Points" and formalize "Hard Rules" as a reporting standard.

### Tasks
1. **[MODIFY] [standards.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/standards.md)**:
   - Add **"Decision Point Gating"**: Formalize the `[user-approval]` task type.
   - Add **"The Negative Test Suite"**: Define why "Hard Rules" are used instead of just positive metrics.

---

## Verification Plan

### Automated Tests
- No automated tests for markdown-only rule changes.

### Manual Verification
- **Strategist Simulation**: Run `/blueprint` for a hypothetical new tool (e.g., "Get Layer Statistics") and verify:
  - Step 0 includes ROI check.
  - Phase 1 is a Schema definition.
  - The plan includes a "Hard Rules" block.
