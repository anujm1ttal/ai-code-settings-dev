<!--
  DEPLOYABLE GLOBAL INSTRUCTIONS. Source of truth: ai-code-settings/CLAUDE-global.md.
  `scripts/deploy.sh` copies this file → ~/.claude/CLAUDE.md (loaded in every session, every project).
  Governed by rules/common/claude-md-standards.md (global tier: ≤250 lines target, 400 hard cap).
  Repo-specific guidance for the ai-code-settings repo itself lives in ./CLAUDE.md, not here.
-->

# Claude Code AI OS

Orchestration layer for Claude Code sessions.

## Architecture

- **Rules** (`rules/common/`): Canonical standards. All agents reference these.
  - `orchestration.md` — routing, lifecycle, TODO authority, conflict resolution
  - `coding-style.md` — implementation standards, language patterns, domain rules
  - `standards.md` — interaction, formatting, token economy
  - `security.md` — secrets, defenses, incident response
  - `claude-md-standards.md` — CLAUDE.md quality bar, global-vs-project split, size caps
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
| `/skill-graph` | strategist | Visualize skill dependencies and identify clusters |
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
| `/claude-md` | auditor | Audit/update a CLAUDE.md against `claude-md-standards.md` (report-first) |

## Concierge Operations

- **`/sync`** — Filesystem-driven. Scans for drift between files and TODO/state artifacts. Use when plan and reality may have diverged.
- **`/ingest`** — User-driven. Registers work done outside AI IDE (manual edits, external contributions) into project state.
- **`/handoff`** — Session boundary. Supports `--lite` (Checkpoint) and `--phase` (Milestone). Compresses context, scrubs TODO, captures decisions, writes brief.

## Session Lifecycle

- **Boot**: Concierge runs state recovery → drift scan → validation → session brief. Automatic at session start.
- **Shutdown**: `/handoff` to close cleanly.

## Project Type Routing

Default skills per project type (strategist/concierge routing guidance; per-project selection is via native `enabledPlugins`):

| Project Type | Default Skills |
|:---|:---|
| `youtube` | youtube-strategy, youtube-scriptwriting, youtube-retention |
| `pptx` | pptx, visual-composition, python-patterns |
| `pbi-report` | powerbi-report, visual-composition, dax-modeling |
| `geometry` | cd-foundations, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing, python-patterns |
| `code` | codebase-navigator, systematic-debugging, python-patterns, python-mcp, typescript-mcp |
| `data` | dax-modeling, powerbi-report, python-patterns |
| `manuscript`| manuscript-review, glossary-extraction |
| `hybrid` | All applicable (per detected files) |

**All types** also have foundational skills: codebase-navigator, systematic-debugging, implementation-dispatch, verification-gate, project-planner, project-journal, doc-updater.

## YouTube Pipeline

    /ideate → Artifacts/VIDEO_PLAN.md → /script → Artifacts/SCRIPT.md → /pack → metadata

**Gates:**
- `/script` requires `Artifacts/VIDEO_PLAN.md` to exist
- `/pack` requires `Artifacts/SCRIPT.md` to exist

## Project State Persistence

All state files MUST live in the **Artifacts/** directory within the true logical project root (the source code repository), never in the Claude Code shadow directory (`~/.claude/`).

When creating or updating these files, you MUST use the absolute path of the workspace and place them in the `Artifacts/` folder.

### Root Files (Always at Artifacts/)

- **IMPLEMENTATION_PLAN.md** — High-level roadmap spanning all phases and milestones
- **TODO.md** — High-level task tracking and project execution status
- **ARCH.md** — System architecture and design principles
- **MEMORY_ANCHORS.md** — Project constants, constraints, and non-negotiables (Persistent — never archived)
- **learnings/** — Categorized knowledge registry (Persistent — never archived)
- **DECISION_LOG.md** — Historical decisions and pivots (live, append-only; newest first — never archived wholesale)
- **HANDOFF_BRIEF.md** — Session transition and next steps summary

### Active Phase Files (Artifacts/Plans/)

- **Phase-N-Plan.md** — Detailed phase technical design, objectives, file changes, dependencies, and success metrics (created at phase start)
- **Phase-N-TODO.md** — Phase-level task tracking and status (created at phase start; managed during phase execution)

### Phase Completion (Artifacts/Reports/)

- **Phase-N-Report.md** — Phase completion summary, metrics, and outcomes (created at phase end)

### Archive (Artifacts/History/)

- **Plans/** — Archived Phase-N-Plan.md files (moved after phase completion)
- **Reports/** — Archived Phase-N-Report.md files (moved after phase completion)
- **Other ad-hoc artifacts** (except Temp/)

### Transient Storage (Artifacts/Temp/)

- One-off diagrams, scratch scripts, and temporary analysis (MANDATORY for all scratch files; shadow `scratch/` is FORBIDDEN)

### Context Files

- **Artifacts/.agent/current_task.md** — Session focus and current task pointer
- **Artifacts/LOCAL_AGENT_PROFILES.json** — Sub-agent role definitions

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

Claude Code accumulates project-specific knowledge in the `Artifacts/learnings/` directory.

**Lifecycle:**
- **Read**: Concierge loads `Artifacts/learnings/index.md` during session boot.
- **Write**: Concierge appends new entries during `/handoff`.
- **Manual**: `/learn` command captures lessons mid-session.

**Boundaries:**
- Max 50 active entries per category. When exceeded, oldest entries archive to `Artifacts/History/`.
- No task status (use `Artifacts/TODO.md`), no architecture decisions (use `Artifacts/DECISION_LOG.md`), no temporary context.

**Entry format:**
Refer to `Artifacts/learnings/index.md` for category-specific templates.

| Command | Owner | Purpose |
|:---|:---|:---|
| `/learn` | concierge | Capture a lesson into the learnings registry |

## Hooks (Enforcement Layer)

Claude Code hooks provide **hard guardrails** that cannot be rationalized away.
 They fire automatically at lifecycle events. Configured globally in `~/.claude/settings.json`.

| Hook | Event | Purpose |
|:---|:---|:---|
| `session-boot.js` | `SessionStart` | Injects Artifacts state (TODO, Learnings, Current Task) into context |
| `guard-paths.js` | `PreToolUse` | **Blocks** writes to binaries (`.pbix`, `.3dm`), secrets (`.env`), build artifacts |
| `guard-commands.js` | `PreToolUse` | **Blocks** dangerous commands (`rm -rf`, force push, SQL drops) |
| `auto-lint.js` | `PostToolUse` | Reports lint violations after file edits (report-only, no auto-fix) |
| `audit-trail.js` | `PostToolUse` | Logs every tool action to `Artifacts/.agent/audit_trail.jsonl` |

**Design**: All hooks are fail-open — script errors exit 0. See `hooks/README.md` for setup and customization.