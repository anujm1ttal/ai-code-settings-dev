# Skills Overview (L1)

This overview maps the available skills in the Agent OS. Load only the necessary skills per task. For high-use skills, refer to the L0 Abstract before loading the full definition.

**Total**: 15 core skills across 4 domains (plus the optional-plugin skills — see `optional_plugins/index.md` for that catalog and count).

## Core Orchestration
| Skill | Abstract (L0) | Purpose |
|:---|:---|:---|
| `implementation-dispatch`| [abstract](skills/implementation-dispatch/abstract.md) | Subagent orchestration and two-stage review workflow. |
| `verification-gate` | [abstract](skills/verification-gate/abstract.md) | Mandatory evidence-first verification before claiming "Done." |
| `high-rigor-engineering` | [abstract](skills/high-rigor-engineering/abstract.md) | Synchronous gate-passing variant of orchestration for geometry/production/regulatory phases. |
| `test-driven-development` | [abstract](skills/test-driven-development/abstract.md) | Failing-test-first mandate (RED-GREEN-REFACTOR) for all production code. |
| `receiving-code-review` | [abstract](skills/receiving-code-review/abstract.md) | Verify-then-respond discipline for ingesting review feedback. |
| `project-planner` | [abstract](skills/project-planner/abstract.md) | Phased roadmaps, dependencies, and task decomposition. |
| `systematic-debugging` | - | Root-cause investigation process for bugs. |
| `codebase-navigator` | - | Context discovery and traversal for large projects. |
| `project-journal` | - | Maintaining session history and decision logs. |
| `business-analyst` | - | Requirement elicitation, stakeholder mapping, and ROI validation. |

> `skill-creator` is provided by the installed marketplace plugin (not part of this repo). See `cheatsheet.md`.

## Domain: Development
| Skill | Purpose |
|:---|:---|
| `python-patterns` | PEP 8, types, and Python 3.12+ best practices. |
| `doc-updater` | Generating and auditing project documentation. |

## Domain: Design & Visuals
| Skill | Purpose |
|:---|:---|
| `visual-composition` | Cross-medium design principles and brand governance. |

> **`docx`/`xlsx`/`pptx` are not shipped by this repo** — Anthropic-licensed material whose
> terms bar redistribution. Obtain them from Anthropic. `pptx-slide-design`
> (`optional_plugins/visual-storytelling/`) is first-party and unaffected.

## Domain: Geometry (Rhino/GH)

> Geometry skills (`cd-foundations`, `python-rhino-grasshopper`, `rhino-e2e-testing`, `rhino-unit-testing`, `grasshopper-plugin-packaging`) live in `optional_plugins/geometry/` (plugin `geometry`), not this repo's core skill set. See `optional_plugins/index.md`.

## Domain: Specialized
| Skill | Category | Purpose |
|:---|:---|:---|
| `dax-modeling` | Data | Power BI data modeling and DAX authoring. |
| `glossary-extraction` | DDD | Extracting ubiquitous language to GLOSSARY.md. |

> `banana-prompt`, `pptx-slide-design` live in `optional_plugins/visual-storytelling/` (plugin `visual-storytelling`). See `optional_plugins/index.md`.
