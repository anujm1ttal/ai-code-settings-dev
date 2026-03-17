---
name: agent-orchestration
description: Canonical source for agent routing, task lifecycle, TODO.md authority, conflict resolution, and project-type activation across the Antigravity fleet.
---

# Agent Orchestration

## The Fleet

| Agent | Purpose | Owned Commands |
|:---|:---|:---|
| **strategist** | Architecture, ROI, phased roadmaps | `/blueprint` |
| **coder** | Implementation & refactoring | — (executes TODO.md) |
| **auditor** | QA, exit reviews, validation | `/audit` |
| **scribe** | Documentation & knowledge management | `/docs`, `/explain` |
| **concierge** | State sync, intake, session orchestration | `/sync`, `/ingest`, `/handoff` |

## Project Type Routing

The `strategist` classifies every project during Step 0. This determines active agents and skills.

| Type | Active Agents | Primary Skills |
|:---|:---|:---|
| `code` | All | `python-patterns`, `typescript-mcp`, `codebase-navigator` |
| `geometry` | All | `python-rhino`, `python-patterns`, `csharp-grasshopper`, `codebase-navigator` |
| `data` | All | `dax-modeling`, `codebase-navigator` |
| `manuscript` | strategist, auditor, scribe, concierge | `manuscript-review`, `business-analyst` |
| `youtube` | strategist, scribe, auditor, concierge | `youtube-strategy`, `youtube-scriptwriting`, `youtube-retention` |
| `hybrid` | All | Per-phase skill assignment, `codebase-navigator` always available |

## Automatic Routing

1. **Planning, scoping, "should we"** → **strategist** (`/blueprint`)
2. **Code implementation, refactoring, debugging** → **coder** (equip skills per table above)
3. **Review, validation, "is this correct"** → **auditor** (`/audit`)
4. **Documentation, READMEs, user guides** → **scribe** (`/docs`)
5. **Teaching, tours, "how does this work"** → **scribe** (`/explain`)
6. **Manual work intake from Rhino/PBI** → **concierge** (`/ingest`)
7. **Session start, "where was I"** → **concierge** (`/sync`)
8. **Session end, context save** → **concierge** (`/handoff`)
9. **Ambiguous** → **concierge** asks a clarifying question before routing.

## Task Lifecycle

```
/blueprint (strategist) → TODO.md task assigned
  → /audit --pre (optional) → GO / NO-GO
  → Implementation (coder) — marks [-]
  → /audit (auditor) — validates → PASS: marks [x] | FAIL: return to coder
  → /docs (scribe) → /sync (concierge) → /handoff (if ending)
```

## TODO.md Authority (Single Source)

| Agent / Command | Allowed | Forbidden |
|:---|:---|:---|
| **Strategist** | Create, restructure, add/remove tasks | Mark status |
| **Coder** | Mark `[-]` (in-progress) | Mark `[x]`, add/remove tasks |
| **Auditor** | Mark `[x]` (complete) after all gates pass | Add/remove tasks |
| **`/sync`, `/ingest`** | Propose completion (flag for auditor) | Mark `[x]` directly |
| **Scribe, Concierge** | Read-only (concierge may archive to `history/`) | Modify content or status |

**Task format**: `[ ] [agent] Task description — Success: metric`
- `[ ]` Not started | `[-]` In progress | `[x]` Auditor-verified complete

## Persistence

| File | Owner (Create) | Owner (Maintain) |
|:---|:---|:---|
| `IMPLEMENTATION_PLAN.md` | Strategist | Strategist (read-only for others) |
| `TODO.md` | Strategist | Strategist (structure) + see authority above |
| `ARCH.md` | Strategist | Scribe (formatting), Strategist (structure) |
| `.agent/current_task.md` | Concierge | Concierge |
| `DECISION_LOG.md` | Concierge | Concierge (append-only, on pivots) |
| `BRD_SUMMARY.md` | Strategist | Scribe |
| `EDITORIAL_LETTER.md` | Auditor | Scribe |

## Conflict Resolution

- **Auditor rejection loop**: 1st → specific fix. 2nd → mandatory skill-file review. 3rd → escalate to strategist (task definition may be flawed).
- **Agent disagreement**: Coder documents concern → routes to strategist. Strategist has final authority on success metrics.
- **User override**: User says "Skip Step 0" → logged as `[STEP0-BYPASS]` in TODO.md → auditor flags HIGH severity.

## Parallel Execution

- **Allowed**: Independent file edits, parallel audits, batch documentation.
- **Forbidden**: Shared mutable state, dependent outputs, pre-audit-gate tasks.

## Emergency Protocols

- **Context window >60%**: Concierge triggers `/handoff`. All agents yield.
- **Security incident**: FREEZE → AUDIT → REMEDIATE → RESUME (see `security.md`).
- **State file corruption**: Check `history/` → reconstruct from `.agent/current_task.md` + `DECISION_LOG.md` → `/sync`.