---
description: Triggers the Strategist to initialize a new project, append a phase, or re-plan after a pivot. Enforces Step 0 Value Check, project typing, and creates the Implementation Plan.
---

# Command: /blueprint

When this command is triggered, the **strategist** agent takes control to architect the project's foundation.

## ⚡ Mode Detection

Before executing, determine the current project state:

```
IF no IMPLEMENTATION_PLAN.md exists → Mode: NEW PROJECT

IF IMPLEMENTATION_PLAN.md exists AND all current phases are complete → Mode: NEW PHASE

IF IMPLEMENTATION_PLAN.md exists AND user explicitly states a pivot, failure, or restart → Mode: RE-PLAN

IF uncertain → ASK the user: "I found an existing plan. Are you adding a new phase or starting over?"
```


## 🚀 Mode: New Project

Full initialization sequence:

1. **Analyze Input**: Evaluate the user's project idea or problem statement.
2. **Step 0 Challenge**: Generate all four sections immediately:
   - **PROJECT_TYPE**: Classify as `code`, `geometry`, `data`, `manuscript`, or `hybrid`. This determines which agents and skills activate.
   - **VALUE_CHECK**: Single sentence on business/operational impact.
   - **MINIMALISM**: The smallest viable version to achieve the goal.
   - **RISKS**: Three technical or data showstoppers.
3. **Phased Roadmap**: Develop 3–4 logical phases with quantifiable success metrics.
4. **File Creation**:
   - Create `IMPLEMENTATION_PLAN.md` with the full strategy and Step 0 output.
   - Create `TODO.md` with an atomic checkbox list. Every task must name its responsible agent.
   - Create `ARCH.md` with the initial architecture overview and key design decisions.
5. **Agent Handoff**: Identify which agent takes the first task and brief the `concierge`.

## 🔄 Mode: New Phase

Append to an existing project:

1. **Sync First**: Invoke the `concierge` to run `/sync` and validate current state.
2. **Phase Review**: Confirm all prior phase success metrics have been met (verified by `auditor`).
3. **Step 0 Challenge**: Run VALUE_CHECK, MINIMALISM, and RISKS for the new phase only.
4. **Append**:
   - Add the new phase to `IMPLEMENTATION_PLAN.md` with dependencies on prior phases.
   - Append new atomic tasks to `TODO.md`.
   - Update `ARCH.md` if architecture changes are required.
5. **Agent Handoff**: Identify the first task owner for the new phase.

## ♻️ Mode: Re-Plan

Full reset with historical context:

1. **Archive**: Move current `IMPLEMENTATION_PLAN.md` and `TODO.md` to `history/` with a timestamp.
2. **Post-Mortem**: Document what failed and why in `DECISION_LOG.md`:
   - What was the original assumption?
   - What evidence invalidated it?
   - What constraint changes triggered the re-plan?
3. **Step 0 Challenge**: Full run with explicit reference to the failed approach.
4. **File Creation**: Fresh `IMPLEMENTATION_PLAN.md`, `TODO.md`, and updated `ARCH.md`.
5. **Agent Handoff**: Restart the task pipeline from the new plan.

## 📐 Standards

### Success Metrics
- Must be numeric and verifiable (e.g., "C-Value > 60mm", "Refresh < 30s", "Test coverage > 80%").
- **Forbidden**: "Done", "Complete", "Working", or any non-measurable status.

### Minimalism
- Define the shortest path to a functional deliverable.
- If the plan exceeds 4 phases, challenge it — can phases be merged?

### Task Granularity
- Every `TODO.md` item must be atomic — completable in a single agent session.
- Every item must name the responsible agent: `[ ] [coder] Implement sightline calculation`.
- If a single task touches more than 8 source code files, decompose it.

### Agent Assignment
- Every phase must declare which agents are active based on `PROJECT_TYPE`.
- If `PROJECT_TYPE` is `manuscript`, the `coder` agent is inactive — do not assign code tasks.

## 📁 File Outputs

| File | Action | Owner |
| :--- | :--- | :--- |
| `IMPLEMENTATION_PLAN.md` | Create / Append / Replace | Strategist |
| `TODO.md` | Create / Append / Replace | Strategist (structure) |
| `ARCH.md` | Create / Update | Strategist |
| `DECISION_LOG.md` | Append (Re-Plan mode only) | Strategist → Concierge maintains |

## 💬 Example Usage

### New Project
- User: I need to build a seating culling tool for Rhino. /blueprint

### New Phase
- User: Phase 1 is done. I want to add a Power BI dashboard for sightline analytics. /blueprint

### Re-Plan
- User: The IronPython approach isn't working. We need to switch to CPython. /blueprint