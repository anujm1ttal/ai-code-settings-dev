# Skill Abstract: Implementation Dispatch (L0)

**Purpose**: Subagent orchestration and two-stage review workflow for large roadmaps (3+ tasks) or high context pressure (70%+).

**Core Logic**:
- **Delegation**: Spawns fresh subagents to handle atomic implementation tasks in isolation.
- **Two-Stage Review**: Mandatory 2-step verification (Stage A: Spec Compliance → Stage B: Technical Quality).
- **Council Review**: High-rigor mode for critical tasks involving multiple personas.

**Constraint**: Subagents MUST return a status code (DONE, DONE_WITH_CONCERNS, NEEDS_CONTEXT, BLOCKED).
