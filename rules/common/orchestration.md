---
name: agent-orchestration
description: Canonical source for agent routing, task lifecycle, Artifacts/TODO.md authority, conflict resolution, and project-type activation across the Claude Code AI OS.
---

# Agent Orchestration

## The Fleet

| Agent | Role | Capability Boundary |
|:---|:---|:---|
| **strategist** | Architecture, ROI, roadmaps | **Write**: `IMPLEMENTATION_PLAN.md`, `TODO.md` |
| **coder** | Implementation, refactoring | **Write**: Source code, test files, `[-]` status |
| **auditor** | QA, technical review | **Write**: `AUDIT_REPORT.md`, `Artifacts/TODO.md` (`[x]`) |
| **scribe** | Documentation, teaching | **Write**: Artifacts docs not owned by another agent (exception: `README.md`) |
| **council** | Synthesis, stress-testing | **Write**: `DECISION_LOG.md` |
| **creative-director** | Visual spec, hierarchy | **Write**: `Artifacts/LAYOUT_SPEC.md` |
| **concierge** | State, sync, intake | **Write**: `Artifacts/learnings/`, `/clean` execution |
| **geometry-validator** | Geometric auditing, manifold verification | **Write**: geometry audit reports; dispatched subagent (no standalone TODO/Plan authority) |

## Model Routing

`rules/common/model-routing.md` is canonical for agent-model tier assignments, hard rules,
skill-level overrides, and the fallback chain — **on divergence it wins**. The Fleet table
above owns roles/capability boundaries; model-routing.md owns which model runs each role.
Dev-only lookup commands (`scripts/model_router.py`, `model_routing_audit.py`) live in the
repo's own `CLAUDE.md` and `scripts/README.md`, not here.

---

## Project Type Routing

The `strategist` classifies every project during Step 0. This determines active agents and default skills. Per-project skill activation is via native plugins (`enabledPlugins` in settings); the table below is routing guidance, not a stored config.

| Project Type | Core Agents | Default Skills | Override via |
|:---|:---|:---|:---|
| `youtube` | strategist, scribe, concierge | youtube-strategy, youtube-scriptwriting, youtube-retention | `enabledPlugins` |
| `pptx` | strategist, creative-director, concierge | pptx, visual-composition, python-patterns | `enabledPlugins` |
| `pbi-report` | strategist, creative-director, coder | powerbi-report, visual-composition, dax-modeling | `enabledPlugins` |
| `geometry` | strategist, coder, auditor | cd-foundations, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing, grasshopper-plugin-packaging, python-patterns | `enabledPlugins` |
| `code` | strategist, coder, auditor | codebase-navigator, systematic-debugging, python-patterns, python-mcp, typescript-mcp | `enabledPlugins` |
| `manuscript`| strategist, scribe, auditor | manuscript-review, glossary-extraction | `enabledPlugins` |
| `data` | strategist, coder, auditor | dax-modeling, powerbi-report, python-patterns | `enabledPlugins` |
| `hybrid` | concierge, strategist | All applicable (per detected files) | `enabledPlugins` |

**All project types** also have access to foundational skills: `codebase-navigator`, `systematic-debugging`, `implementation-dispatch`, `verification-gate`, `test-driven-development`, `receiving-code-review`, `project-planner`, `project-journal`, `doc-updater`.

> **Office document skills (`docx`/`xlsx`/`pptx`) are not shipped by this repo.** They are
> Anthropic-licensed material whose terms bar redistribution; obtain them from Anthropic. A
> `pptx` project type still routes to `creative-director` + `visual-composition` for planning —
> only the OOXML renderers are absent.

## Command Fleet (Operational Layer)

`CLAUDE-global.md` Commands table is canonical for the full command registry (owner +
purpose per command). This file owns the routing *logic* (below) and command-adjacent
protocols (MTP, Task Lifecycle, Git Phase Branching) — not the registry itself.

---

## ⚡ The Micro-Task Protocol (MTP)
For minor edits that meet all criteria:
- **Scope**: ≤1 source file and ≤30 lines of code.
- **Complexity**: No architectural change, no new dependencies.
- **Rigor**: Still requires verification (tests or manual logs).

