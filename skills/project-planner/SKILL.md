---
name: project-planner
description: Phased project planning methodology, dependency mapping, timeline estimation, and task decomposition. Backing skill for the strategist agent. Powers the /blueprint command.
tags: ["planning", "project-management", "phasing", "estimation"]
verbosity_control: "STRICT. Focus on deliverables, dependencies, and metrics. No aspirational language."
---

# Skill: Project Planning & Phased Delivery

## 📐 Planning Principles

### Minimalism First
- Every plan starts from the smallest possible scope that delivers measurable value.
- If a phase can be split, it should be — unless the split introduces more coordination overhead than it saves.
- The first phase must be completable in 1–3 working sessions. If it can't, the scope is too large.

### Dependency-Driven Sequencing
- Tasks are ordered by dependencies, not by perceived importance.
- A task with zero dependencies goes first, regardless of its "glamour."
- No task may begin until all predecessors are marked `[x]` by the `auditor`.

### Measurability Mandate
- Every phase, every task, every deliverable must have a numeric success metric.
- If you cannot define how to measure success, the task is not ready for planning.
- **Forbidden success criteria**: "Done", "Complete", "Working", "Improved", "Better."

## 🏗 Phased Roadmap Construction

### Phase Design Rules
- **3–4 phases maximum** per project. If you need more, the project should be split into sub-projects.
- **Each phase must be independently valuable** — if the project is cancelled after Phase N, the work delivered so far is still usable.
- **Phase boundaries are audit gates** — the `auditor` must verify all phase success metrics before the next phase begins.

### Phase Template

Every phase in `Artifacts/IMPLEMENTATION_PLAN.md` must contain:

- **Phase [N]: [Descriptive Title]**
- **Objective**: One sentence — what does this phase deliver?
- **Deliverables**: Tangible artifacts produced (files, scripts, dashboards, documents).
- **Success Metrics**: Numeric, verifiable thresholds.
- **Dependencies**: What must be complete before this phase starts (prior phases, external input, data access).
- **Agent Assignment**: Which agent owns the first task. Which skills are equipped.
- **Estimated Effort**: T-shirt size (S/M/L) + session count estimate.
- **Risks**: Phase-specific risks beyond the project-level risks identified in Step 0.

### Phase Sequencing Patterns

| Pattern | When to Use | Example |
| :--- | :--- | :--- |
| **Sequential** | Each phase depends on the prior | Data model → Measures → Dashboard |
| **Parallel-then-Merge** | Independent tracks converge | Rhino script + Power BI model → Integration |
| **Incremental** | Each phase extends the prior | Basic sightlines → Premium tiers → Accessible seating |
| **Spike-then-Build** | Uncertainty requires a proof-of-concept first | Prototype C-Value calc → Full stadium model |

### Phase Effort Estimation

| Size | Sessions | Files Touched | Typical Scope |
| :--- | :--- | :--- | :--- |
| **S** (Small) | 1–2 | 1–3 | Single function, config change, simple measure |
| **M** (Medium) | 3–5 | 4–8 | Module implementation, data model setup, tool build |
| **L** (Large) | 6–10 | 8+ | Multi-module feature, full pipeline, integration |

- If an estimate exceeds **L**, decompose into sub-phases or sub-projects.
- Estimates are for planning only — the `auditor` gates on success metrics, not time spent.

## 📋 Task Decomposition

### Atomic Task Rules
Every item in `Artifacts/TODO.md` must be:
- **Atomic**: Completable in a single agent session (typically 1–2 hours of focused work).
- **Owned**: Assigned to exactly one agent: `[ ] [coder] Task description`.
- **Measurable**: Has a verifiable outcome — code compiles, test passes, metric threshold met.
- **Scoped**: Touches 8 or fewer source code files. If more, decompose further.
- **Sequenced**: Ordered by dependency. No task appears before its prerequisites.

### Task Decomposition Checklist
When breaking a phase into tasks, verify:
- [ ] Can each task be completed without waiting on another in-progress task?
- [ ] Does each task produce a testable artifact (file, output, metric)?
- [ ] Is the responsible agent named?
- [ ] Are file paths or module names specified where relevant?
- [ ] Is the success condition unambiguous?

### Task Types

| Type | Agent | Description | Example |
| :--- | :--- | :--- | :--- |
| **Implement** | Coder | Write new code or logic | `[coder] Implement C-Value function in c_value.py` |
| **Refactor** | Coder | Restructure existing code | `[coder] Extract data tree logic to separate module` |
| **Validate** | Auditor | Review and verify work | `[auditor] Audit sightline module against skill-python-rhino.md` |
| **Document** | Scribe | Create or update docs | `[scribe] Update Artifacts/ARCH.md with new module structure` |
| **Ingest** | Concierge | Import manual work | `[concierge] Ingest exported GH sightline script` |
| **Plan** | Strategist | Scope or re-plan | `[strategist] Define Phase 3 scope and success metrics` |

## 🔗 Dependency Mapping

### Dependency Types

