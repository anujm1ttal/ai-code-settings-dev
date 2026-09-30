# Agent Fleet Overview (L1)

This overview provides a high-leverage entry point for agent orchestration. Use this file to identify the correct agent for a task before loading their full definition (L2).

| Agent | Abstract (L0) | Role Summary | Primary Artifacts |
|:---|:---|:---|:---|
| **strategist** | [abstract](./strategist.abstract.md) | Architecture, planning, Step 0, ROI, and phased roadmaps. | `IMPLEMENTATION_PLAN.md`, `TODO.md` |
| **coder** | [abstract](./coder.abstract.md) | Senior implementation specialist. Translates plans into code. | Source code, test files |
| **auditor** | [abstract](./auditor.abstract.md) | QA, compliance, and final sign-off. Authority to mark `[x]`. | `Reports/<PHASE>-AUDIT_REPORT.md` |
| **concierge** | [abstract](./concierge.abstract.md) | State management, session sync, handoffs, and learnings. | `learnings/`, `current_task.md` |
| **council** | [abstract](./council.abstract.md) | Consensus engine for high-stakes pivots and conflicts. | `DECISION_LOG.md` |
| **scribe** | [abstract](./scribe.abstract.md) | Documentation, teaching, YouTube scripts, and metadata. | `README.md`, `ARCH.md` |
| **creative-director** | [abstract](./creative-director.abstract.md) | Visual architecture, look-and-feel, and composition specs. | `LAYOUT_SPEC.md` |
| **geometry-validator**| [abstract](./geometry-validator.abstract.md)| Specialized subagent for geometric and Rhino API audits. | Geometric Audit Report |

---

## The Fleet

| Agent | Role | Write Scope |
|:---|:---|:---|
| **strategist** | Architecture, ROI, roadmaps | `IMPLEMENTATION_PLAN.md`, `TODO.md` (create/restructure, not status) |
| **coder** | Implementation, refactoring | Source, tests, `[-]` status |
| **auditor** | QA, technical review | `Reports/<PHASE>-AUDIT_REPORT.md`, `TODO.md` (`[x]` only), `BACKLOG.md` findings. Reports, never applies — a needed source/test fix is a report line, not an edit. |
| **scribe** | Documentation, teaching | Artifacts docs not owned elsewhere (+ `README.md`) |
| **council** | Synthesis, stress-testing | `DECISION_LOG.md` |
| **creative-director** | Visual spec, hierarchy | `Artifacts/LAYOUT_SPEC.md` |
| **concierge** | State, sync, intake | `Artifacts/learnings/`, `/clean` |
| **geometry-validator** | Geometric auditing | Audit reports; dispatched only, no standalone authority |

Per-agent model binding: each `agents/*.md` frontmatter `model:` field is canonical (see
Agent-to-Model Binding below); `rules/common/model-routing.md` owns tier assignments.

## Agent-to-Model Binding (Mandatory)

| Agent | Model | Override |
|:---|:---|:---|
| strategist | Opus | Never |
| coder | Sonnet | Haiku for boilerplate scaffolding only |
| auditor | Sonnet | Haiku for routine lint passes only |
| scribe | Haiku | Sonnet for complex architecture docs (ARCH.md) |
| concierge | Haiku | Never |
| creative-director | Haiku | Sonnet for complex visual systems |
| council | Opus | Never |
| geometry-validator | Sonnet | Never (dispatched, no standalone routing) |

## Project Type Routing

Strategist classifies every project at Step 0; this sets active agents/skills. Activation is
via `enabledPlugins` — the table below is guidance, not stored config.

| Project Type | Core Agents | Default Skills |
|:---|:---|:---|
| `youtube` | strategist, scribe, concierge | youtube-strategy, youtube-scriptwriting, youtube-retention |
| `pptx` | strategist, creative-director, concierge | pptx, visual-composition, python-patterns |
| `pbi-report` | strategist, creative-director, coder | powerbi-report, visual-composition, dax-modeling |
| `geometry` | strategist, coder, auditor | cd-foundations, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing, grasshopper-plugin-packaging, python-patterns |
| `code` | strategist, coder, auditor | codebase-navigator, systematic-debugging, python-patterns, python-mcp, typescript-mcp, react-frontend |
| `manuscript` | strategist, scribe, auditor | manuscript-review, glossary-extraction |
| `data` | strategist, coder, auditor | dax-modeling, powerbi-report, python-patterns |
| `hybrid` | concierge, strategist | all applicable, per detected files |