**Procedure**:
1. Skip the full `/blueprint` and Step 0 interview.
2. Provide a one-line `VALUE_CHECK` (e.g., `VALUE_CHECK: Fix layout alignment in Header component to match spec`).
3. Proceed directly to implementation and verification.

---

## Automatic Routing

1. **Planning, scoping, "should we"** → **strategist** (`/blueprint`)
2. **Plan stress-testing, "grill me", shared understanding** → **strategist** (`/grill`; escalate to **council** only via `/council`)
3. **Skill landscape, dependencies, routing optimization** → **strategist** (`/skill-graph`)
4. **Codebase discovery, tech-debt mapping, redundancy scans** → **strategist** (`/sweep`)
5. **Bug investigation, root-cause analysis, fix planning** → **coder** (`/triage`)
6. **Code implementation, refactoring, debugging** → **coder** (equip skills per table above)
7. **Review, validation, "is this correct"** → **auditor** (`/audit`)
8. **Factual codebase snapshot, compliance report** → **auditor** (`/snapshot`)
9. **Documentation, READMEs, user guides** → **scribe** (`/docs`)
10. **Teaching, tours, "how does this work"** → **scribe** (`/explain`)
11. **Manual work intake from Rhino/PBI** → **concierge** (`/ingest`)
12. **Session start, "where was I"** → **concierge** (`/sync`)
13. **Session end, context save** → **concierge** (`/handoff` [--lite|--phase])
14. **Project hygiene, cleanup transient files** → **concierge** (`/clean`)
15. **High-rigor deliberation, consensus, conflict** → **council** (`/council`)
16. **Domain definitions, ubiquitous language, glossary extraction** → **scribe** (`glossary-extraction`)
17. **Ambiguous** → **concierge** asks a clarifying question before routing.

---

## High-Rigor Engineering Workflow (Variant)

For geometry-heavy work, production deployments, security-critical phases, or anything requiring
**zero-rework tolerance** and an auditable evidence trail, equip the on-demand
`high-rigor-engineering` skill (`skills/high-rigor-engineering/SKILL.md`). It is a variant of
this file's standard workflow — same agents/commands apply; implementation and verification
become synchronous with explicit gates (evidence protocol, patch protocol, anti-patterns
taxonomy, scope lockdown) instead of async. The skill's own header states its precedence over
this file where the two conflict (commit cadence, approval phrases).

---

## Task Lifecycle

```
/blueprint (strategist)
  → Requirements Interview (Step 1)
  → Grilling Phase (Step 2) [Optional/High-Complexity] → shared understanding via `/grill`
  → Step 0 Challenge (Step 3)
  → Git Phase Init: Create new branch `phase-[N]-[description]`
  → Artifacts/TODO.md task assigned (Phase 1)
  → [pptx/pbi-report only] creative-director → Artifacts/LAYOUT_SPEC.md
  → /audit --pre (optional) → GO / NO-GO
  → Implementation (coder) — marks [-]
  → /audit (auditor) — validates → PASS: marks [x] | FAIL: return to coder
  → Git Phase Merge: Merge current branch to `main` and delete branch (if phase terminal)
  → /docs (scribe) → /sync (concierge) → /handoff (if ending)

> [!IMPORTANT]
> **Approval Discipline**: Plan approval and any stop-and-surface action (§Execution Cadence) MUST follow the `Approval Rubric` in `standards.md`. Under the run-to-done cadence, routine execution *steps* do not each require approval.
```

## Git Phase Branching

To ensure the stability of the `main` branch, all work must occur on isolated phase branches.

1. **Isolation**: No implementation work may occur directly on `main`.
2. **Branch Naming**: `phase-[N]-[description]` (e.g., `phase-2-seating-logic`).
3. **Trigger**: The `strategist` prompts for branch creation immediately after Step 0 approval in `/blueprint`.
4. **Merge Requirement**: A phase branch can only be merged to `main` after the `auditor` marks the final task of the phase as `[x]` and confirms all success metrics are met.
5. **Cleanup**: Delete the phase branch immediately after a successful merge.
6. **Commit-as-Handoff**: Task-completion commits (a commit that finishes a TODO task) carry the key decisions made and any blockers/notes for the next iteration in the commit body. Trivial/intermediate commits are exempt. Rationale: crash recovery between `/handoff`s — the git log becomes a self-maintaining brief that cannot drift.

