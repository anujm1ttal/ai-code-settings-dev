---
name: agent-orchestration
description: Canonical source for agent routing, task lifecycle, Artifacts/TODO.md authority, conflict resolution, and project-type activation across the Claude Code AI OS.
---

# Agent Orchestration

## The Fleet

| Agent | Role | Write Scope |
|:---|:---|:---|
| **strategist** | Architecture, ROI, roadmaps | `IMPLEMENTATION_PLAN.md`, `TODO.md` (create/restructure, not status) |
| **coder** | Implementation, refactoring | Source, tests, `[-]` status |
| **auditor** | QA, technical review | `Reports/<PHASE>-AUDIT_REPORT.md`, `TODO.md` (`[x]` only), `BACKLOG.md` findings. Reports, never applies — a needed source/test fix is a report line, not an edit. |
| **scribe** | Documentation, teaching | Artifacts docs not owned elsewhere (+ `README.md`) |
| **council** | Synthesis, stress-testing | `DECISION_LOG.md` |
| **creative-director** | Visual spec, hierarchy | `Artifacts/LAYOUT_SPEC.md` |
| **concierge** | State, sync, intake | `Artifacts/learnings/`, `/clean` |
| **geometry-validator** | Geometric auditing | Audit reports; dispatched only, no standalone authority |

`model-routing.md` owns which model runs each role — on divergence it wins over this table.

## Project Type Routing

Strategist classifies every project at Step 0; this sets active agents/skills. Activation is
via `enabledPlugins` — the table below is guidance, not stored config.

| Project Type | Core Agents | Default Skills |
|:---|:---|:---|
| `youtube` | strategist, scribe, concierge | youtube-strategy, youtube-scriptwriting, youtube-retention |
| `pptx` | strategist, creative-director, concierge | pptx, visual-composition, python-patterns |
| `pbi-report` | strategist, creative-director, coder | powerbi-report, visual-composition, dax-modeling |
| `geometry` | strategist, coder, auditor | cd-foundations, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing, grasshopper-plugin-packaging, python-patterns |
| `code` | strategist, coder, auditor | codebase-navigator, systematic-debugging, python-patterns, python-mcp, typescript-mcp, react-frontend |
| `manuscript` | strategist, scribe, auditor | manuscript-review, glossary-extraction |
| `data` | strategist, coder, auditor | dax-modeling, powerbi-report, python-patterns |
| `hybrid` | concierge, strategist | all applicable, per detected files |

All types also get: `codebase-navigator`, `systematic-debugging`, `implementation-dispatch`,
`verification-gate`, `test-driven-development`, `receiving-code-review`, `project-planner`,
`project-journal`, `doc-updater`.

Office skills (`docx`/`xlsx`/`pptx`) aren't shipped — Anthropic-licensed, obtain from Anthropic.
`pptx` projects still get `creative-director` + `visual-composition` for planning.

`CLAUDE-global.md`'s Commands table is canonical for the command registry. This file owns
routing logic (below) and command-adjacent protocols (MTP, lifecycle, branching).

## Micro-Task Protocol (MTP)

≤1 file, ≤30 lines, no architecture/dependency change: skip `/blueprint` and Step 0, state a
one-line `VALUE_CHECK`, implement, verify.

## Automatic Routing

1. Planning, "should we" → strategist (`/blueprint`)
2. Plan stress-test, "grill me" → strategist (`/grill`; escalate via `/council`)
3. Skill landscape, routing optimization → strategist (`/skill-graph`)
4. Codebase discovery, tech-debt mapping → strategist (`/sweep`)
5. Bug investigation, root-cause → coder (`/triage`)
6. Implementation, refactoring, debugging → coder
7. Review, "is this correct" → auditor (`/audit`)
8. Factual codebase snapshot → auditor (`/snapshot`)
9. Documentation, guides → scribe (`/docs`)
10. Teaching, "how does this work" → scribe (`/explain`)
11. Manual work intake → concierge (`/ingest`)
12. Session start, "where was I" → concierge (`/sync`)
13. Session end → concierge (`/handoff`)
14. Hygiene, cleanup → concierge (`/clean`)
15. High-rigor deliberation, conflict → council (`/council`)
16. Glossary extraction → scribe (`glossary-extraction`)
17. Ambiguous → concierge asks first

