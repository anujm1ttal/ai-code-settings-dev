# Implementation Plan: LLM Council Pattern

This plan introduces the **LLM Council** pattern to the Agent OS. Since the system uses a single local model (Qwen 3.5), the "Council" is implemented as a **Sequential Deliberation** process where specialized sub-agents with different personas (Security, Performance, Architecture) force a high-rigor review of critical tasks.

## User Review Required

> [!IMPORTANT]
> **Latency Trade-off**: Running a Council involves spawning 3+ sequential sub-agents. This will significantly increase the time for a single "Step", but will drastically reduce hallucinations and architectural oversights.

> [!NOTE]
> **Qwen 3.5 Optimization**: The Council relies on "Persona-based Context" (System Prompts) rather than "Model Diversity". We will define standard Council Roles to ensure Qwen provides truly diverse feedback.

## Proposed Changes

### 1. Protocols & Standards

#### [NEW] [COUNCIL_PROTOCOLS.md](file:///c:/Users/44547/source/repos/ai-code-settings/Artifacts/COUNCIL_PROTOCOLS.md)
Define the canonical "Sequential Council" workflow for the Agent OS.
- **Triggers**: Security-critical paths, breaking API changes, complex refactors (>5 files), or Architect/Strategist stalemated decisions.
- **Workflow**: Divergence (3 roles) → Deliberation (Cross-critique) → Synthesis (Chair).
- **Standard Roles**: `The Skeptic` (Security/Regressions), `The Maintainer` (Docs/Style), `The Optimizer` (Logic/Performance).

### 2. Commands Layer

#### [NEW] [council.md](file:///c:/Users/44547/source/repos/ai-code-settings/commands/council.md)
Add the `/council` command to the global registry.
- **Owner**: Concierge.
- **Structure**: 
  - Phase 1: Member Selection (based on task tags).
  - Phase 2: Sequential Dispatch (using `implementation-dispatch`).
  - Phase 3: Synthesis Report.

#### [MODIFY] [orchestration.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/orchestration.md)
- Register `/council` under the **concierge** and **strategist**.
- Add "Council Deliberation" as an optional gate in the Task Lifecycle.

### 3. Skills Layer

#### [MODIFY] [SKILL.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/implementation-dispatch/SKILL.md)
- Add the `Council Dispatch` protocol.
- Update the "Two-Stage Review" to support "Council Review" mode (dispatching 2+ reviewers instead of 1).

## Verification Plan

### Automated Tests
- N/A (Standard/Command updates are validated through manual dry-runs).

### Manual Verification
1. **Command Registration**: Run `/council --help` (or simulate logic) to ensure the Concierge recognizes the new pattern.
2. **Protocol Validation**: Verify `Artifacts/COUNCIL_PROTOCOLS.md` is correctly referenced by the `strategist` during a mock high-rigor planning phase.
3. **Dispatch Flow**: Simulate a `coder` using Council Review for a mock security patch.
