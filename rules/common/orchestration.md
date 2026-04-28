---
name: agent-orchestration
description: Canonical source for agent routing, task lifecycle, Artifacts/TODO.md authority, conflict resolution, and project-type activation across the Claude Code AI OS.
---

# Agent Orchestration

## The Fleet

| Agent | Role | Capability Boundary |
|:---|:---|:---|
| **strategist** | Architecture, ROI, roadmaps | **Write**: `IMPLEMENTATION_PLAN.md`, `TODO.md` |
| **coder** | Implementation, refactoring | **Write**: Source code, test files, `[-]` status |
| **auditor** | QA, technical review | **Write**: `AUDIT_REPORT.md`, `Artifacts/TODO.md` (`[x]`) |
| **scribe** | Documentation, teaching | **Write**: All Markdown docs in `Artifacts/` (exception: `README.md`) |
| **council** | Synthesis, stress-testing | **Write**: `DECISION_LOG.md` |
| **creative-director** | Visual spec, hierarchy | **Write**: `Artifacts/LAYOUT_SPEC.md` |
| **concierge** | State, sync, intake | **Write**: `Artifacts/LEARNINGS.md`, `/clean` execution |

## Project Type Routing

The `strategist` classifies every project during Step 0. This determines active agents and skills. Foundational skills (e.g., `cd-foundations`) are auto-activated based on project type.

| Project Type | Core Agents (Auto) | Available (On Demand) | Inactive |
|:---|:---|:---|:---|
| `youtube` | strategist, scribe, concierge | auditor | creative-director, coder |
| `pptx` | strategist, creative-director, concierge | coder, auditor | scribe |
| `pbi-report` | strategist, creative-director, coder | auditor, concierge | scribe |
| `geometry` | strategist, coder, auditor | concierge | scribe, creative-director |
| `code` | strategist, coder, auditor | concierge, scribe | creative-director |
| `manuscript`| strategist, scribe, auditor | concierge | coder, creative-director |
| `hybrid` | concierge, strategist | All | — |


## Command Fleet (Operational Layer)

| Command | Owner | Purpose | Context Boundary |
|:---|:---|:---|:---|
| `/blueprint` | strategist | Initialize or pivot the project roadmap | Writes to `IMPLEMENTATION_PLAN.md` |
| `/audit` | auditor | Gate-based quality review | Writes to `AUDIT_REPORT.md` |
| `/sync` | concierge | Reconcile filesystem drift with plan | Validates `Artifacts/` vs source |
| `/ingest` | concierge | Import manual CAD/BI work into AI context | Formalizes `Artifacts/LAYOUT_SPEC.md` |
| `/handoff` | concierge | Clean session termination & brief creation | Writes to `Artifacts/history/` |
| `/registry-audit`| auditor | Cross-reference integrity check for the OS registry | Validates links/enums |
| `/council` | council | High-rigor multi-persona deliberation | Follows `COUNCIL_PROTOCOLS.md` |
| `/grill` | strategist | Stress-test a plan for hidden risks | Active interview mode |
| `/sweep` | strategist | Global tech-debt and redundancy scan | Registry-wide discovery |
| `/snapshot` | auditor | Factual codebase dump for external review | Purely descriptive |
| `/clean` | concierge | Purge `Artifacts/Temp/` and transient files | Maintenance mode |
| `/learn` | concierge | Capture a persistent project lesson | Writes to `Artifacts/LEARNINGS.md` |
| `/graduate` | scribe | Move project lessons to global OS settings | Writes to Global Registry |

---

## ⚡ The Micro-Task Protocol (MTP)
For minor edits that meet all criteria:
- **Scope**: ≤1 source file and ≤30 lines of code.
- **Complexity**: No architectural change, no new dependencies.
- **Rigor**: Still requires verification (tests or manual logs).

**Procedure**:
1. Skip the full `/blueprint` and Step 0 interview.
2. Provide a one-line `VALUE_CHECK` (e.g., `VALUE_CHECK: Fix layout alignment in Header component to match spec`).
3. Proceed directly to implementation and verification.

---

## Automatic Routing

1. **Planning, scoping, "should we"** → **strategist** (`/blueprint`)
2. **Plan stress-testing, "grill me", shared understanding** → **strategist** or **council** (`/grill`)
3. **Codebase discovery, tech-debt mapping, redundancy scans** → **strategist** (`/sweep`)
4. **Bug investigation, root-cause analysis, fix planning** → **coder** (`/triage`)
5. **Code implementation, refactoring, debugging** → **coder** (equip skills per table above)
6. **Review, validation, "is this correct"** → **auditor** (`/audit`)
7. **Factual codebase snapshot, compliance report** → **auditor** (`/snapshot`)
8. **Documentation, READMEs, user guides** → **scribe** (`/docs`)
9. **Teaching, tours, "how does this work"** → **scribe** (`/explain`)
10. **Manual work intake from Rhino/PBI** → **concierge** (`/ingest`)
11. **Session start, "where was I"** → **concierge** (`/sync`)
12. **Session end, context save** → **concierge** (`/handoff`)
13. **Project hygiene, cleanup transient files** → **concierge** (`/clean`)
14. **High-rigor deliberation, consensus, conflict** → **council** (`/council`)
15. **Domain definitions, ubiquitous language, glossary extraction** → **scribe** (`glossary-extraction`)
16. **Ambiguous** → **concierge** asks a clarifying question before routing.

