---
name: implementation-dispatch
description: Use when executing a roadmap with 3+ independent tasks or when context length is at 70%+. Orchestrates subagents for task execution.
---

# Skill: Implementation Dispatch

## 🛸 Overview
Implementation Dispatch allows the `coder` agent to delegate specific tasks to fresh subagents. This preserves the main agent's context for coordination and ensures every task starts with a clean slate.

## 🚀 The Dispatch Workflow

### 1. Task Packaging
For the selected task from `Artifacts/TODO.md`, construct a `dispatch` package:
- **Scope**: List only the files the subagent is authorized to modify.
- **Context**: Provide the `Artifacts/IMPLEMENTATION_PLAN.md` segment relevant to the task.
- **Skills**: Explicitly state which Antigravity skills (e.g., `python-rhino`) the subagent must load.
- **Constraint**: "Do not change code outside the authorized scope."

### 2. Subagent Invocation
Use the `browser_subagent` or a direct `Task` invocation with a focused prompt.
- **Model Selection**: 
    - Use highly capable models (e.g., Gemini 1.5 Pro, Claude Opus) for architectural tasks.
    - Use faster models (e.g., Gemini 1.5 Flash, Claude Haiku) for mechanical refactors or unit tests.

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

## 📐 Dispatch Prompts
Dispatch prompts must be role-play based:
> "You are an Antigravity Agent specialized in [Domain]. Your task is to [Task Description]. 
> Constraints: Follow [Skill Name] strictly. Stay within [File Paths].
> Success Metric: [Metric from Plan].
> Output: Return a summary of changes and the fresh command output showing verification."

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