<HARD-GATE>
No agent may begin implementation, write code, scaffold projects, or take any implementation action until Step 0 is complete AND the user has approved the plan. This applies to EVERY project regardless of perceived simplicity. "Simple" projects are where unexamined assumptions cause the most wasted work.
</HARD-GATE>

## Execution Cadence (Post-Approval)

The HARD-GATE above governs the **one** mandatory pre-work stop: no implementation before Step 0 + plan approval. *After* the plan is approved, work runs to completion under a **run-to-done cadence** — the agent does not stop for per-step human approval. It stops only at genuine forks.

**Orchestrator / executor split.** Opus orchestrates and verifies; Sonnet (coder) executes. Per step/slice: executor does the work → produces evidence → returns artifact paths + claim → the verifier (tiered per `model-routing.md` §Verification Tiering) checks the **raw artifact**, not the summary → advance autonomously on PASS.

**Evidence is a file, not a claim [HARD-GATE].** The executor redirects every command whose output backs a gate claim to `Artifacts/Temp/<phase>_<step>_<command>.txt` and returns the **path** (naming and redirection detail: `testing-strategy.md` §3). A verifier **MAY NOT return PASS** on a claim backed only by narrative — no artifact path, or a path the verifier did not open, means the gate is **INCOMPLETE** (not FAIL) and the executor is sent back to produce one. INCOMPLETE is not a stop-and-surface trigger; the orchestrator resolves it by re-dispatching.
- **Exempt**: MTP micro-tasks (§Micro-Task Protocol) verify at executor tier on exit code — there is no separate verifier to read a file.

```
YOU ── approve plan (once) ──► OPUS (orchestrate + verify) ──► SONNET (execute → evidence)
                                     │  ▲ raw artifacts (not summary) │
                                     │  └──────────────────────────────┘
                                     ├─ PASS → advance to next step (no human stop)
                                     └─ STOP & surface to YOU only on a trigger below
```

**Stop-and-surface triggers (the only reasons to halt for the user):**
1. A `— Mode: HITL` task, or any **destructive / irreversible** action (commit, push, reset, deploy, live state mutation).
2. A genuine ambiguity or decision the orchestrator cannot resolve from the plan, code, or sensible defaults.
3. A verification **FAIL**, or a Semantic-Loop / Emergency trigger (§Safeguards, §Emergency Protocols).

Everything else — reads, pure-logic, docs, reversible edits, passing gates — proceeds without a human stop. Human sign-off concentrates at **plan-approval** (HARD-GATE) and **irreversible actions**, not every step.

- **Attended vs unattended.** This governs *attended* sessions, where the user can interrupt at any point. It differs from `/afk`'s Default-HITL fail-safe (§TODO Mode tag), which governs *unattended* auto-execution and conservatively stops on anything untagged.
- **Precedence.** The `high-rigor-engineering` skill may tighten this back to synchronous per-gate stops for its declared phases; where the skill and this section conflict, the skill wins (as it already states).

## Artifacts/TODO.md Authority (Single Source)

| Agent / Command | Allowed | Forbidden |
|:---|:---|:---|
| **Strategist** | Create, restructure, add/remove tasks | Mark status |
| **Coder** | Mark `[-]` (in-progress) | Mark `[x]`, add/remove tasks |
| **Auditor** | Mark `[x]` (complete) after all gates pass | Add/remove tasks |
| **`/sync`, `/ingest`** | Propose completion (flag for auditor) | Mark `[x]` directly |
| **Scribe, Concierge** | Read-only (concierge may archive to `Artifacts/History/`) | Modify content or status |

**Task format**: `[ ] [agent] Task description — Success: metric`
- `[ ]` Not started | `[-]` In progress | `[x]` Auditor-verified complete