## Task Lifecycle

```
/blueprint (strategist)
  → Requirements Interview (Step 1)
  → Grilling Phase (Step 2) [Optional/High-Complexity] → shared understanding via `/grill`
  → Step 0 Challenge (Step 3)
  → Artifacts/TODO.md task assigned (Phase 1)
  → [pptx/pbi-report only] creative-director → Artifacts/LAYOUT_SPEC.md
  → /audit --pre (optional) → GO / NO-GO
  → Implementation (coder) — marks [-]
  → /audit (auditor) — validates → PASS: marks [x] | FAIL: return to coder
  → /docs (scribe) → /sync (concierge) → /handoff (if ending)

> [!IMPORTANT]
> **Approval Discipline**: Every plan approval or execution request MUST follow the `Approval Label Rubric` defined in `standards.md`.
```

<HARD-GATE>
No agent may begin implementation, write code, scaffold projects, or take any implementation action until Step 0 is complete AND the user has approved the plan. This applies to EVERY project regardless of perceived simplicity. "Simple" projects are where unexamined assumptions cause the most wasted work.
</HARD-GATE>

## Artifacts/TODO.md Authority (Single Source)

| Agent / Command | Allowed | Forbidden |
|:---|:---|:---|
| **Strategist** | Create, restructure, add/remove tasks | Mark status |
| **Coder** | Mark `[-]` (in-progress) | Mark `[x]`, add/remove tasks |
| **Auditor** | Mark `[x]` (complete) after all gates pass | Add/remove tasks |
| **`/sync`, `/ingest`** | Propose completion (flag for auditor) | Mark `[x]` directly |
| **Scribe, Concierge** | Read-only (concierge may archive to `Artifacts/history/`) | Modify content or status |

**Task format**: `[ ] [agent] Task description — Success: metric`
- `[ ]` Not started | `[-]` In progress | `[x]` Auditor-verified complete

## Persistence

