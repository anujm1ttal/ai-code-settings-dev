# Antigravity AI OS Settings

Orchestration layer for Gemini sessions.

## Architecture

- **Rules** (`rules/common/`): Canonical standards. All agents reference these.
  - `orchestration.md` — routing, lifecycle, TODO authority, conflict resolution
  - `coding-style.md` — implementation standards, language patterns, domain rules
  - `standards.md` — interaction, formatting, token economy
  - `security.md` — secrets, defenses, incident response
- **Agents** (`agents/`): Role definitions + boundaries. Reference rules for detailed standards.
- **Commands** (`commands/`): Slash-command procedures. Owned by specific agents.
- **Skills** (`skills/*/SKILL.md`): Domain expertise. Loaded on demand per project type routing in `orchestration.md`.

## Agents

| Agent | Role |
|:---|:---|
| strategist | Architecture, planning, project classification |
| coder | Implementation execution |
| auditor | Quality gates, technical review |
| scribe | Documentation, communication, code explanation |
| concierge | Session orchestration, state management, intake |

## Commands

| Command | Owner | Purpose |
|:---|:---|:---|
| `/blueprint` | strategist | Project planning, phased roadmaps |
| `/audit` | auditor | Quality review, gate validation |
| `/docs` | scribe | Documentation generation/update |
| `/explain` | scribe | Walk through / teach a codebase |
| `/ideate` | strategist | YouTube video conceptualization |
| `/script` | scribe | YouTube script creation from VIDEO_PLAN.md |
| `/pack` | scribe | YouTube upload metadata and SEO |
| `/sync` | concierge | Reconcile filesystem state with plan artifacts |
| `/ingest` | concierge | Register manual/external changes into project state |
| `/handoff` | concierge | Clean session end — compress context, update state |

## Concierge Operations

- **`/sync`** — Filesystem-driven. Scans for drift between files and TODO/state artifacts. Use when plan and reality may have diverged.
- **`/ingest`** — User-driven. Registers work done outside AI IDE (manual edits, external contributions) into project state.
- **`/handoff`** — Session boundary. Compresses context, scrubs TODO, captures decisions, writes next-session brief.

## Session Lifecycle

- **Boot**: Concierge runs state recovery → drift scan → validation → session brief. Automatic at session start.
- **Shutdown**: `/handoff` to close cleanly.

## Project Type Routing

`orchestration.md` defines project type classification and skill loading.

| Project Type | Skills Loaded |
|:---|:---|
| `youtube` | `youtube-strategy`, `youtube-scriptwriting`, `youtube-retention` → strategist, scribe, auditor, concierge |
| *(all types)* | `codebase-navigator` available — equip on scribe when user asks how code works |

Full routing logic lives in `orchestration.md`. Add new project types there.

## YouTube Pipeline

    /ideate → VIDEO_PLAN.md → /script → SCRIPT.md → /pack → metadata

**Gates:**
- `/script` requires `VIDEO_PLAN.md` to exist
- `/pack` requires `SCRIPT.md` to exist

## Project State Persistence

All state files MUST live in the **current working project root**, never in `~/.gemini/`:

- **Architecture**: `ARCH.md`, `IMPLEMENTATION_PLAN.md`
- **Roadmap**: `TODO.md`, `DECISION_LOG.md`
- **Context**: `.agent/current_task.md`
- **Learnings**: `LEARNINGS.md`
- **History**: `history/` subdirectory for archived plans, task lists, and learnings

## Error Handling

- **Command failure**: Agent reports what failed and why. No silent failures.
- **Missing precondition**: Agent blocks execution, tells user what's needed.
- **Agent conflict**: `orchestration.md` conflict resolution rules apply. Strategist has final architectural authority.
- **Unknown command**: Concierge catches and routes or rejects with guidance.

## Persistent Learnings

Gemini accumulates project-specific knowledge in `LEARNINGS.md` at the project root.

**Lifecycle:**
- **Read**: Concierge loads `LEARNINGS.md` during session boot (state recovery phase)
- **Write**: Concierge appends new entries during `/handoff`
- **Manual**: `/learn` command captures lessons mid-session

**Boundaries:**
- Max 50 active entries. When exceeded, oldest entries archive to `history/learnings_archive.md`.
- No task status (use `TODO.md`), no architecture decisions (use `DECISION_LOG.md`), no temporary context.

**Entry format:**
```
### [YYYY-MM-DD] Category: Short title
What happened and what to do differently.
```

**Categories:** `mistake`, `preference`, `gotcha`, `workflow`, `pattern`

| Command | Owner | Purpose |
|:---|:---|:---|
| `/learn` | concierge | Capture a lesson into LEARNINGS.md |
