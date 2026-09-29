<!--
  DEPLOYABLE GLOBAL INSTRUCTIONS. Source of truth: ai-code-settings/CLAUDE-global.md.
  `scripts/deploy.sh` copies this file → ~/.claude/CLAUDE.md (loaded in every session, every project).
  Governed by rules/common/claude-md-standards.md (global tier: ≤250 lines target, 400 hard cap).
  Repo-specific guidance for the ai-code-settings repo itself lives in ./CLAUDE.md, not here.
-->

# Claude Code AI OS

Orchestration layer for Claude Code sessions.

## Architecture

- **`rules/common/`**: canonical standards, all agents reference these — `orchestration.md`
  (routing/lifecycle/TODO authority), `coding-style.md` (implementation), `standards.md`
  (interaction/tokens), `security.md`, `claude-md-standards.md`, `model-routing.md` (canonical
  for model tiers/fallback), `TOKEN-ECONOMICS.md`, `testing-strategy.md`, `architecture.md`.
- **`agents/`**: role definitions — `agents/agents.overview.md` (L1) for routing.
- **`commands/`**: slash-command procedures, owned by specific agents.
- **`skills/`**: domain expertise — `skills/skills.overview.md` (L1) for the registry.

## Precedence

`rules/common/*` wins over this file (this file is routing + pointers). A project's own
`CLAUDE.md` wins over this global file for that repo. Between rules files: routing →
`model-routing.md`; interaction → `standards.md`; implementation → `coding-style.md`;
orchestration/lifecycle → `orchestration.md`.

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

## Concierge Operations

`/sync` — filesystem-driven drift scan against TODO/state. `/ingest` — user-driven, registers
manual/external work into project state. `/handoff` — session boundary (`--lite`/`--phase`),
compresses context, captures decisions, writes a brief.

## Session Lifecycle

Boot: concierge runs state recovery → drift scan → validation → session brief (automatic).
Shutdown: `/handoff`.

## Project Type Routing

Canonical table: `rules/common/orchestration.md` §Project Type Routing.

## YouTube Pipeline

    /ideate → Artifacts/VIDEO_PLAN.md → /script → Artifacts/SCRIPT.md → /pack → metadata

Gates: `/script` requires `VIDEO_PLAN.md`; `/pack` requires `SCRIPT.md`.

## Project State Persistence

State lives in the project's own **Artifacts/** directory (absolute path), never the shadow
`~/.claude/`. Full layout, Interface-First Pattern, ROI Escalation:
`rules/common/orchestration.md` §Persistence. Mirroring Rule: `rules/common/standards.md`
§Artifact Protocol.

## Error Handling

Command failure → report what failed and why, no silent failures. Missing precondition → block
and state what's needed. Agent conflict → `orchestration.md` Conflict Resolution (strategist has
final architectural authority). Unknown command → concierge routes or rejects with guidance.

## Persistent Learnings

`Artifacts/learnings/` — lifecycle (read at boot, write at `/handoff`, manual via `/learn`,
50-entry prune) owned by concierge; see `agents/concierge.md`.

## Hooks (Enforcement Layer)

Hard guardrails, fire automatically at lifecycle events, configured in `~/.claude/settings.json`.
All fail-open (script errors exit 0) — see `hooks/README.md` for setup.

| Hook | Event | Purpose |
|:---|:---|:---|
| `session-boot.js` | SessionStart | Injects Artifacts state into context |
| `guard-paths.js` | PreToolUse | Blocks writes to binaries, secrets, build artifacts, shadow-path state |
| `guard-commands.js` | PreToolUse | Blocks dangerous commands + AI-attribution commit trailers |
| `auto-lint.js` | PostToolUse | Reports lint violations (doesn't auto-fix) |
| `audit-trail.js` | PostToolUse | Logs every tool action to `Artifacts/.agent/audit_trail.jsonl` |
| `task-diff-guard.js` | PreToolUse+PostToolUse (Task/Agent) + Stop | Diffs protected Artifacts/ files around subagent dispatch — surfaces what changed, not the subagent's summary |
| `nudge-handoff.js` | Stop | Nudges `/handoff` if tree is dirty (feedback only) |
| `evidence-gate.js` | Stop | Nags on completion claims without fresh test evidence (feedback only) |
| `guard-shared-state.js` | Stop | Nags on process-global state changes without a full-suite run (feedback only) |