Geometry, production, regulatory, or zero-rework-tolerance work: equip `high-rigor-engineering`
(`skills/high-rigor-engineering/SKILL.md`) — same agents/commands, but gates become synchronous.
Its own header states precedence over this file where they conflict.

## Task Lifecycle

```
/blueprint (strategist)
  → Requirements Interview → Grilling (optional) → Step 0 Challenge
  → Git Phase Init: branch `phase-[N]-[description]`
  → TODO.md task assigned
  → [pptx/pbi-report only] creative-director → LAYOUT_SPEC.md
  → /audit --pre (optional) → GO / NO-GO
  → Implementation (coder) — marks [-]
  → /audit (auditor) → PASS: marks [x] | FAIL: back to coder
  → Git Phase Merge → main, delete branch (if phase terminal)
  → /docs → /sync → /handoff (if ending)
```
Plan approval and any stop-and-surface action follow the Approval Rubric in `standards.md`.

## Git Phase Branching

No implementation directly on `main`. Branch `phase-[N]-[description]` at Step 0 approval.
Merge to `main` only after the auditor marks the phase's final task `[x]`; delete the branch
after merge. Task-completion commits carry key decisions/blockers in the body (trivial commits
exempt) — the git log becomes a self-maintaining crash-recovery brief.

<HARD-GATE>
No agent may begin implementation, write code, scaffold projects, or take any implementation
action until Step 0 is complete AND the user has approved the plan. Applies to every project
regardless of perceived simplicity.
</HARD-GATE>

## Execution Cadence (Post-Approval)

After plan approval, work runs to completion (run-to-done) — no per-step human stop, only at
genuine forks. Opus orchestrates and verifies; Sonnet executes: work → evidence → verifier
checks the raw artifact (never the summary) → advance on PASS.

**Evidence is a file, not a claim [HARD-GATE].** Redirect any command backing a gate claim to
`Artifacts/Temp/<phase>_<step>_<command>.txt`, return the path (`testing-strategy.md` §3). No
artifact, or an unopened one, means INCOMPLETE (not FAIL) — re-dispatch, don't stop-and-surface.
MTP exempts: executor verifies on exit code, no separate verifier.

```
YOU ── approve plan (once) ──► OPUS (orchestrate+verify) ──► SONNET (execute→evidence)
                                     PASS → next step, no stop
                                     STOP & surface only on a trigger below
```

**Stop-and-surface triggers** (the only reasons to halt):
1. `— Mode: HITL`, or destructive/irreversible action (commit, push, reset, deploy, live mutation).
2. Genuine ambiguity the orchestrator can't resolve from plan/code/defaults.
3. Verification FAIL, or a Semantic-Loop/Emergency trigger.

Everything else proceeds without a stop. `/afk`'s Default-HITL fail-safe is stricter (unattended
auto-execution); `high-rigor-engineering` may tighten this back to synchronous gates — it wins
on conflict.

## Artifacts/TODO.md Authority

| Agent / Command | Allowed | Forbidden |
|:---|:---|:---|
| Strategist | Create, restructure, add/remove tasks | Mark status |
| Coder | Mark `[-]` | Mark `[x]`, add/remove tasks |
| Auditor | Mark `[x]` after gates pass | Add/remove/edit tasks; edit source/tests (report instead) |
| `/sync`, `/ingest` | Propose completion (flag for auditor) | Mark `[x]` directly |
| Scribe, Concierge | Read-only (concierge may archive) | Modify content or status |

Format: `[ ] [agent] Task — Success: metric`. `[ ]` not started, `[-]` in progress, `[x]`
auditor-verified complete (the only terminal state).

