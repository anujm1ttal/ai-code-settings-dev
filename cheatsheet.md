# Agent OS — Cheat Sheet

## The Golden Loop (Task Lifecycle)
/sync (recover) → /blueprint (plan + interview) → work (build) → /audit (verify) → /docs (document) → /handoff (save)

## Session Lifecycle
Boot: /sync (drift scan) → work → Shutdown: /handoff (persist)

## Commands

| Command | What It Does |
| :--- | :--- |
| `/sync` | Reconcile state & artifact drift — session start (Concierge) |
| `/blueprint` | Plan project roadmap (Strategist) |
| `/grill` | Stress-test a plan for hidden risks (Strategist/Council) |
| `/audit` | Quality gate validation (Auditor) |
| `/triage` | Root-cause analysis & fix planning (Coder) |
| `/docs` | Documentation lifecycle management (Scribe) |
| `/explain` | Codebase touring & teaching (Scribe) |
| `/council` | High-rigor consensus deliberation (Council) |
| `/ingest` | Import manual CAD/BI work into context (Concierge) |
| `/handoff` | Clean session termination & brief (Concierge) |
| `/clean` | Purge transient/temp artifacts (Concierge) |
| `/learn` | Capture project-specific lessons (Concierge) |
| `/sweep` | Global tech-debt discovery & redundancy scan (Strategist) |
| `/snapshot` | Factual codebase report for review (Auditor) |
| `/registry-audit` | Cross-reference integrity check for the OS registry (Auditor) |
| `/hooks` | **[Legacy]** View active path guards and auto-linters |
| `systematic-debug` | 4-phase root-cause investigation process (Coder/Auditor) |
| `dispatch` | Subagent orchestration and two-stage review (Coder) |

## Agents

| Agent | Core Authority |
| :--- | :--- |
| **Strategist** | `IMPLEMENTATION_PLAN.md`, `TODO.md` (structure), `/grill` |
| **Coder** | Source code, test files, `[-]` status, `/triage` |
| **Auditor** | `AUDIT_REPORT.md`, `TODO.md` (`[x]`), `PASS` result |
| **Scribe** | `Artifacts/` Markdown docs (exception: `README.md`) |
| **Council** | `DECISION_LOG.md`, `/council` consensus |
| **Creative Dir**| `Artifacts/LAYOUT_SPEC.md`, visual hierarchy |
| **Concierge** | `Artifacts/LEARNINGS.md`, `/sync`, `/clean` |

## Artifacts/TODO.md Status

| Marker | Level | Meaning |
| :--- | :--- | :--- |
| `DONE` | Claim | Coder: Work finished, ready for audit |
| `PASS` | Result | Auditor: Logic/Style gate cleared |
| `[x]` | Final | Auditor: Task complete in `TODO.md` |
| `CLEAN` | Security | Auditor: Security sweep passed |
| `RECONCILED`| Sync | Concierge: Workspace matches state |

## ⚡ Micro-Task Protocol (MTP)
For minor edits (≤1 file, ≤30 lines, no arch change):
1. Skip full `/blueprint` / Step 0 interview.
2. Provide one-line `VALUE_CHECK`.
3. Build → Verify → Audit → [x].

## Project Types

| Type | Auto-Activated Agents (Core) |
| :--- | :--- |
| `code` | strategist, coder, auditor |
| `geometry` | strategist, coder, auditor |
| `data` | strategist, coder, auditor |
| `manuscript`| strategist, scribe, auditor |
| `youtube` | strategist, scribe, concierge |
| `pptx` | strategist, creative-director, concierge |
| `pbi-report` | strategist, creative-director, coder |
| `hybrid` | Multi-domain | Per-phase |

## Rule Precedence
security → coding-style → orchestration → standards

## Step 0 Challenge
1. **PROJECT_TYPE**: code, geometry, data, manuscript, youtube, pptx, pbi-report, hybrid
2. **VALUE_CHECK**: Single sentence on business/operational impact
3. **MINIMALISM**: Smallest viable version (kill bloat)
4. **NO PLACEHOLDERS**: No "TBD", "error handling", or vague directives
5. **RISKS**: Three technical or data showstoppers

## Escalation
Audit fail #1 → Coder fixes · #2 → Coder reviews skill file · #3 → Strategist re-evaluates task

## 🐍 Python Runtime Matrix
- **Host (3.12+)**: `list[T]`, `T | U`, `loguru`, `pydantic`.
- **Rhino (3.9)**: `List[T]`, `Union`, `print()`, NO Pydantic.
- **Inside (3.12+)**: Host runtime with `RhinoCommon` access.

## 🧪 Testing Strategy
Follow [testing-strategy.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/testing-strategy.md) for lane selection and evidence.
- **Lane B (Pure)**: Math, logic, parsing. No Rhino needed.
- **Lane A (E2E)**: Real geometry, RhinoCommon.
- **Rule**: Use the cheapest lane that proves the claim.

## 🚦 Severity Scale
**CRITICAL** → **HIGH** → **MEDIUM** → **LOW** → **INFO**

## Audit & Sync Status

| Marker | Meaning | Source |
| :--- | :--- | :--- |
| `PASS` | Audit gate cleared | Auditor |
| `FAIL` | Audit gate blocked | Auditor |
| `GO` | Pre-audit approved | `/audit --pre` |
| `NO-GO` | Pre-audit blocked | `/audit --pre` |
| `RECONCILED`| Planned work confirmed | `/sync` |
| `DRIFT` | Unplanned changes | `/sync` |
| `BLOCKED` | Hook prevented a dangerous path/command | Hooks |
| `FIXED` | Systematic debug success | Coder |
| `STALE` | No progress detected | `/sync` |
| `CLEAN` | Security sweep passed | Security |

## Key Files

| File | Purpose |
| :--- | :--- |
| `Artifacts/MEMORY_ANCHORS.md` | Project-wide constants & non-negotiables |
| `Artifacts/TODO.md` | Final authority on task completion ([x]) |
| `Artifacts/IMPLEMENTATION_PLAN.md` | Phased architectural roadmap |
| `Artifacts/DECISION_LOG.md` | Log of high-stakes pivots & Council results |
| `Artifacts/COUNCIL_PROTOCOLS.md` | Rules for high-rigor deliberation |
| `Artifacts/LOCAL_AGENT_PROFILES.json`| Project-specific persona configuration |
| `Artifacts/LEARNINGS.md` | Persistent session memory |
| `Artifacts/ARCH.md` | System design & data flow (ASCII maps) |

## Active Agent Skills

| Skill | Focus |
| :--- | :--- |
| `rhino-unit-testing` | Fast Lane B logic testing (Mocked rg) |
| `rhino-e2e-testing` | Rigorous Lane A geometry testing |
| `systematic-debugging`| Root-cause isolation (4-phase RCA) |
| `verification-gate` | Evidence-first completion mandate |
| `glossary-extraction` | DDD ubiquitous language synthesis |
| `implementation-dispatch`| Multi-agent sub-task orchestration |
| `cd-foundations` | CD standards (Tolerance, Layering, Units) |

## When In Doubt
- Lost context? → `/sync`
- Did manual work? → `/ingest`
- Session ending? → `/handoff`
- Docs blocking audit? → `/docs`
- Task keeps failing? → Let it escalate to strategist