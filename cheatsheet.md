# Antigravity — Cheat Sheet

## The Golden Loop
/sync → work → /audit → /docs → /handoff

## Commands

| Command | What It Does |
| :--- | :--- |
| `/blueprint` | Plan a new project, add a phase, or re-plan after a pivot |
| `/audit` | Validate completed work against skill standards and success metrics |
| `/audit --pre` | Pre-check a task definition before implementation begins |
| `/ingest` | Import manual work from Rhino, Power BI, or external editors |
| `/sync` | Reconcile project state — run at every session start |
| `/docs` | Auto-detect and fix documentation gaps |
| `/docs --internal` | Update README.md, ARCH.md, developer docs |
| `/docs --user` | Generate Quick Start guides for stakeholders |
| `/docs --reference` | Generate API docs, MCP tool schemas, DAX measure catalogs |
| `/handoff` | Save session state and exit cleanly — run at every session end |

## Agents

| Agent | Does | Does NOT |
| :--- | :--- | :--- |
| **Strategist** | Plans, scopes, architects, classifies project type | Write code, mark tasks complete |
| **Coder** | Implements, refactors, debugs, marks tasks `[-]` | Mark tasks `[x]`, modify plan |
| **Auditor** | Reviews, validates, marks tasks `[x]` (sole authority) | Write code, modify plan |
| **Scribe** | Documents, updates README/ARCH, generates guides | Write code, modify plan |
| **Concierge** | Syncs state, ingests work, manages handoffs | Write code, mark tasks `[x]` |

## TODO.md Status

| Marker | Meaning | Set By |
| :--- | :--- | :--- |
| `[ ]` | Not started | Strategist |
| `[-]` | In progress | Coder |
| `[x]` | Complete + verified | Auditor only |

## Task Format
`[ ] [agent] Task description — depends: [dependency] — Success: [metric]`

## Project Types

| Type | When | Coder Active? |
| :--- | :--- | :--- |
| `code` | Software, MCP, scripts | Yes |
| `geometry` | Rhino/GH, stadium design | Yes |
| `data` | Power BI, DAX | Yes |
| `manuscript` | Books, editorial review | No |
| `hybrid` | Multi-domain | Per-phase |

## Rule Precedence
security → coding-style → orchestration → standards

## Escalation
Audit fail #1 → Coder fixes · #2 → Coder reviews skill file · #3 → Strategist re-evaluates task

## /sync Report Categories
✅ RECONCILED — planned work confirmed
⚠️ DRIFT — unplanned changes detected
❌ STALE — no progress on in-progress tasks
🔄 MISMATCH — state file inconsistencies

## Key Files

| File | Owner |
| :--- | :--- |
| `IMPLEMENTATION_PLAN.md` | Strategist |
| `TODO.md` | Strategist (structure) / Auditor (completion) |
| `ARCH.md` | Strategist (creates) / Scribe (maintains) |
| `.agent/current_task.md` | Concierge |
| `DECISION_LOG.md` | Concierge |

## When In Doubt
- Lost context? → `/sync`
- Did manual work? → `/ingest`
- Session ending? → `/handoff`
- Docs blocking audit? → `/docs`
- Task keeps failing? → Let it escalate to strategist