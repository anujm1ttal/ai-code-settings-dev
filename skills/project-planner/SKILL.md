---
name: project-planner
description: Use this skill when initializing new projects, appending phases to an existing roadmap, mapping dependencies between tasks, or decomposing high-level goals into actionable TODO items. It enforces "Minimalism First" planning and ROI-driven prioritization. Trigger when the user asks "How should we build X?" or "What's next?", or when a complex task needs to be broken down. Do NOT use for one-off minor edits that fall under the Micro-Task Protocol.
argument-hint: "<vague project idea or roadmap requirement>"
metadata:
  version: "1.0.1"
  tags: ["planning", "project-management", "phasing", "estimation", "strategist", "roadmap"]
  verbosity_control: "STRICT. Focus on deliverables, dependencies, and metrics. No aspirational language."
---


# Skill: Project Planning & Phased Delivery

## 📐 Planning Principles

### Minimalism First
- Every plan starts from the smallest possible scope that delivers measurable value.
- If a phase can be split, it should be — unless the split introduces more coordination overhead than it saves.
- The first phase must be completable in 1–3 working sessions. If it can't, the scope is too large.

### ROI-Driven Context Escalation
See `CLAUDE-global.md` § ROI Escalation (Tier 1 Metadata → Tier 2 Logic → Tier 3 Content). Only escalate when the lower tier confirms high ROI for the deeper inspection.

### Dependency-Driven Sequencing
- Tasks are ordered by dependencies, not by perceived importance.
- A task with zero dependencies goes first, regardless of its "glamour."
- No task may begin until all predecessors are marked `[x]` by the `auditor`.

### Measurability Mandate
- Every phase, every task, every deliverable must have a numeric success metric.
- If you cannot define how to measure success, the task is not ready for planning.
- **Forbidden success criteria**: "Done", "Complete", "Working", "Improved", "Better."

### No Placeholders Rule (CRITICAL)
Vague language is a source of bugs and drift. The following terms and patterns are **FORBIDDEN** in any plan:
- **Vague Directives**: "Add appropriate error handling", "Implement logical checks", "Fill in details", "Similar to Task N". (Repeat the code/details!)
- **Aspirational Labels**: "Optimize for performance", "Ensure high quality", "Make it robust". (Define the metric!)
- **Placeholders**: "TBD", "TODO", "[insert here]", "Implement later".
- **Implicit Knowledge**: "Assume library X is installed", "Follow standard patterns". (Link to the skill/rule!)

**If a plan contains these, it must be rejected by the `auditor` during `/audit --pre`.**

## 🏗 Phased Roadmap Construction

### Phase Design Rules
- **3–4 phases maximum** per project. If you need more, the project should be split into sub-projects.
- **Each phase must be independently valuable** — if the project is cancelled after Phase N, the work delivered so far is still usable.
- **Phase boundaries are audit gates** — the `auditor` must verify all phase success metrics before the next phase begins.

### The Interface-First Pattern
See `CLAUDE-global.md` § Interface-First Pattern. Phase 1 of any data-exchange, external-API, or multi-agent-handoff task must define the Contract and obtain explicit user approval before implementation.

### Roadmap Template

Use the bundled `assets/roadmap-template.md` as a starting point for new projects. It includes sections for:
- Project overview and objectives
- Multi-phase planning with goals and deliverables
- Critical path visualization
- Risk assessment and mitigation
- Budget tracking and decisions
- Change log

Copy and customize the template to match your project scope.

---

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
- **Hard Rules**: A list of "Negative Invariants" (what the phase must NEVER do). (e.g., "No silent fallbacks", "No dependencies outside of X").

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
- **Sub-Atomic (Bite-Sized)**: For complex phases, break tasks into 2–10 minute actions (e.g., "Write test", "Run test", "Implement function", "Verify"). This prevents "80% done" stalls.
- **Owned**: Assigned to exactly one agent: `[ ] [coder] Task description`.
- **Measurable**: Has a verifiable outcome — code compiles, test passes, metric threshold met.
- **Scoped**: Touches 8 or fewer source code files. If more, decompose further.
- **Sequenced**: Ordered by dependency. No task appears before its prerequisites.

### Slice Sizing Test
A well-sized task/slice meets **all 3** criteria:
- **Full-stack cut**: crosses every affected layer (not "all models, then all services, then all UI").
- **Independently verifiable**: passes its own success metric without waiting on sibling slices.
- **Context-window-sized**: completable in a single session.

**Exception — expand–contract for wide refactors**: wide refactors are not vertically sliced. Sequence as: (a) introduce the new form alongside the old, (b) migrate call sites in batches, (c) delete the old form. Each step keeps the system green.

### Task Briefing Patterns
For high-rigor or large-scale roadmaps, every atomic task should be expanded into a **Task Brief** in the `IMPLEMENTATION_PLAN.md` or as a sub-document.

**Template**:
- **Component**: [Module/File path]
- **Files Affected**: [List of 1-8 files]
- **Pre-requisites**: [Reference to prior tasks]
- **Logic Outline**: [2-3 bullet high-level logic or API signature]
- **Success Criteria**: [Specific, verifiable outcome]

