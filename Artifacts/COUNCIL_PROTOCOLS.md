---
name: council-protocols
description: Canonical definitions for the Sequential Council deliberation pattern.
---

# Council Protocols: Sequential Deliberation

The **Council Pattern** is a high-rigor deliberation process used to resolve complexity, reduce hallucinations, and validate critical architectural or security decisions. 

In this local setup (Qwen 3.5 single-model), the "Council" is executed **sequentially** through role-based sub-agents.

## ⚖️ The Sequential Workflow

### 1. The Trigger
The Council is triggered manually via `/council` or automatically by the `strategist` if:
- A task touches >5 files or architectural "load-bearing" code.
- A security-critical change is proposed (auth, secrets, network).
- Two agents (e.g., Coder and Auditor) reach a stalemate.

### 2. Member Selection
The `concierge` or `strategist` selects 3 distinct "Council Members" (personas) from the agent fleet or specialized definitions:
- **The Skeptic**: Tasked with finding reasons the proposal will fail.
- **The Maintainer**: Focuses on long-term readability, docs, and style.
- **The Optimizer**: Focuses on runtime performance and logic edge cases.

### 3. Phase A: Divergence (Sequential Generation)
Each member is dispatched via `implementation-dispatch` with the *same* core proposal but a persona-specific goal.
- Output: 3 independent "Position Papers".

### 4. Phase B: Deliberation (Cross-Critique)
Each Position Paper is fed into the *other* members. 
- *Example*: The Skeptic critiquing the Optimizer's "speed over safety" approach.

### 5. Phase C: Synthesis (The Chairman)
The `strategist` (acting as Chairman) reads all positions and critiques to produce a **Consensus Report**. 
- The consensus is merged into `Artifacts/IMPLEMENTATION_PLAN.md` or used to mark `[x]` in `Artifacts/TODO.md`.

## 🚩 Council Membership Matrix

| Role | Primary Objective | Key Questions |
|:---|:---|:---|
| **Skeptic** | Risk Mitigation | "What breaks if this fails?", "Is this a security hole?" |
| **Maintainer** | Sustainability | "Will I understand this in 6 months?", "Are docs stale?" |
| **Optimizer** | Efficiency | "Is there a O(1) version?", "Are we over-engineering?" |
| **Creative-Director** | Visual/UX | "Is this accessible?", "Does it follow the layout spec?" |

## ⚡ Local Optimization (Qwen 3.5)
To prevent context-window blowup during long council sessions:
1. **Summarization**: Each member MUST return a "Snapshot Summary" (<100 tokens).
2. **Context Clearance**: Sub-agents must not inherit the *full* chat history, only the specific task context and the previous council outputs.
