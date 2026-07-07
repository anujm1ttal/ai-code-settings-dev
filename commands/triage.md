---
description: Systematic investigation and fix planning for bugs or test failures prior to implementation.
argument-hint: "<bug-description>"
model: claude-sonnet-5
---

# Command: /triage

**Target**: `$ARGUMENTS` → `<bug-description>`.

**Owner**: coder
**Purpose**: Systematic investigation and fix planning for bugs or test failures.

## Objective
To identify the root cause of a failure and propose a surgical fix that adheres to architectural standards before touching any source code.

## Entry Criteria
- A bug report, test failure, or unexpected behavior is identified.
- The `coder` has been assigned the triage task.

## The Procedure

### 1. Reproduce
- Write a minimal failing test case in the `tests/` directory.
- Confirm the failure with the exact command output.

### 2. Isolate
- Use `systematic-debugging` to narrow down the failure to a specific module or function.
- Check recent changes in `git` or `DECISION_LOG.md`.

### 3. Analyze
- Identify if the failure is a logic error, a dialect friction issue (e.g., Python 3.9 vs 3.12), or a geometric edge case.
- Determine if the fix requires a plan change or just a local implementation adjustment.

### 4. Propose
- Present the "Root Cause Analysis" (RCA).
- Propose the fix as a diff or a set of atomic tasks in `Artifacts/TODO.md`.

## Rules
- **No Guessing**: Every hypothesis must be verified with a test or a log trace.
- **Minimalism**: The fix should be the smallest possible change that solves the root cause.
- **Audit Requirement**: High-severity bugs must be reviewed via `/audit` after the fix is implemented.

## Relationships
- **Debugging**: Uses the `systematic-debugging` skill.
- **Verification**: Depends on `verification-gate` to confirm the fix.
