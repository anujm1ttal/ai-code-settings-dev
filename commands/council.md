---
description: Launches a high-rigor multi-persona deliberation session. Owned by the council agent. Optimized for sequential local model processing.
argument-hint: "<topic>"
model: claude-opus-5
---

# Command: /council

**Target**: `$ARGUMENTS` → `<topic>` under deliberation.

Owned by the **council** agent (orchestrated by the concierge/strategist). The "Conflict Resolution Engine" — forces multiple perspectives on a single decision.

## Execution Sequence

1.  **Scope Definition**: Read `Artifacts/TODO.md` or `Artifacts/.agent/current_task.md` to identify the target decision.
2.  **Protocol Load**: Reference `Artifacts/COUNCIL_PROTOCOLS.md` for workflow rules. If the file does not exist, skip to the Default Fleet (below) and proceed without a custom protocol.
3.  **Member Setup**: 
    - Auto-select 3 roles based on task tags (e.g., `security`, `ux`, `performance`).
    - Default Fleet: `The Skeptic`, `The Maintainer`, `The Optimizer`.
4.  **Sequential Dispatch**:
    - For each member: Use `implementation-dispatch` to spawn a sub-agent.
    - Context: Provide only the specific proposal and the "Persona" system prompt.
5.  **Cross-Review (Deliberation)**:
    - Pass Member A's output to Member B for critique.
    - Pass critiques to the Synthesis Chair.
6.  **Synthesis**: The Chair (Strategist) merges all inputs into a **Consensus Report**.
7.  **Closure**: 
    - Update `Artifacts/IMPLEMENTATION_PLAN.md` with the outcome.
    - Add an entry to `Artifacts/DECISION_LOG.md` tagged `[COUNCIL]`.

## Member Profiles (Prompts)

| Role | Persona Directive |
|:---|:---|
| **The Skeptic** | "Your goal is to find why this change will fail or create technical debt. Be ruthless about edge cases and security." |
| **The Maintainer** | "Your goal is code clarity and documentation. If this isn't easy to explain to a junior dev, it's not ready." |
| **The Optimizer** | "Your goal is system efficiency. Look for redundant loops, heavy dependencies, or slow logic." |

## When to Use
Highly complex refactors, security-sensitive code, unresolved agent conflicts, or when the user asks: "Is this the best way to do this?".

## Outputs
- **Council Report**: A summary of consensus, minority objections, and final verdict.
- **Decision Log**: Permanent record of the council's reasoning.
