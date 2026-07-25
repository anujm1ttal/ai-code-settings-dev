# AI Code OS Settings

Orchestration layer for Gemini sessions.

## Architecture

- **Rules** (`rules/common/`): Canonical standards. All agents reference these.
  - `orchestration.md` — routing, lifecycle, TODO authority, conflict resolution
  - `coding-style.md` — implementation standards, language patterns, domain rules
  - `standards.md` — interaction, formatting, token economy
  - `security.md` — secrets, defenses, incident response
- **Agents** (`agents/`): Role definitions + boundaries. Refer to `agents/agents.overview.md` (L1) for routing.
- **Commands** (`commands/`): Slash-command procedures. Owned by specific agents.
- **Skills** (`skills/`): Domain expertise. Refer to `skills/skills.overview.md` (L1) for a mapped registry.

## Agents

| Agent | Role |
|:---|:---|
| strategist | Architecture, planning, project classification |
| coder | Implementation execution |
| auditor | Quality gates, technical review |
| scribe | Documentation, communication, code explanation |
| council | High-rigor deliberation & consensus |
| creative-director | Visual spec & composition planning |
| concierge | Session orchestration, state management, intake |

## Commands

| Command / Skill | Owner | Purpose |
|:---|:---|:---|
| `/blueprint` | strategist | ROI-driven project planning and high-rigor phased roadmaps |
| `/sweep` | strategist | Codebase discovery, tech-debt mapping, redundancy scans |
| `/grill` | strategist | Stress-test a plan for hidden risks |
| `typescript-mcp` | `strategist, auditor, coder` | MCP server standards, Zod, JSON-RPC, async boundaries |
| `systematic-debugging` | `coder, auditor` | 4-phase root-cause investigation process |
| `implementation-dispatch` | `coder` | Subagent orchestration and two-stage review workflow |
| `visual-composition` | `creative-director, auditor` | Hierarchy, layout, brand governance, and accessibility |
| `/deck` | strategist / creative-director | PowerPoint project scaffolding & validation |
| `/audit` | auditor | Quality review, gate validation (Logic, Style, and Hard Rules) |
| `/snapshot` | auditor | Factual codebase snapshot for external review |
| `/docs` | scribe | Documentation generation/update |
| `/explain` | scribe | Walk through / teach a codebase |
| `glossary-extraction` | `concierge, scribe` | Extract ubiquitous language to Artifacts/GLOSSARY.md |
| `project-planner` | strategist | Phased roadmaps, dependencies, and task decomposition |
| `project-journal` | concierge | Session history, decision logs, and memory anchors |
| `skill-creator` | `concierge, strategist` | Designing and optimizing new skill modules |
| `doc-updater` | `scribe, auditor` | Automated documentation updates and staleness audits |
| `business-analyst` | strategist | Requirement elicitation, stakeholder mapping, and ROI validation |
| `banana-prompt` | creative-director | Optimized AI image prompts for thumbnails and decks (`optional_plugins/visual-storytelling/`) |
| `rhino-unit-testing` | `coder, auditor` | Lane B (Pure Python) testing for geometry-agnostic logic |
| `/ideate` | strategist | YouTube video conceptualization |
| `/script` | scribe | YouTube script creation from Artifacts/VIDEO_PLAN.md |
| `/pack` | scribe | YouTube upload metadata and SEO |
| `/sync` | concierge | Reconcile filesystem state with plan artifacts |
| `/registry-audit` | auditor | Cross-reference integrity check for the OS registry |
| `/ingest` | concierge | Register manual/external changes into project state |
| `/handoff` | concierge | Tiered session termination (L1-L3) & brief creation |
| `/clean` | concierge | Manually trigger project hygiene and cleanup |
| `/graduate` | concierge | Move project lessons to global OS settings |
| `/council` | council | High-rigor deliberation & consensus |
| `/triage` | coder | Bug investigation and fix planning |
| `/learn` | concierge | Capture a lesson into the learnings registry |

## Concierge Operations

- **`/sync`** — Filesystem-driven. Scans for drift between files and TODO/state artifacts. Use when plan and reality may have diverged.
- **`/ingest`** — User-driven. Registers work done outside AI IDE (manual edits, external contributions) into project state.
- **`/handoff`** — Session boundary. Supports `--lite` (Checkpoint) and `--phase` (Milestone). Compresses context, scrubs TODO, captures decisions, writes brief.

## Session Lifecycle

- **Boot**: Concierge runs state recovery → drift scan → validation → session brief. Automatic at session start.
- **Shutdown**: `/handoff` to close cleanly.

## Project Type Routing

`orchestration.md` defines project type classification and skill loading.

