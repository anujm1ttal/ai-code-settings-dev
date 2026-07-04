# Skills Overview (L1)

This overview maps the available skills in the Agent OS. Load only the necessary skills per task. For high-use skills, refer to the L0 Abstract before loading the full definition.

## Core Orchestration
| Skill | Abstract (L0) | Purpose |
|:---|:---|:---|
| `implementation-dispatch`| [abstract](file:///c:/Users/44547/source/repos/ai-code-settings/skills/implementation-dispatch/abstract.md) | Subagent orchestration and two-stage review workflow. |
| `verification-gate` | [abstract](file:///c:/Users/44547/source/repos/ai-code-settings/skills/verification-gate/abstract.md) | Mandatory evidence-first verification before claiming "Done." |
| `test-driven-development` | [abstract](file:///c:/Users/44547/source/repos/ai-code-settings/skills/test-driven-development/abstract.md) | Failing-test-first mandate (RED-GREEN-REFACTOR) for all production code. |
| `receiving-code-review` | [abstract](file:///c:/Users/44547/source/repos/ai-code-settings/skills/receiving-code-review/abstract.md) | Verify-then-respond discipline for ingesting review feedback. |
| `project-planner` | [abstract](file:///c:/Users/44547/source/repos/ai-code-settings/skills/project-planner/abstract.md) | Phased roadmaps, dependencies, and task decomposition. |
| `systematic-debugging` | - | Root-cause investigation process for bugs. |
| `codebase-navigator` | - | Context discovery and traversal for large projects. |
| `project-journal` | - | Maintaining session history and decision logs. |
| `skill-creator` | - | Designing and optimizing new skill modules. |

## Domain: Development
| Skill | Purpose |
|:---|:---|
| `python-patterns` | PEP 8, types, and Python 3.12+ best practices. |
| `doc-updater` | Generating and auditing project documentation. |

## Domain: Design & Visuals
| Skill | Purpose |
|:---|:---|
| `visual-composition` | Cross-medium design principles and brand governance. |

> `docx`/`xlsx` moved to `optional_plugins/ms-office/` (plugin `ms-office-core`). See `optional_plugins/index.md`.

## Domain: Geometry (Rhino/GH)
| Skill | Purpose |
|:---|:---|

## Domain: Specialized
| Skill | Category | Purpose |
|:---|:---|:---|
| `dax-modeling` | Data | Power BI data modeling and DAX authoring. |
| `glossary-extraction` | DDD | Extracting ubiquitous language to GLOSSARY.md. |

> `banana-prompt`, `pptx-slide-design` live in `optional_plugins/visual-storytelling/` (plugin `visual-storytelling-core`). See `optional_plugins/index.md`.