**Extended format (optional)**: `[ ] [agent] Tn: Task description — Success: metric — Blocked by: Tm[, Tk]`
- `Tn:` (task ID) and `Blocked by:` are both OPTIONAL — a task without them is fully valid. IDs are phase-local (`T1`..`Tn` within a `Phase-N-TODO.md`).
- Example: `[ ] [coder] T3: Wire schema validation into intake — Success: pytest tests/test_intake.py exit 0 — Blocked by: T1, T2`
- **Enforcement**: Auditor must not allow a task to be marked `[-]` while any listed blocker is not `[x]`.
- **Anti-pattern**: A linear chain (T2←T1, T3←T2, …) adds nothing over list order — omit `Blocked by:` there; use it only where the dependency graph diverges from list order.

**Mode tag (optional)**: append `— Mode: AFK` or `— Mode: HITL` to gate `/afk` auto-execution: `[ ] [agent] Tn: Task description — Success: metric — Mode: AFK — Blocked by: Tm`
- `AFK` = the `/afk` runner may auto-execute this task without user approval; `HITL` = user approval required before execution.
- **Default-HITL**: an untagged task is HITL — nothing auto-runs by omission (fail-safe).
- **Tagging authority**: strategist only, at planning time; no agent may retag at runtime.
- **Enforcement**: `/afk` never dispatches a HITL or untagged task.

## Persistence