| Project Type | Skills Loaded |
|:---|:---|
| `youtube` | `youtube-strategy`, `youtube-scriptwriting`, `youtube-retention` → strategist, scribe, auditor, concierge |
| `pptx` | `pptx`, `visual-composition`, `python-patterns` → strategist, creative-director, coder, auditor, concierge |
| `pbi-report` | `powerbi-report`, `visual-composition`, `dax-modeling` → strategist, creative-director, coder, auditor, concierge |
| `geometry` | `cd-foundations` (auto), `python-rhino-grasshopper`, `rhino-e2e-testing`, `rhino-unit-testing`, `python-patterns` → strategist, coder, auditor, concierge |
| `code` | `codebase-navigator`, `systematic-debugging`, `python-patterns`, `python-mcp`, `typescript-mcp` → strategist, coder, auditor, concierge |
| `data` | `dax-modeling`, `powerbi-report`, `python-patterns` → strategist, coder, auditor, concierge |
| `manuscript`| `manuscript-review`, `glossary-extraction` → strategist, scribe, auditor, concierge |
| `hybrid` | All applicable skills based on detected files → concierge, strategist, All |
| *(all types)* | `codebase-navigator`, `systematic-debugging`, `implementation-dispatch`, `verification-gate`, `project-planner`, `project-journal`, `doc-updater` available — equip on coder/auditor as needed |

Full routing logic lives in `orchestration.md`. Add new project types there.


## YouTube Pipeline

    /ideate → Artifacts/VIDEO_PLAN.md → /script → Artifacts/SCRIPT.md → /pack → metadata

**Gates:**
- `/script` requires `Artifacts/VIDEO_PLAN.md` to exist
- `/pack` requires `Artifacts/SCRIPT.md` to exist

## Project State Persistence

All state files MUST live in the **Artifacts/** directory within the true logical project root (the source code repository), never in the Gemini shadow directory (`~/.gemini/`).

When creating or updating these files, you MUST use the absolute path of the workspace and place them in the `Artifacts/` folder.

- **Architecture**: `Artifacts/ARCH.md`, `Artifacts/IMPLEMENTATION_PLAN.md`
- **Roadmap**: `Artifacts/TODO.md`, `Artifacts/DECISION_LOG.md`
- **Context**: `Artifacts/MEMORY_ANCHORS.md`, `Artifacts/.agent/current_task.md`, `Artifacts/LOCAL_AGENT_PROFILES.json`
- **Transient**: `Artifacts/Temp/` (MANDATORY for all scratch scripts, diagrams, and temporary analysis. Shadow `scratch/` is FORBIDDEN.)
- **Durable Evidence**: `Artifacts/Evidence/<phase>/` (verification artifacts cited by a durable record; promoted out of `Temp/` before any purge and committed. **Never** purged — see `rules/common/orchestration.md` §Evidence Retention.)
- **Briefs**: `Artifacts/HANDOFF_BRIEF.md`
- **Learnings**: `Artifacts/learnings/` (Categorized knowledge registry)
- **History**: `Artifacts/history/` subdirectory for archived plans, task lists, and learnings

> [!IMPORTANT]
> **Interface-First Pattern**: For any data exchange or tool-building task, Phase 1 MUST define the "Contract" (JSON Schema/Outline) and obtain explicit user approval before implementation.

> [!TIP]
> **ROI Escalation**: Prioritize Tier 1 Metadata (Counts/Names) and Tier 2 Logic (Schemas/JSON) before escalating to Tier 3 Content (Full Source/Renders). Use the cheapest context that proves the claim.

## 🪞 Mirroring Rule

If you create or update a system-level artifact in the brain directory (using `IsArtifact: true`), you **MUST** simultaneously write a mirrored copy to the workspace `Artifacts/` directory (using `IsArtifact: false`). 

The workspace `Artifacts/` folder is the **Canonical Source of Truth**. The brain directory copy is for UI rendering purposes only. 
If drift occurs, the workspace version wins.

## Error Handling

- **Command failure**: Agent reports what failed and why. No silent failures.
- **Missing precondition**: Agent blocks execution, tells user what's needed.
- **Agent conflict**: `orchestration.md` conflict resolution rules apply. Strategist has final architectural authority.
- **Unknown command**: Concierge catches and routes or rejects with guidance.

## Persistent Learnings

Gemini accumulates project-specific knowledge in the `Artifacts/learnings/` directory.

**Lifecycle:**
- **Read**: Concierge loads `Artifacts/learnings/index.md` during session boot.
- **Write**: Concierge appends new entries during `/handoff`.
- **Manual**: `/learn` command captures lessons mid-session.

**Boundaries:**
- Max 50 active entries per category. When exceeded, oldest entries archive to `Artifacts/history/`.
- No task status (use `Artifacts/TODO.md`), no architecture decisions (use `Artifacts/DECISION_LOG.md`), no temporary context.

**Entry format:**
Refer to `Artifacts/learnings/index.md` for category-specific templates.

| Command | Owner | Purpose |
|:---|:---|:---|
| `/learn` | concierge | Capture a lesson into the learnings registry |
