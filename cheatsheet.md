# Antigravity — Cheat Sheet

## The Golden Loop (Task Lifecycle)
/sync (recover) → /blueprint (plan + interview) → work (build) → /audit (verify) → /docs (document) → /handoff (save)

## Session Lifecycle
Boot: /sync (drift scan) → work → Shutdown: /handoff (persist)

## Commands

| Command | What It Does |
| :--- | :--- |
| `/blueprint` | Plan a new project, add a phase, or re-plan after a pivot (Strategist) |
| `/audit` | Validate completed work against skill standards and success metrics (Auditor) |
| `/audit --pre` | Pre-check a task definition before implementation begins |
| `/deck` | Scaffold, build, and validate PowerPoint projects (Strategist / CD) |
| `/explain` | Walk through / teach a codebase — "how does this work?" (Scribe) |
| `/ingest` | Import manual work from Rhino, Power BI, or external editors (Concierge) |
| `/sync` | Reconcile project state — run at every session start (Concierge) |
| `/docs` | Auto-detect and fix documentation gaps (Scribe) |
| `/docs --internal` | Update README.md, ARCH.md, developer docs |
| `/docs --user` | Generate Quick Start guides for stakeholders (Tier 2) |
| `/docs --reference` | Generate API docs, MCP tool schemas, DAX measure catalogs (Tier 3) |
| `/ideate` | Generate YouTube concepts: Title, Thumbnail, Angle (Strategist) |
| `/script` | Draft YouTube A/V scripts (Scribe) |
| `/pack` | Generate YouTube SEO metadata (Scribe) |
| `/learn` | Capture project-specific lessons into LEARNINGS.md (Concierge) |
| `/handoff` | Save session state and exit cleanly (Concierge) |

## Agents

| Agent | Does | Does NOT |
| :--- | :--- | :--- |
| **Strategist** | Plans, scopes, architects, Step 0 ROI | Write code, mark tasks complete |
| **Coder** | Implements, refactors, debugs, marks `[-]` | Mark `[x]`, modify plan structure |
| **Auditor** | QA, exit reviews, marks `[x]` (sole authority) | Write code, modify plan structure |
| **Scribe** | Documentation, ARCH maintenance, /explain tours | Write code, mark tasks complete |
| **Creative Director** | Visual spec, LAYOUT_SPEC.md, composition | Write code, mark tasks `[x]` |
| **Concierge** | Syncs state, ingests work, /handoff, /learn | Write code, mark tasks `[x]` |

## TODO.md Status

| Marker | Meaning | Set By |
| :--- | :--- | :--- |
| `[ ]` | Not started | Strategist |
| `[-]` | In progress | Coder |
| `[x]` | Complete + verified | Auditor only |

## Task Format
`[ ] [agent] Task description — Success: metric`

## Project Types

| Type | When | Coder Active? |
| :--- | :--- | :--- |
| `code` | Software, MCP, scripts | Yes |
| `geometry` | Rhino/GH, stadium design | Yes |
| `data` | Power BI, DAX | Yes |
| `manuscript` | Books, editorial review | No |
| `youtube` | Video packaging, scripting, retention | No |
| `pptx` | PowerPoint decks & presentations | Yes |
| `pbi-report` | Power BI report front-end | Yes |
| `hybrid` | Multi-domain | Per-phase |

## Rule Precedence
security → coding-style → orchestration → standards

## Step 0 Challenge
1. **PROJECT_TYPE**: code, geometry, data, manuscript, youtube, pptx, pbi-report, hybrid
2. **VALUE_CHECK**: Single sentence on business/operational impact
3. **MINIMALISM**: Smallest viable version (kill bloat)
4. **RISKS**: Three technical or data showstoppers

## Escalation
Audit fail #1 → Coder fixes · #2 → Coder reviews skill file · #3 → Strategist re-evaluates task

## Audit & Sync Status

| Marker | Meaning | Source |
| :--- | :--- | :--- |
| `PASS` | Audit gate cleared | Auditor |
| `FAIL` | Audit gate blocked | Auditor |
| `GO` | Pre-audit approved | `/audit --pre` |
| `NO-GO` | Pre-audit blocked | `/audit --pre` |
| `RECONCILED`| Planned work confirmed | `/sync` |
| `DRIFT` | Unplanned changes | `/sync` |
| `STALE` | No progress detected | `/sync` |
| `CLEAN` | Security sweep passed | Security |

## Key Files

| File | Owner |
| :--- | :--- |
| `IMPLEMENTATION_PLAN.md` | Strategist |
| `TODO.md` | Strategist (structure) / Auditor (completion) |
| `ARCH.md` | Strategist (creates) / Scribe (maintains) |
| `.agent/current_task.md` | Concierge |
| `DECISION_LOG.md` | Concierge |
| `LEARNINGS.md` | Concierge (append-only) |
| `LAYOUT_SPEC.md` | Creative Director |
| `BRD_SUMMARY.md` | Strategist |
| `EDITORIAL_LETTER.md` | Auditor |

## When In Doubt
- Lost context? → `/sync`
- Did manual work? → `/ingest`
- Session ending? → `/handoff`
- Docs blocking audit? → `/docs`
- Task keeps failing? → Let it escalate to strategist