- **Project State Persistence [HARD-GATE]**: All state files MUST live in the **Artifacts/** directory within the true logical project root (the source code repository). 
- **No Shadow-Only State**: Never write project-specific state ONLY to global AI directories (e.g., `~/.claude/projects/` or `~/.gemini/`). 
- **Absolute Path Requirement**: Always use the **absolute file path** of the current code workspace and the `Artifacts/` folder when writing or reading state files to prevent shadow directory collisions.
- **Platform Redirection Warning**: Platforms may automatically redirect `IsArtifact: true` calls to shadow folders. To ensure persistence, you MUST manually perform a mirrored write with `IsArtifact: false` to the absolute workspace path.

| File | Owner (Create) | Owner (Maintain) | Purpose |
|:---|:---|:---|:---|
| `Artifacts/MEMORY_ANCHORS.md` | Strategist | Strategist | **Cold Storage**: Project-wide constants, constraints, and non-negotiables. |
| `Artifacts/Temp/` | All | Concierge (Cleanup) | **Transient Storage**: One-off diagrams, scratch scripts, and temporary analysis. |
| `.agent/current_task.md` | Concierge | Concierge | Session focus |
| `Artifacts/LOCAL_AGENT_PROFILES.json` | Strategist | Strategist | Sub-agent role definitions |
| `Artifacts/IMPLEMENTATION_PLAN.md` | Strategist | Strategist | **The "How & Why"**: Technical design and rationale. |
| `Artifacts/TODO.md` | Strategist | All (see authority) | **The "Who & When"**: High-level execution status. |
| `Artifacts/ARCH.md` | Strategist | Scribe (formatting) | Long-term system architecture |
| `Artifacts/COUNCIL_PROTOCOLS.md` | Strategist | Strategist | Deliberation rules for high-rigor decisions |
| `Artifacts/DECISION_LOG.md` | Concierge | Concierge | Pivot tracking |
| `Artifacts/LEARNINGS.md` | Concierge | Concierge | Knowledge capture |
| `Artifacts/LAYOUT_SPEC.md` | Creative Director | Creative Director | Visual specs |

> [!NOTE]
> **Transient State Exception**: Platform-level logs for background commands (e.g., in system Temp directories) are managed by the host binary and are inherently transient. They are exempt from the `Artifacts/` persistence requirement.


## Artifact Separation: Plan vs. TODO

To prevent information redundancy and "maintenance debt":

1.  **IMPLEMENTATION_PLAN.md**: Must contain the **technical heavy lifting**. Specific file paths, logical changes, dependency orders, and code snippets belong here.
2.  **Plan Pruning [HARD-GATE]**: To prevent bloat, only the **Current Phase** and **Upcoming Phases** remain in the Plan. Once a Phase is completed, its technical spec MUST be moved to `Artifacts/history/PLAN_Phase_[N].md`.
3.  **TODO.md**: Must remain a **"Thin TODO"**. It should reference Phase numbers or high-level milestones from the plan.
    - **Forbidden**: Copy-pasting detailed file logic or implementation steps from the Plan into the TODO.
    - **Required**: Status tracking (`[-]`, `[x]`) only happens in the TODO.

**Rule**: If a change requires updating technical logic, update the Plan. If a change requires updating execution status, update the TODO.

## Conflict Resolution

- **Auditor rejection loop**: 1st → specific fix. 2nd → mandatory skill-file review. 3rd → escalate to strategist (task definition may be flawed).
- **Agent disagreement**: Coder documents concern → routes to strategist. Strategist has final authority on success metrics.
- **User override**: User says "Skip Step 0" → logged as `[STEP0-BYPASS]` in Artifacts/TODO.md → auditor flags HIGH severity.

## Global Repository (AI OS Settings)

The repository at `c:\Users\44547\source\repos\ai-code-settings` acts as the **Global Registry** for rules, skills, and standards.

- **Global Inbox**: Cross-project learnings are staged at `c:\Users\44547\source\repos\ai-code-settings\Artifacts\GLOBAL_INBOX.md`.
- **Graduation**: Recurring patterns identified in project-specific `LEARNINGS.md` should be graduated to the global registry using `/learn --global` during a project session, or `/graduate` when working inside the global repository.

## Parallel Execution

To maximize throughput and rigor, the Agent OS utilizes parallel agent sessions for independent or high-stakes operations:

### 1. Multi-Persona Audit (`/audit --team`)
The `auditor` spawns parallel reviewers to audit the same code block:
- **Compliance Reviewer**: Checks against `coding-style.md`.
- **Domain Specialist**: Checks against specific skill (e.g., `rhino-e2e-testing`).
- **Risk Reviewer**: Audits for security and edge cases.
*Result: Aggregated into `Artifacts/AUDIT_REPORT.md`.*

### 2. Independent Module Refactor
The `coder` can spawn sub-agents to refactor non-dependent modules simultaneously:
- **Sub-Agent A**: Refactors `src/geometry/`
- **Sub-Agent B**: Refactors `src/data_processing/`
*Restriction: Parallel writes to the same file are FORBIDDEN.*

### 3. Council Deliberation (`/council`)
The `council` agent orchestrates a parallel "debate" between the Strategist, Coder, and Auditor to resolve architectural conflict.

---

## Standard Taxonomies

### 1. Status Hierarchy
| Marker | Level | Authority | Meaning |
|:---|:---|:---|:---|
| `DONE` | Claim | Coder | Work finished, ready for audit. |
| `PASS` | Result | Auditor | Audit gate cleared (Logic/Style). |
| `[x]` | Final | Auditor | Task complete in `TODO.md`. **The ONLY terminal state.** |
| `CLEAN` | Security | Auditor | Security sweep passed (No secrets/vulnerabilities). |
| `RECONCILED`| Sync | Concierge | Filesystem matches artifact state. |

### 2. Severity Scale
- **CRITICAL**: Breaking change, security breach, or data loss risk.
- **HIGH**: Feature-blocking bug, major architectural drift.
- **MEDIUM**: Non-blocking bug, documentation staleness, minor style drift.
- **LOW**: Optimization hint, suggestion, non-visible polish.
- **INFO**: Factual observation, no action required.

---

- **Always `/handoff` before ending**: Any session with code changes, documentation updates, or design decisions MUST end with `/handoff`. This captures learnings, snapshots TODO state, and writes a brief for the next session. Exiting without `/handoff` breaks the feedback loop and wastes re-orientation time.
- **Concierge prompt**: If the agent detects the user is wrapping up (e.g., "thanks", "that's it", "done for now") without a `/handoff`, the concierge should suggest it.

## Emergency Protocols

- **Context window >60%**: Concierge triggers `/handoff`. All agents yield.
- **Security incident**: FREEZE → AUDIT → REMEDIATE → RESUME (see `security.md`).
- **State file corruption**: Check `Artifacts/history/` → reconstruct from `Artifacts/.agent/current_task.md` + `Artifacts/DECISION_LOG.md` → `/sync`.