# Claude Code AI OS

Orchestration layer for Claude Code sessions.

## Claude Code — Cheat Sheet

- **Rules** (`rules/common/`): Canonical standards. All agents reference these.
  - `orchestration.md` — routing, lifecycle, TODO authority, conflict resolution
  - `coding-style.md` — implementation standards, language patterns, domain rules
  - `standards.md` — interaction, formatting, token economy
  - `security.md` — secrets, defenses, incident response
- **Agents** (`agents/`): Role definitions + boundaries. Reference rules for detailed standards.
- **Commands** (`commands/`): Slash-command procedures. Owned by specific agents.
- **Skills** (`skills/*/SKILL.md`): Domain expertise. Claude MUST read the relevant SKILL.md files automatically based on the Project Type Routing rules below.

## Agents

| Agent | Role |
|:---|:---|
| strategist | Architecture, planning, project classification |
| coder | Implementation execution |
| auditor | Quality gates, technical review |
| scribe | Documentation, communication, code explanation |
| creative-director | Visual spec & composition planning |
| concierge | Session orchestration, state management, intake |

## Commands

| Command / Skill | Owner | Purpose |
|:---|:---|:---|
| `/blueprint` | strategist | Project planning, phased roadmaps |
| `/sweep` | strategist | Codebase discovery, tech-debt mapping, redundancy scans |
| `typescript-mcp` | `strategist, auditor, coder` | MCP server standards, Zod, JSON-RPC, async boundaries |
| `systematic-debugging` | `coder, auditor` | 4-phase root-cause investigation process |
| `implementation-dispatch` | `coder` | Subagent orchestration and two-stage review workflow |
| `visual-composition` | `creative-director, auditor` | Hierarchy, layout, brand governance, and accessibility |
| `/deck` | strategist / creative-director | PowerPoint project scaffolding & validation |
| `/audit` | auditor | Quality review, gate validation |
| `/docs` | scribe | Documentation generation/update |
| `/explain` | scribe | Walk through / teach a codebase |
| `/ideate` | strategist | YouTube video conceptualization |
| `/script` | scribe | YouTube script creation from Artifacts/VIDEO_PLAN.md |
| `/pack` | scribe | YouTube upload metadata and SEO |
| `/sync` | concierge | Reconcile filesystem state with plan artifacts |
| `/ingest` | concierge | Register manual/external changes into project state |
| `/handoff` | concierge | Clean session end — compress context, update state |
| `/graduate` | concierge | Triage global inbox entries into global settings |

## Concierge Operations

- **`/sync`** — Filesystem-driven. Scans for drift between files and TODO/state artifacts. Use when plan and reality may have diverged.
- **`/ingest`** — User-driven. Registers work done outside Claude (manual edits, external contributions) into project state.
- **`/handoff`** — Session boundary. Compresses context, scrubs TODO, captures decisions, writes next-session brief.

## Session Lifecycle

- **Boot**: Concierge runs state recovery → drift scan → validation → session brief. Automatic at session start.
- **Shutdown**: `/handoff` to close cleanly.

## Project Type Routing

`orchestration.md` defines project type classification and skill loading. **Claude MUST instantly auto-detect the project type based on workspace files and read the corresponding skills before answering.**

| Project Type | Auto-Detect Triggers | Skills to Read Immediately |
|:---|:---|:---|
| `youtube` | `Artifacts/VIDEO_PLAN.md`, `Artifacts/SCRIPT.md` | `youtube-strategy`, `youtube-scriptwriting`, `youtube-retention` |
| `pptx` | `*.pptx`, `deck_*.py` | `powerpoint-patterns`, `visual-composition`, `python-patterns` |
| `pbi-report` | `*.pbip`, `*.pbix`, `*.Report/**`, `theme*.json` | Read `skills/powerbi-report/SKILL.md`, `skills/visual-composition/SKILL.md`, `skills/dax-modeling/SKILL.md` |
| *(all types)* | coder/auditor active | `codebase-navigator`, `systematic-debugging`, `implementation-dispatch` |

Full routing logic lives in `orchestration.md`. Add new project types there.

## YouTube Pipeline

    /ideate → Artifacts/VIDEO_PLAN.md → /script → Artifacts/SCRIPT.md → /pack → metadata

**Gates:**
- `/script` requires `Artifacts/VIDEO_PLAN.md` to exist
- `/pack` requires `Artifacts/SCRIPT.md` to exist

## Project State Persistence

All state files MUST live in the **Artifacts/** directory within the true logical project root (the source code repository), never in the Claude shadow directory (`~/.claude/projects/`).

When creating or updating these files, you MUST use the absolute path of the workspace and place them in the `Artifacts/` folder.

- **Architecture**: `Artifacts/ARCH.md`, `Artifacts/IMPLEMENTATION_PLAN.md`
- **Roadmap**: `Artifacts/TODO.md`, `Artifacts/DECISION_LOG.md`
- **Context**: `Artifacts/.agent/current_task.md`
- **Learnings**: `Artifacts/LEARNINGS.md`
- **History**: `Artifacts/history/` subdirectory for archived plans, task lists, and learnings

## Error Handling

- **Command failure**: Agent reports what failed and why. No silent failures.
- **Missing precondition**: Agent blocks execution, tells user what's needed.
- **Agent conflict**: `orchestration.md` conflict resolution rules apply. Strategist has final architectural authority.
- **Unknown command**: Concierge catches and routes or rejects with guidance.

## Persistent Learnings

Claude accumulates project-specific knowledge in `Artifacts/LEARNINGS.md` at the project root.

**Lifecycle:**
- **Read**: Concierge loads `Artifacts/LEARNINGS.md` during session boot (state recovery phase)
- **Write**: Concierge appends new entries during `/handoff`
- **Manual**: `/learn` command captures lessons mid-session

**Boundaries:**
- Max 50 active entries. When exceeded, oldest entries archive to `Artifacts/history/learnings_archive.md`.
- No task status (use `Artifacts/TODO.md`), no architecture decisions (use `Artifacts/DECISION_LOG.md`), no temporary context.

**Entry format:**
```
### [YYYY-MM-DD] Category: Short title
What happened and what to do differently.
```

**Categories:** `mistake`, `preference`, `gotcha`, `workflow`, `pattern`

| Command | Owner | Purpose |
|:---|:---|:---|
| `/learn` | concierge | Capture a lesson into Artifacts/LEARNINGS.md |

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