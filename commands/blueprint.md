---
description: Triggers the strategist to initialize a new project, append a phase, or re-plan after a pivot. Enforces Step 0 and creates the Implementation Plan.
---

# Command: /blueprint

**Strategist** takes control to architect the project foundation.

## Mode Detection

```
No Artifacts/IMPLEMENTATION_PLAN.md → NEW PROJECT
All phases complete → NEW PHASE
User states pivot/failure/restart → RE-PLAN
Uncertain → Ask: "Adding a new phase or starting over?"
```

## New Project
1. Analyze user's project idea.
2. **Requirements Interview**: Ask 3–5 targeted questions to uncover hidden constraints and goals (see `strategist.md`).
3. **Step 0 Challenge**: PROJECT_TYPE, VALUE_CHECK, MINIMALISM, RISKS.
4. **Phased Roadmap**: 3–4 phases with numeric success metrics.
5. **Create files**: `Artifacts/IMPLEMENTATION_PLAN.md`, `Artifacts/TODO.md`, `Artifacts/ARCH.md`.
6. **Handoff**: Identify first agent + task.

## New Phase
1. Run `/sync` via concierge to validate current state.
2. Confirm prior phase success metrics met (auditor-verified).
3. Step 0 for new phase only (VALUE_CHECK, MINIMALISM, RISKS).
4. Append to `Artifacts/IMPLEMENTATION_PLAN.md` and `Artifacts/TODO.md`. Update `Artifacts/ARCH.md` if needed.

## Re-Plan
1. Archive current `Artifacts/IMPLEMENTATION_PLAN.md` + `Artifacts/TODO.md` to `Artifacts/history/` with timestamp.
2. Post-mortem in `Artifacts/DECISION_LOG.md`: original assumption → invalidating evidence → constraint changes.
3. **Requirements Interview**: Re-verify boundaries if failure was due to requirement drift.
4. Full Step 0 referencing what failed.
5. Fresh files. Restart pipeline.

## Standards
- **Success Metrics**: Numeric, verifiable. Forbidden: "Done", "Complete", "Working".
- **Minimalism**: If plan >4 phases, challenge — can phases merge?
- **Task Granularity**: Atomic (single session). Assigned agent. If >8 files, decompose.
- **Agent Assignment**: Per PROJECT_TYPE. If `manuscript`, coder is inactive.