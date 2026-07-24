---
description: AFK task runner — orchestrates dispatch, review, and audit of AFK-tagged tasks without user presence, task by task, until the frontier empties or the cap hits.
argument-hint: "[max_iterations]"
model: claude-opus-5
---

# Command: /afk

**Target**: `$ARGUMENTS` → optional `[max_iterations]` (default `10`).

**Owner**: coder (dispatch) / auditor (gates)
**Executed by**: the **main session**, acting as orchestrator. This is a markdown procedure —
no scripts, hooks, or embedded logic. The model reading this file performs every step.

## 1. Preconditions (hard-stops)

Check in order; on any failure, output **only** the stated stop message and take no further action.

1. **Model tier**: current session model must be Opus-tier or above. If not: output "Run
   `/model opus` and re-invoke `/afk`." and stop.
2. **Plan exists**: an approved plan and phase TODO exist (`Artifacts/Plans/Phase-N-TODO.md`
   or `Artifacts/TODO.md`). If neither exists: stop, tell the user to run `/blueprint` first.
3. **Clean tree**: `git status` shows a clean working tree (all prior work committed). If not:
   stop, tell the user to commit or stash before running `/afk`.

## 2. Frontier Definition

The **frontier** is the next task in the active TODO where, per `orchestration.md`
§Artifacts/TODO.md Authority (Extended format + Mode tag):

- status is `[ ]`, AND
- the task carries `— Mode: AFK`, AND
- every ID listed in its `— Blocked by: Tm[, Tk]` is marked `[x]`.

An **untagged task or one tagged `— Mode: HITL` is NEVER in the frontier** (default-HITL rule —
nothing auto-runs by omission). If no task satisfies all three conditions, the frontier is empty.

## 3. Dispatch

For the frontier task:

1. Read the task's `[agent]` field — dispatch that agent type via the `Agent` tool so
   agent-model bindings apply (coder → Sonnet, scribe → Haiku, auditor → Sonnet, per
   `rules/common/model-routing.md`).
2. Build the prompt from `skills/implementation-dispatch/implementer-prompt.md`, filling in the
   task description, success metric, and file-scope boundary.
3. The subagent marks the task `[-]` on start and reports one of the `implementation-dispatch`
   status codes: `DONE`, `DONE_WITH_CONCERNS`, `NEEDS_CONTEXT`, `BLOCKED`.

## 4. Orchestrator Review (every return)

Per `skills/implementation-dispatch/SKILL.md` §Two-Stage Review — performed by the orchestrator
(or a dispatched reviewer using `reviewer-prompt.md`) on **every** subagent return, never trusting
a `DONE` claim at face value:

- **Stage A — Spec Compliance**: implemented exactly what the task asked; no missed success
  metrics; nothing extra. Verify against the actual diff, not the subagent's summary.
- **Stage B — Technical Quality**: only evaluated after Stage A passes — `coding-style.md`
  compliance, regressions, error paths, magic numbers.

**FAIL** at either stage → write specific feedback, re-dispatch the same agent type.

**Loop detection**: fingerprint = `[target file] + [tool used] + [task goal]`. Three identical
fingerprints for the same task → **FREEZE** the frontier task and escalate to the user (do not
re-dispatch a fourth time).

## 5. Auditor Gate (every task)

After orchestrator review passes:

1. Dispatch an `auditor` subagent to verify the task's success metric **fresh** (rerun the
   command/test — never accept the coder subagent's prior output as evidence).
2. On PASS, the auditor subagent marks the task `[x]`.
3. The auditor's findings are **appended** as a new dated section to
   `Artifacts/Reports/afk-run-<YYYY-MM-DD>.md` (create the file on first use). This report is
   **never** written to `Artifacts/AUDIT_REPORT.md` — that file is reserved for standalone
   `/audit` runs.

## 6. Commit

After the auditor PASS, create a task-completion commit per `orchestration.md`
§Git Phase Branching item 6 (commit-as-handoff): the commit body carries the key decisions made
during the task and any blockers/notes for the next iteration. Trivial/intermediate commits made
mid-task remain exempt — only the final, task-closing commit needs this body.

## 7. Exits

| Condition | Result |
|:---|:---|
| Frontier empty AND all tasks `[x]` | **`AFK-RUN COMPLETE`** — report the run summary (tasks completed, commits made). |
| Frontier empty AND tasks remain | **`AFK-RUN PAUSED`** — report exactly which HITL/untagged/blocked tasks gate further progress; wait for user. (No HITL task is ever "reached" — an empty frontier with work remaining is the only pause trigger.) |
| Iteration cap hit (`max_iterations`, default 10) | **`AFK-RUN CAPPED`** — report the run summary and the remaining frontier. |
| Loop-detect FREEZE (§4) | Escalate per `implementation-dispatch` §3 Resolution — do not continue the run. |

Repeat steps 2–6 once per iteration until an exit condition is hit.

## 8. TODO Authority Preserved

The orchestrator (this command) marks **nothing** in any TODO file. Per `orchestration.md`
§Artifacts/TODO.md Authority: the dispatched **coder** subagent marks `[-]`; the dispatched
**auditor** subagent marks `[x]`. The orchestrator's role is dispatch, review, and reporting only.

## Relationships

- **implementation-dispatch**: source of the prompt templates, status codes, and loop-detection
  protocol used in §3–4.
- **orchestration.md**: source of the `Blocked by:` / `Mode:` tag syntax (§Artifacts/TODO.md
  Authority) and the commit-as-handoff rule (§Git Phase Branching item 6).
- **`/audit`**: standalone quality gate — distinct from the per-task auditor dispatch in §5; do
  not conflate their report destinations.
