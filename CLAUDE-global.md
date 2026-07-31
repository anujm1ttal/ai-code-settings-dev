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
  - `orchestration.md` — routing, lifecycle, execution cadence, TODO authority, conflict resolution
  - `coding-style.md` — implementation standards, language patterns, domain rules
  - `standards.md` — interaction, formatting, token economy
  - `security.md` — secrets, defenses, incident response
  - `claude-md-standards.md` — CLAUDE.md quality bar, global-vs-project split, size caps
  - `model-routing.md` — agent-model tier assignments, hard rules, fallback chain (canonical)
  - `TOKEN-ECONOMICS.md` — context layering, slicing thresholds, handoff triggers
  - `testing-strategy.md` — test lane selection, evidence rules, TDD loop
  - `architecture.md` — deep-vs-shallow module design principles
- **Agents** (`agents/`): Role definitions + boundaries. Refer to `agents/agents.overview.md` (L1) for routing.
- **Commands** (`commands/`): Slash-command procedures. Owned by specific agents.
- **Skills** (`skills/`): Domain expertise. Refer to `skills/skills.overview.md` (L1) for a mapped registry.

## Precedence

On any overlap, `rules/common/*` wins over this file (this file is routing + pointers, not
the ruleset). A project's own `CLAUDE.md` wins over this global file for that repo. On
conflicts between rules files, the named owner file wins: routing → `model-routing.md`;
interaction → `standards.md`; implementation → `coding-style.md`; orchestration/lifecycle →
`orchestration.md`.

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
| geometry-validator | Geometric auditing (dispatched by auditor) |

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
| `/deck` | concierge / coder / auditor | PowerPoint project scaffolding & validation |
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
| `pptx-slide-design` | creative-director | Copy-paste-ready PowerPoint slide design prompts for Copilot (`optional_plugins/visual-storytelling/`) |
| `rhino-unit-testing` | `coder, auditor` | Lane B (Pure Python) testing for geometry-agnostic logic |
| `grasshopper-plugin-packaging` | `coder, auditor` | Python Grasshopper plugin development + Yak packaging/deployment (Rhino 8) |
| `high-rigor-engineering` | `coder, auditor, strategist` | Synchronous gate-passing, evidence, and patch protocol for geometry/production/regulatory phases (variant of standard orchestration) |
| `/ideate` | strategist | YouTube video conceptualization |
| `/script` | scribe | YouTube script creation from Artifacts/VIDEO_PLAN.md |
| `/pack` | scribe | YouTube upload metadata and SEO — no edits to `SCRIPT.md`/`VIDEO_PLAN.md` |
| `/sync` | concierge | Reconcile filesystem state with plan artifacts |
| `/registry-audit` | auditor | Cross-reference integrity check for the OS registry |
| `/ingest` | concierge | Register manual/external changes into project state — formalizes `Artifacts/LAYOUT_SPEC.md` |
| `/handoff` | concierge | Tiered session termination (L1-L3) & brief creation |
| `/clean` | concierge | Manually trigger project hygiene and cleanup |
| `/graduate` | concierge | Move project lessons to global OS settings |
| `/council` | council | High-rigor deliberation & consensus |
| `/triage` | coder | Bug investigation and fix planning — investigation only, no source edits until plan approved |
| `/afk` | coder (dispatch) / auditor (gates) | AFK task runner — dispatch, review, and audit AFK-tagged tasks until frontier empties or cap hits |
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

Canonical table (project types, core agents, default skills, foundational skills, and the note
on Office skills not being shipped): `rules/common/orchestration.md` §Project Type Routing.

## YouTube Pipeline

    /ideate → Artifacts/VIDEO_PLAN.md → /script → Artifacts/SCRIPT.md → /pack → metadata

**Gates:**
- `/script` requires `Artifacts/VIDEO_PLAN.md` to exist
- `/pack` requires `Artifacts/SCRIPT.md` to exist

## Project State Persistence

All state files MUST live in the **Artifacts/** directory within the true logical project root, never in the Claude Code shadow directory (`~/.claude/`), at the workspace's absolute path.
Root Files, phase/archive layout, Interface-First Pattern, and ROI Escalation: see
`rules/common/orchestration.md` §Persistence.

## Mirroring Rule

See `rules/common/standards.md` §Artifact Protocol (Mirroring Rule [HARD-GATE]) — canonical.

## Error Handling

- **Command failure**: Agent reports what failed and why. No silent failures.
- **Missing precondition**: Agent blocks execution, tells user what's needed.
- **Agent conflict**: `orchestration.md` conflict resolution rules apply. Strategist has final architectural authority.
- **Unknown command**: Concierge catches and routes or rejects with guidance.

## Persistent Learnings

Categorized project knowledge in `Artifacts/learnings/`. Lifecycle (read at boot, write at
`/handoff`, manual via `/learn`, 50-entry prune, scope exclusions) owned by concierge — see
`agents/concierge.md` and `rules/common/orchestration.md` persistence table.

## Hooks (Enforcement Layer)

Claude Code hooks provide **hard guardrails** that cannot be rationalized away.
 They fire automatically at lifecycle events. Configured globally in `~/.claude/settings.json`.

| Hook | Event | Purpose |
|:---|:---|:---|
| `session-boot.js` | `SessionStart` | Injects Artifacts state (TODO, Learnings, Current Task) into context |
| `guard-paths.js` | `PreToolUse` | **Blocks** writes to binaries (`.pbix`, `.3dm`), secrets (`.env`), build artifacts, project state files in shadow paths (scratch-gate), bare scratch/ |
| `guard-commands.js` | `PreToolUse` | **Blocks** dangerous commands (`rm -rf`, force push, SQL drops) and commits with AI attribution trailers (`Co-Authored-By: Claude`, `Generated with Claude Code`) |
| `auto-lint.js` | `PostToolUse` | Reports lint violations and injects "fix before proceeding" directive (not auto-fixing) |
| `audit-trail.js` | `PostToolUse` | Logs every tool action to `Artifacts/.agent/audit_trail.jsonl` |
| `nudge-handoff.js` | `Stop` | Nudges to run `/handoff` if git tree is dirty and no handoff this session (feedback only) |
| `evidence-gate.js` | `Stop` | Nags when completion claims made without fresh test evidence this session (feedback only) |

**Design**: All hooks are fail-open — script errors exit 0. See `hooks/README.md` for setup and customization.