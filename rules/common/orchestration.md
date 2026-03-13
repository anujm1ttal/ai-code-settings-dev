---
name: agent-orchestration
description: Rules for routing, parallel execution, state management, conflict resolution, and project-type routing across the Antigravity Agent fleet.
---

# Agent Orchestration: Antigravity Protocol

## 🛠️ The Core Fleet

Located in `~/.claude/agents/`:

| Agent | Purpose | Required Skills | Owned Commands |
| :--- | :--- | :--- | :--- |
| **strategist** | Project blueprinting, ROI, architecture | `business-analyst`, `project-planner` | `/blueprint` |
| **coder** | Implementation & refactoring | `python-patterns`, `python-rhino`, `typescript-mcp`, `csharp-grasshopper`, `dax-modeling` | — (executes TODO.md tasks) |
| **auditor** | QA, exit reviews, validation | `python-patterns`, `python-rhino`, `typescript-mcp`, `csharp-grasshopper`, `dax-modeling`, `manuscript-review` | `/audit` |
| **scribe** | Documentation & knowledge management | `doc-updater` | `/docs` |
| **concierge** | State sync, intake, session orchestration | `project-journal` | `/sync`, `/ingest`, `/handoff` |

## 🗂️ Project Type Routing

The `strategist` classifies every project during Step 0. This classification determines which agents and skills activate.

| Project Type | Active Agents | Inactive Agents | Primary Skills |
| :--- | :--- | :--- | :--- |
| `code` | All | — | `python-patterns`, `typescript-mcp` |
| `geometry` | All | — | `python-rhino`, `python-patterns`, `csharp-grasshopper` |
| `data` | All | — | `dax-modeling` |
| `manuscript` | strategist, auditor, scribe, concierge | coder | `manuscript-review`, `business-analyst` |
| `hybrid` | All | — | Per-phase skill assignment by strategist |

## ⚡ Automatic Routing (No Prompt Needed)

When the user's intent is clear, route directly:

1. **New request, feature, or "should we"** → Route to **strategist** for `/blueprint` and Step 0.
2. **Code implementation, refactoring, debugging** → Route to **coder**. Equip language-specific skills.
3. **Review, validation, "is this correct"** → Route to **auditor** for Plan Exit Review.
4. **Documentation, README, user guide** → Route to **scribe** via `/docs`.
5. **Manual work intake from Rhino/PBI** → Route to **concierge** via `/ingest`.
6. **Session start, "where was I", status check** → Route to **concierge** via `/sync`.
7. **Session end, context save** → Route to **concierge** via `/handoff`.

When intent is ambiguous → **concierge** applies the Agent Routing Decision Tree (defined in `concierge.md`).

## 🔄 Standard Task Lifecycle

/blueprint (strategist)  
↓  
TODO.md task assigned to agent  
↓  
/audit --pre (auditor) [optional but recommended]  
↓  
Implementation (coder) — marks task [-]  
↓  
/audit (auditor) — validates against skill + success metric  
↓  
PASS → auditor marks task [x]  
FAIL → return to coder (max 2 cycles, then escalate to strategist)  
↓  
/docs (scribe) — update documentation  
↓  
/sync (concierge) — reconcile state  
↓  
/handoff (concierge) — if session is ending

## 🛰️ Parallel Task Execution

ALWAYS use parallel execution for independent operations to maximize throughput:

- **Phase Validation**: Auditor (Security) + Auditor (Logic) + Auditor (Performance) in parallel.
- **Multi-File Refactor**: Coder (Module A) + Coder (Module B) when files have no shared dependencies.
- **Documentation Batch**: Scribe (README) + Scribe (API docs) + Scribe (User guide) in parallel.

**Parallel is FORBIDDEN when**:
- Tasks share mutable state (same file, same `TODO.md` item).
- One task depends on the output of another.
- An `auditor` gate must pass before the next task begins.

## 🏢 Persistence & Source of Truth

Agents MUST NOT rely on chat history alone. They must reference and update these files:

### Core Files (Always Present)

