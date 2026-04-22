# AI Code OS Settings

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
| `/snapshot` | auditor | Factual codebase snapshot for external review |
| `/docs` | scribe | Documentation generation/update |
| `/explain` | scribe | Walk through / teach a codebase |
| `/ideate` | strategist | YouTube video conceptualization |
| `/script` | scribe | YouTube script creation from Artifacts/VIDEO_PLAN.md |
| `/pack` | scribe | YouTube upload metadata and SEO |
| `/sync` | concierge | Reconcile filesystem state with plan artifacts |
| `/ingest` | concierge | Register manual/external changes into project state |
| `/handoff` | concierge | Clean session end — compress context, update state, cleanup |
| `/clean` | concierge | Manually trigger project hygiene and cleanup |

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
| `pptx` | `powerpoint-patterns`, `visual-composition`, `python-patterns` → strategist, creative-director, coder, auditor, concierge |
| `pbi-report` | `powerbi-report`, `visual-composition`, `dax-modeling` → strategist, creative-director, coder, auditor, concierge |
| `geometry` | `cd-foundations` (auto), `python-rhino-grasshopper`, `rhino-e2e-testing`, `python-patterns` → strategist, coder, auditor, concierge |
| *(all types)* | `codebase-navigator`, `systematic-debugging`, `implementation-dispatch` available — equip on coder/auditor as needed |

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
- **Context**: `Artifacts/.agent/current_task.md`, `Artifacts/LOCAL_AGENT_PROFILES.json`
- **Protocols**: `Artifacts/COUNCIL_PROTOCOLS.md`
- **Learnings**: `Artifacts/LEARNINGS.md`
- **History**: `Artifacts/history/` subdirectory for archived plans, task lists, and learnings

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

Gemini accumulates project-specific knowledge in `Artifacts/LEARNINGS.md` at the project root.

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
