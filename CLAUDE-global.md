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
  for model tiers/fallback), `testing-strategy.md`, `architecture.md`.
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

Full registry: `agents/agents.overview.md` §Commands. Concierge owns `/sync`, `/ingest`,
`/handoff`, `/learn`, `/clean`, `/graduate` — see `agents/concierge.md`.

## Session Lifecycle

Boot: concierge runs state recovery → drift scan → validation → session brief (automatic).
Shutdown: `/handoff`.

## Project Type Routing

Canonical table: `agents/agents.overview.md` §Project Type Routing.

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
All fail-open (script errors exit 0). Full per-hook reference: `hooks/README.md` §Hook Reference.
