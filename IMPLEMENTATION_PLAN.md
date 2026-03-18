# Implementation Plan: Requirements Interviewer Integration

Add a mandatory "Requirements Interview" step to the project initialization process (`/blueprint`) to ensure the `strategist` fully understands user needs before generating plans and documentation.

## Proposed Changes

### [Strategist & Command]
#### [MODIFY] [strategist.md](file:///c:/Users/44547/source/repos/ai-code-settings/agents/strategist.md)
*   Formally define the **Interviewer** role.
*   Require 3-5 high-density questions before proceeding to Step 0 for new projects or ambiguous re-plans.

#### [MODIFY] [blueprint.md](file:///c:/Users/44547/source/repos/ai-code-settings/commands/blueprint.md)
*   Insert "Requirements Interview" as Step 1 of the **New Project** sequence.
*   Update **Re-Plan** to include the interview if the previous failure was due to requirement drift.

### [Skills & Rules]
#### [MODIFY] [business-analyst](file:///c:/Users/44547/source/repos/ai-code-settings/skills/business-analyst/SKILL.md)
*   Add **Interview Methodology** section for business requirements.

#### [MODIFY] [project-planner](file:///c:/Users/44547/source/repos/ai-code-settings/skills/project-planner/SKILL.md)
*   Add **Interview Methodology** section for phasing and dependencies.

#### [MODIFY] [orchestration.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/orchestration.md)
*   Update the **Task Lifecycle** diagram and sequence to include the interview step.

## Verification Plan

### Manual Verification
1. Trigger a mock `/blueprint` for a new project (e.g., "build a stadium tool").
2. Verify the `strategist` initiates an interview with targeted questions instead of jumping directly to Step 0.
3. Provide answers and verify the subsequent Step 0 and `IMPLEMENTATION_PLAN.md` reflect the interview data.
