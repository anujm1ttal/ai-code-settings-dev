# Agent Fleet Overview (L1)

This overview provides a high-leverage entry point for agent orchestration. Use this file to identify the correct agent for a task before loading their full definition (L2).

| Agent | Abstract (L0) | Role Summary | Primary Artifacts |
|:---|:---|:---|:---|
| **strategist** | [abstract](./strategist.abstract.md) | Architecture, planning, Step 0, ROI, and phased roadmaps. | `IMPLEMENTATION_PLAN.md`, `TODO.md` |
| **coder** | [abstract](./coder.abstract.md) | Senior implementation specialist. Translates plans into code. | Source code, test files |
| **auditor** | [abstract](./auditor.abstract.md) | QA, compliance, and final sign-off. Authority to mark `[x]`. | `AUDIT_REPORT.md` |
| **concierge** | [abstract](./concierge.abstract.md) | State management, session sync, handoffs, and learnings. | `learnings/`, `current_task.md` |
| **council** | [abstract](./council.abstract.md) | Consensus engine for high-stakes pivots and conflicts. | `DECISION_LOG.md` |
| **scribe** | [abstract](./scribe.abstract.md) | Documentation, teaching, YouTube scripts, and metadata. | `README.md`, `ARCH.md` |
| **creative-director** | [abstract](./creative-director.abstract.md) | Visual architecture, look-and-feel, and composition specs. | `LAYOUT_SPEC.md` |
| **geometry-validator**| [abstract](./geometry-validator.abstract.md)| Specialized subagent for geometric and Rhino API audits. | Geometric Audit Report |

---

## Routing Guidelines

Refer to `rules/common/orchestration.md` for the full Automatic Routing logic and Project Type mappings.