**Briefing Rules**:
- **NO Vague Directives**: Never say "Implement logic." Say "Implement the intersection algorithm using Rhino.Geometry.Intersect."
- **Explicit Boundaries**: Clearly define which files the task is FORBIDDEN from touching.
- **Verification Mandate**: Every brief must name the command required for verification.

### Task Decomposition Checklist
When breaking a phase into tasks, verify:
- [ ] Can each task be completed without waiting on another in-progress task?
- [ ] Does each task produce a testable artifact (file, output, metric)?
- [ ] Is the responsible agent named?
- [ ] Are file paths or module names specified where relevant?
- [ ] Is the success condition unambiguous?

### Dependency-Level Notation (Optional)

For phases with 5+ tasks, group by dependency level to surface parallelism and identify the critical path. This complements the existing dependency mapping notation (`→`, `~>`, `⇒`).

**Format:**
```markdown
## Phase N: [Title]

### Level 1 (No dependencies — start immediately)
- [ ] [coder] Task A — Success: metric — depends: none
- [ ] [coder] Task B — Success: metric — depends: none

### Level 2 (Depends on Level 1)
- [ ] [coder] Task C — Success: metric — depends: A
- [ ] [auditor] Task D — Success: metric — depends: A, B

### Level 3 (Depends on Level 2)
- [ ] [auditor] Task E — Success: metric — depends: C, D

### Critical Path: A → C → E
```

**When to use:**
- Phase has 5+ tasks with non-obvious dependency ordering
- Parallel execution by sub-agents (`implementation-dispatch`) is planned
- The strategist wants to make the critical path visible

**When NOT to use:**
- Phase has < 5 tasks (flat list is sufficient)
- All tasks are strictly sequential (phases already handle this)
- The dependency chain is linear (Level notation adds no value)

### Command vs. Knowledge Skill Separation

When creating new commands and skills, enforce a clean separation:

| Type | `user-invocable` | Contains | Example |
|:---|:---|:---|:---|
| **Command** | `true` (default) | Numbered workflow steps. User triggers it. | `/audit`, `/handoff` |
| **Knowledge Skill** | `false` | Domain reference material. Agent loads it when executing commands. | `python-patterns`, `visual-composition` |

**Rules:**
- A command should define **how to run** a workflow. It should not embed domain-specific reference tables or glossaries.
- A knowledge skill should define **what to know**. It should not include numbered workflow steps.
- If a single file contains both, consider splitting:
  - Workflow → command in `commands/`
  - Domain reference → skill with `user-invocable: false` in `skills/`
- Multiple commands can reference the same knowledge skill. This is the primary benefit of separation.

**Exception:** Small skills where splitting would create more interface than it removes complexity (fails the Deletion Test) should remain as one file.

### Task Type Vocabulary

| Type | Agent | Description | Example |
| :--- | :--- | :--- | :--- |
| **Implement** | Coder | Write new code or logic | `[coder] Implement C-Value function in c_value.py` |
| **Refactor** | Coder | Restructure existing code | `[coder] Extract data tree logic to separate module` |
| **Validate** | Auditor | Review and verify work | `[auditor] Audit sightline module against python-rhino-grasshopper` |
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
  - PROJECT_TYPE: [code / geometry / data / manuscript / youtube / pptx / pbi-report / hybrid]
  - VALUE_CHECK: [one sentence]
  - VALUE_ROI: [Escalation Tier strategy]
  - MINIMALISM: [smallest viable version]
  - RISKS: [three showstoppers]
- **## Phase 1: [Title]**
  - Objective, Deliverables, Success Metrics, Dependencies, Agent Assignment, Estimated Effort, Risks.
- **## Phase 2: [Title]**
  - (same structure)
- **## Phase [N]: [Title]**
  - Objective, Deliverables, Success Metrics, Hard Rules, Dependencies, Agent Assignment, Estimated Effort, Risks.
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

## 📄 Output Templates

### /blueprint Response Block
When initializing or updating a plan, the `strategist` must present the summary in this format:

```markdown
# 🗺 Blueprint: [Project Name]

## 🎯 Step 0: Value Check
- **Value**: [One-sentence rationale]
- **ROI**: [Escalation Tier strategy — Metadata -> JSON -> Content]
- **Minimalism**: [Smallest viable win]
- **Risk**: [Primary showstopper]

## 🏗 Phased Roadmap
1. **Phase 1**: [Title] → [Success Metric]
    - **Hard Rules**: [Negative invariants]
2. **Phase 2**: [Title] → [Success Metric]
    - **Hard Rules**: [Negative invariants]
3. **Phase 3**: [Title] → [Success Metric]
    - **Hard Rules**: [Negative invariants]

## 🚦 Next Actions
- [ ] [Agent] Task 1
- [ ] [Agent] Task 2

> [!IMPORTANT]
> This plan is optimized for [Minimalism/Speed/Rigor]. Approve to initialize Artifacts/TODO.md.
```