| Type | Symbol | Meaning | Example |
| :--- | :--- | :--- | :--- |
| **Hard** | `→` | B cannot start until A is `[x]` | Data model → Measures |
| **Soft** | `~>` | B benefits from A but can start independently | Docs ~> Code review |
| **External** | `⇒` | Depends on input outside the project | CAD files ⇒ Sightline calc |

### Dependency Notation in Artifacts/TODO.md

Tasks reference their dependencies explicitly:

- `[ ] [coder] Implement sightline calc — depends: none`
- `[ ] [coder] Build rake generator — depends: sightline calc`
- `[ ] [auditor] Audit sightline module — depends: sightline calc`
- `[ ] [scribe] Document sightline API — depends: audit pass`

### Dependency Validation
During `/sync` and `/audit --pre`, the `concierge` and `auditor` check:
- No task is `[-]` (in progress) while its predecessor is still `[ ]` (not started).
- No task is proposed for `[x]` while a dependent task has failing tests.
- External dependencies are flagged as **BLOCKED** with a clear owner and expected resolution.

## 🗺 Artifacts/IMPLEMENTATION_PLAN.md Structure

The `strategist` produces this file during `/blueprint`. It is the architectural North Star.

### Required Sections

- **# Project: [Name]**
- **## Step 0**
  - PROJECT_TYPE: [code / geometry / data / manuscript / hybrid]
  - VALUE_CHECK: [one sentence]
  - MINIMALISM: [smallest viable version]
  - RISKS: [three showstoppers]
- **## Phase 1: [Title]**
  - Objective, Deliverables, Success Metrics, Dependencies, Agent Assignment, Estimated Effort, Risks.
- **## Phase 2: [Title]**
  - (same structure)
- **## Phase N: [Title]**
  - (same structure)
- **## Dependency Map**
  - Visual or textual representation of phase and task dependencies.
- **## Risk Register**
  - Consolidated project risks with likelihood, impact, and mitigation.

### Plan Health Checks
The `concierge` validates during `/sync`:
- Every phase has at least one success metric that is numeric.
- Every task in `Artifacts/TODO.md` maps to a phase in the plan.
- No orphaned tasks (in TODO but not in any phase).
- No phantom phases (in plan but with zero TODO tasks).
- Dependency chain has no cycles.

## ⚖️ Scope Control

### The 80/20 Rule
- Prioritize the 20% of effort that yields 80% of the result.
- If a feature is "nice to have" but doesn't contribute to a success metric, it goes in "Won't Have" (this version).
- The `strategist` must challenge any task that doesn't trace back to a Step 0 VALUE_CHECK.

### Scope Creep Detection
Flag immediately if:
- A task is added to `Artifacts/TODO.md` without a corresponding update to `Artifacts/IMPLEMENTATION_PLAN.md`.
- The `coder` implements functionality not in the current phase.
- A "quick fix" grows beyond 3 files touched.
- The user requests a feature that doesn't align with the current phase's objective.

### Scope Change Protocol
1. User or agent identifies a scope change need.
2. Route to `strategist` for evaluation against Step 0.
3. If approved: update `Artifacts/IMPLEMENTATION_PLAN.md`, add tasks to `Artifacts/TODO.md`, log in `Artifacts/DECISION_LOG.md`.
4. If rejected: document the rejection in `Artifacts/DECISION_LOG.md` with rationale.
5. Never silently absorb scope — every change is explicit and logged.

## 🎙 Interview Methodology (The Delivery)

The `strategist` uses these questions to ensure the phased roadmap is grounded in reality:

### 1. The "First Win" (Sequencing)
- "What is the smallest piece of this project we can audit and verify in 48 hours?"
- "What is the most 'boring' dependency that must be solved before the 'exciting' parts can start?"

### 2. The "Data Baseline" (Dependencies)
- "Do you have a 'gold standard' dataset or model we can use to verify the first phase?"
- "How do we know Phase 1 is 'correct' without comparing it to a human-made version?"

### 3. The "Handoff Boundary" (Ownership)
- "Who owns the data we need? Are they ready to provide it, or is 'getting the data' Phase 1 task 1?"
- "Who is the final authority to say 'Yes, this phase meets the success metric'?"

### 4. The "Scaling Trigger" (Future)
- "Does Phase 1 need to support the full data load (e.g., 50k seats), or can we prove the logic on a 100-seat subset first?"

## 🚫 Planning Anti-Patterns
- **Big Bang phases**: One massive phase with 20+ tasks. Decompose.
- **Vague success metrics**: "Working correctly" is not measurable. Define the threshold.
- **Implicit dependencies**: If task B needs task A, write it down. Don't assume ordering.
- **Gold plating**: Exceeding the success metric "just in case." If C-Value > 60mm is the metric, don't optimize for 120mm unless the plan says so.
- **Orphan tasks**: Tasks in Artifacts/TODO.md with no parent phase. Every task traces to a phase.
- **Infinite Phase 1**: A first phase that tries to do everything. Phase 1 should be the smallest demonstrable win.