All types also get: `codebase-navigator`, `systematic-debugging`, `implementation-dispatch`,
`verification-gate`, `test-driven-development`, `receiving-code-review`, `project-planner`,
`project-journal`, `doc-updater`.

Office skills (`docx`/`xlsx`/`pptx`) aren't shipped — Anthropic-licensed, obtain from Anthropic.
`pptx` projects still get `creative-director` + `visual-composition` for planning.

## Commands

| Command / Skill | Owner | Purpose |
|:---|:---|:---|
| `/blueprint` | strategist | ROI-driven project planning, phased roadmaps |
| `/sweep` | strategist | Codebase discovery, tech-debt mapping |
| `/skill-graph` | strategist | Visualize skill dependencies |
| `/grill` | strategist | Stress-test a plan for hidden risks |
| `typescript-mcp` | strategist, auditor, coder | MCP standards: Zod, JSON-RPC, async |
| `systematic-debugging` | coder, auditor | 4-phase root-cause investigation |
| `implementation-dispatch` | coder | Subagent orchestration, two-stage review |
| `visual-composition` | creative-director, auditor | Hierarchy, layout, accessibility |
| `/deck` | concierge/coder/auditor | PowerPoint scaffolding & validation |
| `/audit` | auditor | Quality review, gate validation |
| `/snapshot` | auditor | Factual codebase snapshot for review |
| `/docs` | scribe | Documentation generation/update |
| `/explain` | scribe | Walk through / teach a codebase |
| `glossary-extraction` | concierge, scribe | Ubiquitous language → `Artifacts/GLOSSARY.md` |
| `project-planner` | strategist | Phased roadmaps, task decomposition |
| `project-journal` | concierge | Session history, decision logs |
| `skill-creator` | concierge, strategist | Design/optimize new skills |
| `doc-updater` | scribe, auditor | Doc updates and staleness audits |
| `business-analyst` | strategist | Requirements, stakeholders, ROI |
| `banana-prompt` | creative-director | AI image prompts (`optional_plugins/visual-storytelling/`) |
| `pptx-slide-design` | creative-director | Copilot slide prompts (`optional_plugins/visual-storytelling/`) |
| `rhino-unit-testing` | coder, auditor | Lane B testing for geometry-agnostic logic |
| `grasshopper-plugin-packaging` | coder, auditor | GH plugin dev + Yak packaging (Rhino 8) |
| `high-rigor-engineering` | coder, auditor, strategist | Synchronous gates for geometry/production/regulatory work |
| `/ideate` | strategist | YouTube video conceptualization |
| `/script` | scribe | Script from `Artifacts/VIDEO_PLAN.md` |
| `/pack` | scribe | Upload metadata/SEO — no edits to script/plan |
| `/sync` | concierge | Reconcile filesystem with plan artifacts |
| `/registry-audit` | auditor | Cross-reference integrity check |
| `/ingest` | concierge | Register external changes into project state |
| `/handoff` | concierge | Tiered session termination & brief |
| `/clean` | concierge | Project hygiene and cleanup |
| `/graduate` | concierge | Promote project lessons to global settings |
| `/council` | council | High-rigor deliberation & consensus |
| `/triage` | coder | Bug investigation — no source edits until plan approved |
| `/afk` | coder (dispatch) / auditor (gates) | Unattended AFK-tagged task runner |
| `/learn` | concierge | Capture a lesson into the learnings registry |
| `/claude-md` | auditor | Audit a CLAUDE.md against `claude-md-standards.md` |

## Routing Guidelines

Refer to `rules/common/orchestration.md` for the full Automatic Routing logic and Project Type mappings.
