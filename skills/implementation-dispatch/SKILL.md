---
name: implementation-dispatch
description: Use when executing a roadmap with 3+ independent tasks or when context length is at 70%+. Orchestrates subagents for task execution.
tags: [subagent, delegation, orchestration, parallel, task-execution, context-management]
auto_activate: false
argument-hint: "[--dispatch <agent_type> | --status]"
metadata:
  version: "1.0.1"
---


# Skill: Implementation Dispatch

## 🛸 Overview
Implementation Dispatch allows the `coder` agent to delegate specific tasks to fresh subagents. This preserves the main agent's context for coordination and ensures every task starts with a clean slate.

## 🚀 The Dispatch Workflow

### 2. Subagent Invocation (Ollama Optimized)
Use the `agent` tool with a focused prompt. Since Ollama loads one model at a time, we prioritize sequential execution to maintain performance.
- **Local Profile**: Reference `Artifacts/LOCAL_AGENT_PROFILES.json` to determine the instructions and paths for the subagent.
- **Role Assignment**: Explicitly instruct the subagent to "Assume the identity and instructions for the [Role] profile."
- **Environment**: If your environment supports it, ensure `AGENT_ROLE` is set to trigger role-aware context injection in `hooks/session-boot.js`.
- **Model Selection**: For Ollama, the model will be the same across all instances. Focus on role-based context rather than model switching.

### 3. Two-Stage Review (CRITICAL)
When the subagent returns, the main agent MUST perform two distinct reviews BEFORE integrating:

**Stage A: Spec Compliance (The "What")**
- Did the subagent implement exactly what was in the task?
- Did they miss any success metrics?
- Did they touch unauthorized files?

**Stage B: Technical Quality (The "How")**
- Does the code follow `rules/common/coding-style.md`?
- Are there any potential regressions or logic flaws?
- Is the error handling specific?

### 4. Integration & State Update
- Merge the changes.
- Update `Artifacts/TODO.md` to `[-]` (if verifying) or wait for the `auditor` to mark `[x]`.

## 📐 Dispatch Prompts (Local Agent OS)
Dispatch prompts must be identity-based to trigger the correct local context:
> "Assume the identity of the **[Role]** agent. 
> 1. Read your instructions from [Instructions Path].
> 2. Initialize your state by reading Artifacts/TODO.md.
> 3. Task: [Task Description]. 
> Constraints: Stay within [File Paths].
> Success Metric: [Metric from Plan].
> Output: Return a summary of changes and verification evidence."

## 🚫 Anti-Rationalization Table

| Excuse | Reality |
| :--- | :--- |
| "It's a small task, I'll just do it myself." | Small tasks add up to context bloat. If context > 70%, DISPATCH. |
| "Subagents are too slow." | Reviewing a subagent is 10x faster than debugging your own context-poisoned hallucinations. |
| "I'll review both stage A and B together." | You will miss details. Cognitive load is higher when mixing 'what' and 'how'. Separate them. |

## 🚩 Red Flags
- Subagents returning without command output verification.
- Subagents making "cleanup" changes in unrelated files.
- Main agent integrating code without reading it (skipping the two-stage review).
