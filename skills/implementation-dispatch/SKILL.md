---
name: implementation-dispatch
description: Use this skill when executing a roadmap with 3+ independent tasks or when the conversation context length is at 70% or higher. It allows the main agent to delegate specific, bounded tasks to fresh subagents, preserving the primary context for coordination and high-level strategy. Trigger when you identify parallelizable work in the TODO list or when you feel "context poisoning" affecting your performance. Do NOT use for tasks that require deep, real-time coordination across multiple files that haven't been modified yet.
argument-hint: "[--dispatch <agent_type> | --status]"
metadata:
  version: "2.3.0"
  tags: [subagent, delegation, orchestration, parallel, task-execution, context-management]
---


# Skill: Implementation Dispatch

## 🛸 Overview
Implementation Dispatch allows the `coder` agent to delegate specific tasks to fresh subagents. This preserves the main agent's context for coordination and ensures every task starts with a clean slate.

## Subagent Status Codes

Subagents MUST report one of these status codes when returning:

| Code | Meaning | Controller Action |
|:---|:---|:---|
| **DONE** | Task complete with evidence | Proceed to two-stage review |
| **DONE_WITH_CONCERNS** | Task complete but doubts exist | Read concerns → address if correctness/scope → then review |
| **NEEDS_CONTEXT** | Cannot proceed without info | Provide context → re-dispatch |
| **BLOCKED** | Cannot complete the task | Assess: context → re-dispatch. Plan wrong → escalate to user. |

## Prompt Templates

Use the structured prompt templates in this skill directory:
- **`implementer-prompt.md`**: Template for dispatching implementing subagents. Includes status codes, constraints, and self-review checklist.
- **`reviewer-prompt.md`**: Template for dispatching review subagents. Defines the two-stage review protocol (Spec → Quality).

Read the relevant template before dispatching. Adapt the placeholders to the specific task.

## 🚀 The Dispatch Workflow

### 1. Task Selection
- Select the next `[ ]` task from `Artifacts/TODO.md`.
- Verify dependencies are met (no predecessors still `[ ]` or `[-]`).
- **Parallel Independence Test**: Two tasks are parallel-dispatchable only if neither transitively blocks the other via `Blocked by:` AND the Footprint Check below passes (no shared-file conflict). Tasks without a `Blocked by:` field fall back to list-order judgment (the field is optional).
- Identify file scope boundaries for the subagent.
- **Footprint Check (mandatory before any parallel wave)**: List each task's file footprint. ANY overlap ⇒ merge those tasks into one agent or serialize them — parallel writes to one file fail as silent overwrites, not merge conflicts. Additionally, every parallel prompt must explicitly ban shared-config edits (`conftest.py`, `pytest.ini`, shared fixtures): instruct "define fixtures locally."

### 2. Subagent Invocation
Use the `agent` tool with the `implementer-prompt.md` template.
- **Local Profile**: Reference `Artifacts/LOCAL_AGENT_PROFILES.json` to determine the instructions and paths for the subagent.
- **Role Assignment**: Explicitly instruct the subagent to "Assume the identity and instructions for the [Role] profile."
- **Environment**: If your environment supports it, ensure `AGENT_ROLE` is set to trigger role-aware context injection in `hooks/session-boot.js`.
- **Model Selection**: Use the cheapest model that can handle the task. Mechanical tasks (scaffolding, boilerplate) → lightweight model. Judgment tasks (architecture, edge cases) → capable model.

### 3. Two-Stage Review (STANDARD)
When the subagent returns, dispatch a reviewer using `reviewer-prompt.md` OR perform the review yourself. Two distinct stages BEFORE integrating:

**Stage A: Spec Compliance (The "What")**
- Did the subagent implement exactly what was in the task?
- Did they miss any success metrics?
- Is anything EXTRA that wasn't requested?

**Stage B: Technical Quality (The "How")**
- Does the code follow `rules/common/coding-style.md`?
- Are there any potential regressions or logic flaws?
- Are error paths handled? Magic numbers eliminated?

**Stage A MUST pass before Stage B is evaluated.**

### 4. Council Review (HIGH RIGOR)
For critical tasks flagged in `Artifacts/COUNCIL_PROTOCOLS.md`, swap Stage A/B for a **Council Dispatch**:
1. **Dispatch Member A (Skeptic)**: Review for security and edge cases.
2. **Dispatch Member B (Maintainer)**: Review for docs and readability.
3. **Synthesis**: The main agent (as Chair) merges critiques into the final review summary before marking `[x]`.

### 5. Subagent Constraint Verification
When verifying a subagent's work or report:
- **Check the CONSTRAINT against the artifact**, not the agent's sentence about it. Imprecise phrasing over correct substance is the common case; misreading it in either direction is costly.
- **Instruct agents to self-report scope deviations** (e.g., "If you used a forbidden tool or modified an off-limits file, flag it explicitly"). A self-reported violation is a trust signal and must not be penalized relative to a concealed one.
- **Recognize correct refusals**: An agent that declines an out-of-scope task and names the correct owner is behaving correctly, not unhelpfully.

### 6. Integration & State Update
- Merge the changes only after review PASS.
- Update `Artifacts/TODO.md` to `[-]` (if verifying) or wait for the `auditor` to mark `[x]`.
- Invoke `verification-gate` before claiming completion.
- Update subagent fingerprint history in `Artifacts/.agent/dispatch_history.json`.

## 🔄 Loop Detection Protocol

To prevent subagents from getting stuck in infinite correction loops:

### 1. Fingerprinting
The dispatcher (main agent) MUST track the **action fingerprint** of each subagent dispatch:
- **Fingerprint** = `[Target File] + [Tool Used] + [Error Message / Goal]`
- Store history in `Artifacts/.agent/dispatch_history.json` (ephemeral).

### 2. Detection
A **Loop** is detected if the SAME fingerprint is generated **3 times** for the same task.

### 3. Resolution
Once a loop is detected, the dispatcher MUST:
1. **FREEZE**: Terminate the subagent thread.
2. **TRIAGE**: Analyze the logs. Is the tool failing? Is the file path wrong? Is the model not capable enough?
3. **ESCALATE**: 
   - If a minor fix (path/param): Re-dispatch with corrected context.
   - If a logic failure: Escalate to **Council** or the user for a plan pivot.
   - If a model limitation: Re-dispatch using a more capable model (Opus).

## 🚫 Anti-Rationalization Table

| Excuse | Reality |
| :--- | :--- |
| "It's a small task, I'll just do it myself." | Small tasks add up to context bloat. If context > 70%, DISPATCH. |
| "Subagents are too slow." | Reviewing a subagent is 10x faster than debugging your own context-poisoned hallucinations. |
| "I'll review both stage A and B together." | You will miss details. Cognitive load is higher when mixing 'what' and 'how'. Separate them. |
| "The subagent said DONE, so it's done." | DONE is a claim, not evidence. Verify via diff and test output. |

## 🚩 Red Flags
- Subagents returning without command output verification.
- Subagents making "cleanup" changes in unrelated files.
- Main agent integrating code without reading it (skipping the two-stage review).
- Ignoring DONE_WITH_CONCERNS status — concerns are signals, not noise.
- Repeatedly re-dispatching BLOCKED tasks without changing context or plan.
