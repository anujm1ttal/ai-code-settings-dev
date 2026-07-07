---
description: Triggers the scribe to explain or teach a codebase. Supports depth selection and targeted Q&A. Invokes codebase-navigator skill.
argument-hint: "[--flow|--why|--find] [topic]"
allowed-tools: Read, Grep, Glob
model: claude-haiku-4-5
---

# Command: /explain

**Target**: `$ARGUMENTS` → mode flag (`--flow`/`--why`/`--find`) + optional `[topic]`.

Invokes the **scribe** agent in Explain mode. Scribe equips `codebase-navigator`.

## Modes

- **`/explain`** (default): High-level orientation — 10-second summary → module map → entry points.
- **`/explain [topic]`**: Targeted explanation — walk through a specific module, function, or flow.
- **`/explain --flow [action]`**: Trace a specific user action or event through the call chain (e.g., `/explain --flow "user submits form"`).
- **`/explain --why [topic]`**: Design decision rationale — why is it built this way, what were the tradeoffs.
- **`/explain --find [symbol]`**: Locate where something is defined and used.

## Execution Sequence

1. **Orient**: Identify entry point(s), stack, and one core concept that unlocks the rest.
2. **Tier 1**: Deliver 10-second summary. Pause — ask if user wants to go deeper.
3. **Tier 2+**: Module map → call chain → code spotlight, on demand.
4. **Offer next**: After each tier, ask what to drill into next.

## Output Standards (from `codebase-navigator`)

- Module map: ASCII diagram with file names and one-line purpose per node.
- Call chains: Step-by-step with `file:line` references and `①②③` annotations.
- Code spotlight: Relevant snippet with inline comments — never raw paste.
- Design decisions: Decision / Enables / Costs / Rejected alternatives.

## When to Use

- User asks "how does X work?" or "walk me through Y"
- User is unfamiliar with a codebase and needs orientation
- User needs to understand a design decision before making a change
- Onboarding a new contributor to a project

## Integration

- Run `/explain` before `/blueprint` when starting a new phase on an unfamiliar codebase.
- Run `/explain --why [topic]` before `/audit` if a design choice looks suspect.
- `/explain` does not modify files or Artifacts/TODO.md — read-only, no side effects.
