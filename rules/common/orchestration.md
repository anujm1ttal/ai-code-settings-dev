---
name: agent-orchestration
description: Canonical source for agent routing, task lifecycle, Artifacts/TODO.md authority, conflict resolution, and project-type activation across the Claude Code AI OS.
---

# Agent Orchestration

## Fleet & Project Type Routing

Roster + write scope + binding: `agents/agents.overview.md`. Routing table: same file
§Project Type Routing.

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

File table: `agents/concierge.md` §Persistence. Rotation: `commands/handoff.md` §DECISION_LOG
Rotation. `BACKLOG.md`: `commands/blueprint.md` §BACKLOG. Plan/TODO: `agents/strategist.md`
§Plan vs. TODO.

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

## Conflict Resolution

- Auditor rejection: 1st → specific fix. 2nd → mandatory skill-file review. 3rd → escalate to
  strategist (task definition may be flawed).
- Agent disagreement: coder documents concern → strategist decides (final authority on metrics).
- User override "skip Step 0": logged `[STEP0-BYPASS]` in TODO.md, auditor flags HIGH severity.
- Binding rule conflict: record resolution + scope + grounds in `DECISION_LOG.md`, annotate the
  superseded rule in place. A claim about existing code needs verification at authoring time,
  not assertion — mark and check it before approval.

## Global Repository & Parallel Execution

`commands/graduate.md` §Global Repository. `commands/audit.md`, `commands/council.md`,
`agents/coder.md` §Parallel Execution.

## Standard Taxonomies

| Marker | Level | Authority | Meaning |
|:---|:---|:---|:---|
| `[ ]`/`[-]`/`[x]` | Task | Strategist/Coder/Auditor | Not started / in progress / complete |
| `DONE` | Claim | Coder | Finished, ready for audit |
| `PASS`/`FAIL` | Result | Auditor | Gate cleared / blocked |
| `GO`/`NO-GO` | Pre-audit | Auditor | `/audit --pre` verdict |
| `DRIFT`/`STALE`/`RECONCILED` | Sync | Concierge | `/sync` outcome |
| `CLEAN` | Security | Auditor | Security sweep passed |

Severity: `agents/auditor.md` §Severity Levels.

Always `/handoff` before ending any session with code/doc/design changes — it captures
learnings, snapshots TODO, briefs the next session.

## Emergency Protocols

- Context window >60%: concierge triggers `/handoff`, all agents yield.
- Security incident: FREEZE → AUDIT → REMEDIATE → RESUME (`agents/auditor.md` §Incident Response).
- State corruption: check `History/` → reconstruct from `current_task.md` + `DECISION_LOG.md` → `/sync`.

## Safeguards & Efficiency

- **Context Layering**: L1 overview first → L0 abstract to confirm fit → L2 full definition only
  when work begins.
- **Semantic Loop Detection**: same action on the same file/state 3× with no state change →
  FREEZE → TRIAGE → ESCALATE (propose a pivot to the user or council).
- **Findings/Slicing**: `commands/handoff.md` §Findings Protocol, `commands/blueprint.md`
  §Slicing Thresholds.