| File | Owner (Create) | Owner (Maintain) | Authority |
| :--- | :--- | :--- | :--- |
| `IMPLEMENTATION_PLAN.md` | Strategist | Strategist | Read-only for all others |
| `TODO.md` | Strategist | Strategist (structure), Coder (`[-]`), Auditor (`[x]`) | See write authority below |
| `ARCH.md` | Strategist | Scribe (formatting + clarity) | Strategist approves structural changes |
| `.agent/current_task.md` | Concierge | Concierge | Schema defined in `skill-project-journal.md` |

### Situational Files (Created When Needed)

| File | Owner (Create) | Trigger |
| :--- | :--- | :--- |
| `DECISION_LOG.md` | Concierge | Architectural pivot or Step 0 change |
| `BRD_SUMMARY.md` | Strategist | `/blueprint` with `business-analyst` skill |
| `EDITORIAL_LETTER.md` | Auditor | `/audit` on `manuscript` project type |

## ✍️ TODO.md Write Authority

Strict hierarchy to prevent state conflicts:

| Agent / Command | Allowed Action | Forbidden Action |
| :--- | :--- | :--- |
| **Strategist** | Create, restructure, add tasks, remove tasks | Mark status (`[-]` or `[x]`) |
| **Coder** | Mark `[-]` (in-progress) | Mark `[x]`, add/remove tasks |
| **Auditor** | Mark `[x]` (complete) after passing all gates | Add/remove tasks, mark `[-]` |
| **`/sync`** | Propose completion (flag for auditor) | Mark `[x]` directly |
| **`/ingest`** | Propose completion (flag for auditor) | Mark `[x]` directly |
| **Scribe** | Read-only | Any writes |
| **Concierge** | Archive completed blocks to `history/` | Modify task content or status |

### TODO.md Task Format

Every task must follow this structure:
- `[ ]` — Not started. Assigned agent in brackets.
- `[-]` — In progress. Coder is actively working.
- `[x]` — Complete. Auditor has verified all gates.

Example:
- `[ ] [coder] Implement sightline calculation — Success: C-Value > 60mm`
- `[-] [coder] Refactor data tree paths — In progress since 2026-03-14`
- `[x] [coder] Set up MCP server scaffold — Verified 2026-03-13`

## ⚖️ The "Step 0" Mandate

Before any agent begins a task, they must confirm the **strategist** has provided:
- **PROJECT_TYPE**: Classification that determines routing and active skills.
- **VALUE_CHECK**: Does this work have a business/ops purpose?
- **MINIMALISM**: Is this the simplest version possible?
- **RISKS**: Have the top three showstoppers been identified?

If Step 0 is missing or incomplete, the agent must **refuse the task** and route to the `strategist`.

## ⚔️ Conflict Resolution

### Auditor Rejection Loop
1. **First rejection**: Auditor returns to `coder` with specific fix instructions and the failing gate.
2. **Second rejection**: Auditor returns to `coder` with a mandatory note to review the relevant `skill-*.md` file.
3. **Third rejection**: Auditor escalates to `strategist`. The task definition is re-evaluated — the plan itself may be flawed.

### Agent Disagreement
- If the `coder` believes a task is technically infeasible, they must document the concern and route to the `strategist` — not silently modify the plan.
- If the `auditor` and `strategist` disagree on a success metric, the `strategist` has final authority (they own the plan).
- If the `scribe` identifies architectural inconsistencies while documenting, they flag for the `strategist` — they do not modify `ARCH.md` structure independently.

### User Override
- The user may bypass Step 0 by explicitly stating "Skip Step 0."
- The bypass is logged in `TODO.md` as: `[ ] [coder] [STEP0-BYPASS] Task description`.
- The `auditor` will flag all `STEP0-BYPASS` tasks with a **HIGH** severity warning during review.

## 🚨 Emergency Protocols

### Context Window Critical
- If context exceeds ~60%, the `concierge` proactively triggers `/handoff`.
- All active agents must yield to the handoff process.

### Security Incident
- Follows the protocol defined in `security.md`: FREEZE → AUDIT → REMEDIATE → RESUME.
- All agents halt. Only the `auditor` operates (in security mode).

### State File Corruption
- If `TODO.md` or `IMPLEMENTATION_PLAN.md` are missing or corrupted:
  1. Check `history/` for the most recent archive.
  2. If no archive exists, the `strategist` must reconstruct from `.agent/current_task.md` and `DECISION_LOG.md`.
  3. Run `/sync` to validate the reconstructed state.