Extended (optional): `[ ] [agent] Tn: Task — Success: metric — Blocked by: Tm`. `Tn:` and
`Blocked by:` are both optional; IDs are phase-local. Auditor must not allow `[-]` while a
blocker isn't `[x]`. Skip `Blocked by:` for a linear chain — it adds nothing over list order.

Mode tag (optional): `— Mode: AFK` (runner may auto-execute) or `— Mode: HITL` (needs approval).
Untagged = HITL (fail-safe default). Strategist tags at planning time only; `/afk` never
dispatches HITL or untagged tasks.

## Persistence

State lives in the project's own **Artifacts/** directory — never only in `~/.claude/projects/`
or similar shadow dirs. Use absolute paths to avoid shadow-directory collisions. Platforms may
redirect `IsArtifact: true` writes to shadow folders — see `standards.md` Mirroring Rule.

> **Interface-First Pattern**: data-exchange/tool-building work defines the Contract (schema)
> and gets explicit approval before implementation.
> **ROI Escalation**: Tier 1 metadata/names → Tier 2 schemas/JSON → Tier 3 full source, only as
> needed. Cheapest context that proves the claim.

| File | Owner | Purpose |
|:---|:---|:---|
| `MEMORY_ANCHORS.md` | Strategist | Cold storage: constants/constraints, never archived |
| `Temp/` | All (Concierge cleans) | Scratch: one-off scripts, uncited output. Gitignored, purged freely |
| `Evidence/` | Executor promotes, Auditor maintains | Durable, cited verification artifacts. Never purged |
| `Reports/<PHASE>-AUDIT_REPORT.md` | Auditor | Gate findings |
| `.agent/current_task.md` | Concierge | Session focus |
| `IMPLEMENTATION_PLAN.md` | Strategist | How & why |
| `TODO.md` | Strategist (Coder/Auditor status) | Who & when |
| `BACKLOG.md` | Strategist/Coder | Deferred work, findings, decisions-not-to-do. See BACKLOG below |
| `ARCH.md` | Strategist | Long-term architecture |
| `DECISION_LOG.md` | Council | Pivot tracking. Rotates past threshold, see below |
| `HANDOFF_BRIEF.md` | Concierge | Session transition |
| `learnings/` | Concierge | Knowledge registry, never archived |
| `LAYOUT_SPEC.md` | Creative Director | Visual specs |
| `Plans/Phase-N-Plan.md`, `Plans/Phase-N-TODO.md` | Strategist / Coder+Auditor | Phase design & tracking |
| `Reports/Phase-N-Report.md` | Auditor | Phase completion summary |

Plans/Reports move to `History/` once a phase completes; `learnings/` and `MEMORY_ANCHORS.md`
never archive.

**DECISION_LOG Rotation**: past >400 lines OR >40 entries, move oldest **RESOLVED** entries to
`History/DECISION_LOG-archive.md` (prepend, newest-first) until under threshold. Unresolved
entries never rotate. Never delete — archive is append-only. Owner: concierge at `/handoff`.

**BACKLOG**: a plain running list of deferred work — one entry per item (a line or a short
paragraph), marked `OPEN` or `RESOLVED`. Nothing auto-schedules off it: `/sync` surfaces OPEN
entries, and `/blueprint` forces a verdict on each (pull in / keep / resolve). No IDs, caps, or
rotation protocol — when it gets unwieldy, move the RESOLVED entries to
`History/BACKLOG-archive.md`. Existing entries keep their IDs so old citations still resolve.

> Platform-level logs for background commands (system Temp dirs) are host-managed and exempt
> from the Artifacts/ persistence requirement.

### Scratch Strategy [HARD-GATE]

Never use the shadow `scratch/` directory. All one-off scripts/temp data go in `Artifacts/Temp/`.

### Evidence Retention [HARD-GATE]