- **Project State Persistence [HARD-GATE]**: All state files MUST live in the **Artifacts/** directory within the true logical project root (the source code repository). 
- **No Shadow-Only State**: Never write project-specific state ONLY to global AI directories (e.g., `~/.claude/projects/` or `~/.gemini/`). 
- **Absolute Path Requirement**: Always use the **absolute file path** of the current code workspace and the `Artifacts/` folder when writing or reading state files to prevent shadow directory collisions.
- **Platform Redirection Warning**: Platforms may automatically redirect `IsArtifact: true` calls to shadow folders — see `standards.md` Mirroring Rule [HARD-GATE] for the required mirrored-write behavior; it applies to all Artifacts/ persistence writes.

> [!IMPORTANT]
> **Interface-First Pattern**: For any data exchange or tool-building task, Phase 1 MUST define the "Contract" (JSON Schema/Outline) and obtain explicit user approval before implementation.

> [!TIP]
> **ROI Escalation**: Prioritize Tier 1 Metadata (Counts/Names) and Tier 2 Logic (Schemas/JSON) before escalating to Tier 3 Content (Full Source/Renders). Use the cheapest context that proves the claim.

| File | Owner (Create) | Owner (Maintain) | Purpose |
|:---|:---|:---|:---|
| `Artifacts/MEMORY_ANCHORS.md` | Strategist | Strategist | **Cold Storage**: Project-wide constants, constraints, and non-negotiables. (Persistent — never archived) |
| `Artifacts/Temp/` | All | Concierge (Cleanup) | **Transient Storage**: one-off diagrams, scratch scripts, and *uncited* verification output. Gitignored; purged freely. |
| `Artifacts/Evidence/` | Executor (promotion) | Auditor | **Durable Evidence**: verification artifacts cited by a durable record. Committed with the phase. **Never purged** — see §Evidence Retention. |
| `Artifacts/AUDIT_REPORT.md` | Auditor | Auditor | Gate-based quality review findings (Logic, Style, Hard Rules); see `/audit`. |
| `Artifacts/.agent/current_task.md` | Concierge | Concierge | Session focus |
| `Artifacts/LOCAL_AGENT_PROFILES.json` | Strategist | Strategist | Sub-agent role definitions |
| `Artifacts/IMPLEMENTATION_PLAN.md` | Strategist | Strategist | **The "How & Why"**: Technical design and rationale. |
| `Artifacts/TODO.md` | Strategist | All (see authority) | **The "Who & When"**: High-level execution status. |
| `Artifacts/BACKLOG.md` | Strategist/Coder (first deferral) | All | **Deferred-work registry**: unscheduled deferred work, filed findings, pending product decisions. Reference-on-demand (NOT boot-loaded). Lazy-created on first deferral, never scaffolded at init. Rotates (never prunes) past threshold — see **BACKLOG Lifecycle** below. Scoped/phase-shaped work → PLAN; loose item/finding/product-decision → BACKLOG; scheduled/status → TODO; decisions → DECISION_LOG. |
| `Artifacts/ARCH.md` | Strategist | Scribe (formatting) | Long-term system architecture |
| `Artifacts/COUNCIL_PROTOCOLS.md` | Strategist | Strategist | Deliberation rules for high-rigor decisions |
| `Artifacts/DECISION_LOG.md` | Council | Council | Pivot tracking & high-stakes resolutions. Rotates (never prunes) past threshold — see **DECISION_LOG Rotation** below. |
| `Artifacts/HANDOFF_BRIEF.md` | Concierge | Concierge | Session transition & next steps |
| `Artifacts/learnings/` | Concierge | Concierge | Categorized knowledge registry (Persistent — never archived). Excludes task status (→ TODO.md) and architecture decisions (→ DECISION_LOG.md); entry-format templates live in `learnings/index.md`. |
| `Artifacts/LAYOUT_SPEC.md` | Creative Director | Creative Director | Visual specs |
| `Artifacts/Plans/Phase-N-Plan.md` | Strategist | Strategist | **The "How & Why"**: Detailed phase technical design. |
| `Artifacts/Plans/Phase-N-TODO.md` | Strategist | Coder/Auditor | Phase-level task tracking and status. |
| `Artifacts/Reports/Phase-N-Report.md` | Auditor | Auditor | Phase completion summary and metrics. |

**Phase Lifecycle**:
- Plans/ and Reports/ files are created at phase start and end respectively
- After a phase is completed, its Plans/ and Reports/ files MUST be moved to History/
- `learnings/` and `MEMORY_ANCHORS.md` are permanent fixtures and are never archived
- All other artifacts follow the Archive policy once their active period ends

**DECISION_LOG Rotation** (never prune — rotate):
- **Trigger**: active `Artifacts/DECISION_LOG.md` exceeds **>400 lines OR >40 entries**.
- **Action**: move the **oldest RESOLVED** entries to `Artifacts/History/DECISION_LOG-archive.md`
  (prepend, preserving newest-first order) until the active log is back under threshold.
- **Keep**: all unresolved entries regardless of age, plus recent entries. **UNRESOLVED entries
  never rotate.**
- **Never delete** — the archive is append-only; rotation only moves entries, it does not prune them.
- Maintain a forward-pointer line at the top of the active log → the archive.
- **Trigger owner**: concierge at `/handoff`; manual via `/clean`.

**BACKLOG Lifecycle** (memory, not a queue — rotate, never prune):
- **Contract**: `BACKLOG.md` is **searchable memory** of deferred work and decisions-not-to-do.
  Nothing schedules off it — an item resurfaces when the thing it describes does. Optimize for
  findability and size, not for pickup.
- **Per entry**: a stable ID (`<phase>_<component>_<n>`) and a status marker (`OPEN` / `RESOLVED`).
  The marker is what makes rotation mechanical. Grouping and ordering are **project-local** — the
  OS does not constrain them.
- **Rotation trigger**: active `BACKLOG.md` exceeds **>250 lines OR >20 entries**.
- **Action**: move the oldest **RESOLVED** entries to `Artifacts/History/BACKLOG-archive.md`
  (prepend, preserving newest-first) until back under threshold. Maintain a forward-pointer line
  at the top of the active file → the archive.
- **Never delete** — the archive is append-only. **OPEN entries never rotate**, regardless of age.
- **Eviction**: an entry another durable doc cites as authoritative is a **reference**, not
  backlog — extract it to its own artifact rather than rotating it.
- **Trigger owner**: concierge at `/handoff` (`scripts/backlog_audit.py` reports it); manual `/clean`.

> [!NOTE]
> **Transient State Exception**: Platform-level logs for background commands (e.g., in system Temp directories) are managed by the host binary and are inherently transient. They are exempt from the `Artifacts/` persistence requirement.

### 🧪 Scratch Strategy [HARD-GATE]

To ensure project portability and auditability, agents MUST NOT use the system default shadow `scratch/` directory. 
- **Mandatory Path**: All one-off scripts, temporary data, and transient analysis files MUST be stored in `Artifacts/Temp/`.
- **Enforcement**: Any agent writing to a shadow directory during execution is in violation of the Persistence Hard-Gate.

### 📎 Evidence Retention [HARD-GATE]

`Artifacts/Temp/` is scratch and **gitignored** — nothing in it survives a phase. Evidence a
**durable record cites** must therefore be promoted before any purge, or the record ends up
pointing at a deleted file.

- **Promote when**: a phase report, `AUDIT_REPORT.md`, a `DECISION_LOG.md` entry, a
  `BACKLOG.md` finding, or a `learnings/` entry cites the file.
- **Promote to**: `Artifacts/Evidence/<phase>/<original-filename>`, committed with that phase.
  Repoint the citing record to the new path **in the same pass** — a promoted file with a stale
  citation is the same failure as a deleted one.
- **Purge law (binds every cleanup path — `/clean`, `/handoff`, high-rigor pre-commit)**: purge
  `Artifacts/Temp/`; **never** touch `Artifacts/Evidence/`. Promote cited files *before* purging.
- **Uncited evidence is not promoted** — it did its job at the gate and dies with `Temp/`.
  Promotion is the exception, not the default; `Evidence/` holds what a reader will actually
  follow a citation to.

## Artifact Separation: Plan vs. TODO

To prevent information redundancy and "maintenance debt":

1.  **IMPLEMENTATION_PLAN.md**: Must contain the **technical heavy lifting**. Specific file paths, logical changes, dependency orders, and code snippets belong here.
2.  **Plan Pruning [HARD-GATE]**: To prevent bloat, only the **Current Phase** and **Upcoming Phases** remain in the Plan. Once a Phase is completed, its technical spec MUST be moved to `Artifacts/History/Plans/Phase-[N]-Plan.md`.
3.  **TODO.md**: Must remain a **"Thin TODO"**. It should reference Phase numbers or high-level milestones from the plan.
    - **Forbidden**: Copy-pasting detailed file logic or implementation steps from the Plan into the TODO.
    - **Required**: Status tracking (`[-]`, `[x]`) only happens in the TODO.

**Rule**: If a change requires updating technical logic, update the Plan. If a change requires updating execution status, update the TODO.

## Conflict Resolution

- **Auditor rejection loop**: 1st → specific fix. 2nd → mandatory skill-file review. 3rd → escalate to strategist (task definition may be flawed).
- **Agent disagreement**: Coder documents concern → routes to strategist. Strategist has final authority on success metrics.
- **User override**: User says "Skip Step 0" → logged as `[STEP0-BYPASS]` in Artifacts/TODO.md → auditor flags HIGH severity.
- **Binding Rule Conflict**: When two binding rules genuinely conflict, record the resolution, its scope, and its grounds in the durable `Artifacts/DECISION_LOG.md` — never only in a session/scratch file. Annotate the superseded rule in place so future readers will find the contradiction and its resolution without context-hopping. A contract or plan statement about code that ALREADY EXISTS is a claim requiring verification at authoring time, not an assertion — mark such claims explicitly and check them before approval.

## Global Repository (AI OS Settings)

The `ai-code-settings` repository acts as the **Global Registry** for rules, skills, and standards.

- **Global Inbox**: Cross-project learnings are staged in the ai-code-settings repo's `Artifacts/GLOBAL_INBOX.md`.
- **Graduation**: Recurring patterns identified in a project's `Artifacts/learnings/` should be graduated to the global registry using `/learn --global` during a project session, or `/graduate` when working inside the global repository.

## Parallel Execution

To maximize throughput and rigor, the Agent OS utilizes parallel agent sessions for independent or high-stakes operations:

### 1. Multi-Persona Audit (`/audit --team`)
The `auditor` spawns parallel reviewers to audit the same code block:
- **Compliance Reviewer**: Checks against `coding-style.md`.
- **Domain Specialist**: Checks against specific skill (e.g., `rhino-e2e-testing`).
- **Risk Reviewer**: Audits for security and edge cases.
*Result: Aggregated into `Artifacts/AUDIT_REPORT.md`.*
*Default: Use `--team` for all full audits — measurably faster and deeper than sequential scanning. Fall back to a single auditor only when token limits are hit.*

### 2. Independent Module Refactor
The `coder` can spawn sub-agents to refactor non-dependent modules simultaneously:
- **Sub-Agent A**: Refactors `src/geometry/`
- **Sub-Agent B**: Refactors `src/data_processing/`
*Restriction: Parallel writes to the same file are FORBIDDEN.*

### 3. Council Deliberation (`/council`)
The `council` agent orchestrates a parallel "debate" between the Strategist, Coder, and Auditor to resolve architectural conflict.

---

## Standard Taxonomies

### 1. Status Hierarchy
| Marker | Level | Authority | Meaning |
|:---|:---|:---|:---|
| `[ ]` / `[-]` / `[x]` | Task | Strategist/Coder/Auditor | Not started / In progress / Complete (see TODO Authority above). |
| `DONE` | Claim | Coder | Work finished, ready for audit. |
| `PASS` / `FAIL` | Result | Auditor | Audit gate cleared / blocked (Logic/Style). |
| `[x]` | Final | Auditor | Task complete in `TODO.md`. **The ONLY terminal state.** |
| `GO` / `NO-GO` | Pre-audit | Auditor | `/audit --pre` approved / blocked. |
| `DRIFT` / `STALE` / `RECONCILED` | Sync | Concierge | Unplanned change / no progress / filesystem matches artifact state (`/sync`). |
| `CLEAN` | Security | Auditor | Security sweep passed (No secrets/vulnerabilities). |

### 2. Severity Scale
- **CRITICAL**: Breaking change, security breach, or data loss risk.
- **HIGH**: Feature-blocking bug, major architectural drift.
- **MEDIUM**: Non-blocking bug, documentation staleness, minor style drift.
- **LOW**: Optimization hint, suggestion, non-visible polish.
- **INFO**: Factual observation, no action required.

---

- **Always `/handoff` before ending**: Any session with code changes, documentation updates, or design decisions MUST end with `/handoff`. This captures learnings, snapshots TODO state, and writes a brief for the next session. Exiting without `/handoff` breaks the feedback loop and wastes re-orientation time.
- **Concierge prompt**: If the agent detects the user is wrapping up (e.g., "thanks", "that's it", "done for now") without a `/handoff`, the concierge should suggest it.

## Emergency Protocols

- **Context window >60%**: Concierge triggers `/handoff`. All agents yield.
- **Security incident**: FREEZE → AUDIT → REMEDIATE → RESUME (see `security.md`).
- **State file corruption**: Check `Artifacts/History/` → reconstruct from `Artifacts/.agent/current_task.md` + `Artifacts/DECISION_LOG.md` → `/sync`.

## Safeguards & Efficiency

### 1. Context Layering (L0/L1/L2)
To minimize token consumption, agents MUST follow the tiered loading strategy:
- **L1 (Overview)**: Query `agents/agents.overview.md` or `skills/skills.overview.md` first.
- **L0 (Abstract)**: Read the `*.abstract.md` to confirm functional fit.
- **L2 (Full Definition)**: Load the full agent/skill file ONLY when active work begins.

### 2. Semantic Loop Detection
If an agent performs the same action type on the same file/state 3 times without a state change (e.g., 3 failed lint fixes), it MUST:
1. **FREEZE**: Stop implementation.
2. **TRIAGE**: Analyze the loop cause.
3. **ESCALATE**: Propose a plan pivot to the user or a different agent (Council).

### 3. Findings Protocol (Phase Handoff)
To ensure technical continuity across session boundaries:
1. **Produce**: At the end of every task, the agent files technical specifics (variable names, logic traps, API quirks) into `Artifacts/BACKLOG.md` — the single home for deferred work and findings — rather than scattering them across per-phase "still open" sections.
2. **Consume**: The next agent reads `BACKLOG.md` as part of their intake.
3. **Graduate**: The Concierge promotes persistent findings to the `Artifacts/learnings/` registry during `/handoff`; scheduled items graduate out to a PLAN phase.

### 4. Slicing & Economics
Refer to `rules/common/TOKEN-ECONOMICS.md` for mandatory project slicing thresholds and context pressure management rules.