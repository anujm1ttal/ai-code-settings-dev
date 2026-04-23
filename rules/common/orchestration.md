---
name: agent-orchestration
description: Canonical source for agent routing, task lifecycle, Artifacts/TODO.md authority, conflict resolution, and project-type activation across the Claude Code AI OS.
---

# Agent Orchestration

## The Fleet

| Agent | Purpose | Owned Commands |
|:---|:---|:---|
| **strategist** | Architecture, ROI, phased roadmaps, tech-debt discovery | `/blueprint`, `/sweep` |
| **coder** | Implementation & refactoring | — (executes Artifacts/TODO.md) |
| **auditor** | QA, exit reviews, validation, factual snapshots | `/audit`, `/snapshot` |
| **scribe** | Documentation & knowledge management | `/docs`, `/explain` |
| **council** | High-rigor deliberation & consensus | `/council` |
| **creative-director** | Visual spec & composition planning | — (produces `Artifacts/LAYOUT_SPEC.md`) |
| **concierge** | State sync, intake, session orchestration, hygiene | `/sync`, `/ingest`, `/handoff`, `/learn`, `/clean` |

## Project Type Routing

The `strategist` classifies every project during Step 0. This determines active agents and skills. Foundational skills (e.g., `cd-foundations`) are auto-activated based on project type.

| Type | Active Agents | Primary Skills |
|:---|:---|:---|
| `code` | All | `python-patterns`, `typescript-mcp`, `codebase-navigator` |
| `geometry` | All | `cd-foundations` (auto), `python-rhino-grasshopper`, `rhino-e2e-testing`, `python-patterns`, `codebase-navigator` |
| `data` | All | `dax-modeling`, `codebase-navigator` |
| `manuscript` | strategist, auditor, scribe, concierge | `manuscript-review`, `business-analyst` |
| `youtube` | strategist, scribe, auditor, concierge | `youtube-strategy`, `youtube-scriptwriting`, `youtube-retention`, `banana-prompt` |
| `pptx` | strategist, creative-director, coder, auditor, concierge | `powerpoint-patterns`, `visual-composition`, `python-patterns`, `banana-prompt` |
| `pbi-report` | strategist, creative-director, coder, auditor, concierge | `powerbi-report`, `visual-composition`, `dax-modeling` |
| `hybrid` | All | Per-phase skill assignment, `codebase-navigator` always available |
| *(all types)* | coder, auditor, scribe | `codebase-navigator`, `systematic-debugging`, `implementation-dispatch` |


## Automatic Routing

1. **Planning, scoping, "should we"** → **strategist** (`/blueprint`)
2. **Codebase discovery, tech-debt mapping, redundancy scans** → **strategist** (`/sweep`)
3. **Code implementation, refactoring, debugging** → **coder** (equip skills per table above)
4. **Review, validation, "is this correct"** → **auditor** (`/audit`)
5. **Factual codebase snapshot, compliance report** → **auditor** (`/snapshot`)
6. **Documentation, READMEs, user guides** → **scribe** (`/docs`)
7. **Teaching, tours, "how does this work"** → **scribe** (`/explain`)
7. **Manual work intake from Rhino/PBI** → **concierge** (`/ingest`)
8. **Session start, "where was I"** → **concierge** (`/sync`)
9. **Session end, context save** → **concierge** (`/handoff`)
10. **Project hygiene, cleanup transient files** → **concierge** (`/clean`)
| **concierge** (as orchestrator) or **strategist** (as synthesis chair). The "Conflict Resolution Engine" — forces multiple perspectives on a single decision.
11. **High-rigor deliberation, consensus, conflict** → **council** (`/council`)
12. **Ambiguous** → **concierge** asks a clarifying question before routing.

## Task Lifecycle

```
/blueprint (strategist)
  → Requirements Interview (Step 1)
  → Step 0 Challenge (Step 2)
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

## Session Discipline

- **Always `/handoff` before ending**: Any session with code changes, documentation updates, or design decisions MUST end with `/handoff`. This captures learnings, snapshots TODO state, and writes a brief for the next session. Exiting without `/handoff` breaks the feedback loop and wastes re-orientation time.
- **Concierge prompt**: If the agent detects the user is wrapping up (e.g., "thanks", "that's it", "done for now") without a `/handoff`, the concierge should suggest it.

## Emergency Protocols

- **Context window >60%**: Concierge triggers `/handoff`. All agents yield.
- **Security incident**: FREEZE → AUDIT → REMEDIATE → RESUME (see `security.md`).
- **State file corruption**: Check `Artifacts/history/` → reconstruct from `Artifacts/.agent/current_task.md` + `Artifacts/DECISION_LOG.md` → `/sync`.