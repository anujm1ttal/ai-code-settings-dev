# Antigravity AI OS

## Architecture
- **Rules** (`rules/common/`): Canonical standards. All agents reference these.
  - `orchestration.md` — routing, lifecycle, TODO authority, conflict resolution
  - `coding-style.md` — implementation standards, language patterns, domain rules
  - `standards.md` — interaction, formatting, token economy
  - `security.md` — secrets, defenses, incident response
- **Agents** (`agents/`): Role definitions + boundaries. Reference rules for detailed standards.
- **Commands** (`commands/`): Slash-command procedures. Owned by specific agents.
- **Skills** (`skills/*/SKILL.md`): Domain expertise. Loaded on demand per `orchestration.md` Project Type Routing.
  - `codebase-navigator` is available for all project types — equip on `scribe` when user asks how code works.

## Quick Reference
| Command | Owner | Purpose |
|:---|:---|:---|
| `/blueprint` | strategist | Project planning, phased roadmaps |
| `/audit` | auditor | Quality review, gate validation |
| `/docs` | scribe | Documentation generation/update |
| `/explain` | scribe | Walk through / teach a codebase |
| `/sync` | concierge | Reconcile file state with plan |
| `/ingest` | concierge | Intake manual work |
| `/handoff` | concierge | Clean session end |

## Project State Persistence
All project-specific state files MUST be created/maintained in the **current working project root**, never in the global `~/.claude/` directory:
- **Architecture**: `ARCH.md`, `IMPLEMENTATION_PLAN.md`
- **Roadmap**: `TODO.md`, `DECISION_LOG.md`
- **Context**: `.agent/current_task.md`
- **History**: `history/` subdirectory for archived plans and task lists
