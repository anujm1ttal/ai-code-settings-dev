# Skill Abstract: Project Journaling & State Persistence (L0)

**Purpose**: Maintain session history, decision logs, and project memory across sessions for the concierge agent.

**Core Logic**:
- **Short-Term Memory**: `Artifacts/.agent/current_task.md` — the "You Are Here" marker, refreshed at every session start/end/agent transition.
- **Long-Term Memory**: `Artifacts/DECISION_LOG.md` — append-only, architectural/technology/scope pivots only.
- **Archive Protocol**: Date-suffixed archives to `Artifacts/History/` when TODO/plans exceed size thresholds; indexed in `History/INDEX.md`.

**Constraint**: Do NOT use for routine task status (that's `Artifacts/TODO.md`) or technical design (that's `Artifacts/IMPLEMENTATION_PLAN.md`).