`Temp/` is gitignored scratch — nothing survives a phase. Promote a file to
`Evidence/<phase>/<filename>` (committed) *before* purging, whenever a phase report, audit
report, `DECISION_LOG.md`, `BACKLOG.md`, or `learnings/` entry cites it — and repoint the
citation in the same pass. Uncited evidence just dies with `Temp/`. A rolling report
(`Phase-N-Report.md`) archives to `History/Reports/<sha>-<name>.md` before being overwritten,
same repoint-in-same-pass rule. Evidence citations name immutable paths; state references
(`TODO.md`, a Plan) may name mutable ones.

## Plan vs. TODO

`IMPLEMENTATION_PLAN.md` holds the technical heavy lifting (file paths, logic, dependency
order); only current + upcoming phases stay in it — completed phases move to
`History/Plans/Phase-[N]-Plan.md`. `TODO.md` stays thin: status tracking only, references
Plan phases, never copies implementation detail. Unscheduled work goes to `BACKLOG.md`.

## Conflict Resolution

- Auditor rejection: 1st → specific fix. 2nd → mandatory skill-file review. 3rd → escalate to
  strategist (task definition may be flawed).
- Agent disagreement: coder documents concern → strategist decides (final authority on metrics).
- User override "skip Step 0": logged `[STEP0-BYPASS]` in TODO.md, auditor flags HIGH severity.
- Binding rule conflict: record resolution + scope + grounds in `DECISION_LOG.md`, annotate the
  superseded rule in place. A claim about existing code needs verification at authoring time,
  not assertion — mark and check it before approval.

## Global Repository

`ai-code-settings` is the Global Registry for rules/skills/standards. Cross-project learnings
stage in its `Artifacts/GLOBAL_INBOX.md`; `/learn --global` or `/graduate` promotes them.

## Parallel Execution

- **`/audit --team`**: auditor spawns parallel reviewers (compliance, domain specialist, risk) →
  aggregated into `Reports/<PHASE>-AUDIT_REPORT.md`. Default for full audits; fall back to a
  single auditor only on token limits.
- **Independent refactor**: coder can spawn sub-agents for non-dependent modules. Parallel writes
  to the same file are forbidden.
- **`/council`**: parallel debate between strategist/coder/auditor to resolve conflict.

## Standard Taxonomies

| Marker | Level | Authority | Meaning |
|:---|:---|:---|:---|
| `[ ]`/`[-]`/`[x]` | Task | Strategist/Coder/Auditor | Not started / in progress / complete |
| `DONE` | Claim | Coder | Finished, ready for audit |
| `PASS`/`FAIL` | Result | Auditor | Gate cleared / blocked |
| `GO`/`NO-GO` | Pre-audit | Auditor | `/audit --pre` verdict |
| `DRIFT`/`STALE`/`RECONCILED` | Sync | Concierge | `/sync` outcome |
| `CLEAN` | Security | Auditor | Security sweep passed |

Severity: **CRITICAL** (breaking/security/data-loss) → **HIGH** (feature-blocking, major drift)
→ **MEDIUM** (non-blocking bug, staleness) → **LOW** (optimization hint) → **INFO** (factual).

Always `/handoff` before ending any session with code/doc/design changes — it captures
learnings, snapshots TODO, briefs the next session.

## Emergency Protocols

- Context window >60%: concierge triggers `/handoff`, all agents yield.
- Security incident: FREEZE → AUDIT → REMEDIATE → RESUME (`security.md`).
- State corruption: check `History/` → reconstruct from `current_task.md` + `DECISION_LOG.md` → `/sync`.

## Safeguards & Efficiency

- **Context Layering**: L1 overview first → L0 abstract to confirm fit → L2 full definition only
  when work begins.
- **Semantic Loop Detection**: same action on the same file/state 3× with no state change →
  FREEZE → TRIAGE → ESCALATE (propose a pivot to the user or council).
- **Findings Protocol**: file technical specifics (variable names, logic traps) to `BACKLOG.md`
  at task end. `/sync` surfaces OPEN entries; `/blueprint` forces a verdict on each. Concierge
  graduates persistent findings to `learnings/` at `/handoff`.
- **Slicing & Economics**: see `TOKEN-ECONOMICS.md` for slicing thresholds.
