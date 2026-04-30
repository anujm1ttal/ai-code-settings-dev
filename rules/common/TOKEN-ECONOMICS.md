# Token Economics & Context Architecture

This document defines the strategies for maximizing token ROI and managing context pressure within the Agent OS.

## 📐 Context Architecture (L0/L1/L2)

To minimize bootstrap costs, the system uses a tiered loading strategy:

| Layer | token Estimate | Purpose |
|:---|:---|:---|
| **L1 (Overview)** | ~2,000 | High-level map of all agents/skills. Load first to route. |
| **L0 (Abstract)** | ~100–300 | Functional summary of a single agent/skill. Load to confirm fit. |
| **L2 (Definition)**| ~3,000–8,000| Full instruction set. Load ONLY when executing. |

**Mandatory Query Flow**: L1 (Overview) → L0 (Abstract) → L2 (Full Definition).

---

## 💰 Token Budgeting

### Bootstrap Costs (Estimated)

- **Standard Load** (All Rules + L1 Overviews): ~15,000 tokens.
- **Deep Load** (Standard + 2 Active L2 Skills): ~25,000 tokens.
- **Legacy Load** (Pre-Layering): ~50,000+ tokens.

### Slicing Thresholds

When planning large projects, the Strategist must slice the roadmap to prevent context window saturation:

| Metric | Threshold | Action |
|:---|:---|:---|
| **Task Count** | 15+ tasks | Split into 2 Slices (Phases 1-2 vs 3-4) |
| **Wave Count** | 8+ waves | Insert a Hard Gate for context reset |
| **Complexity** | 200+ points | Mandatory slicing |

---

## 🚦 Context Pressure Management

### Handoff Triggers

The Concierge monitors context usage and triggers `/handoff` when:
1. **Saturation**: Conversation exceeds **60%** of the available context window.
2. **Phase Completion**: A major phase is marked `[x]` by the auditor.
3. **Drift**: Multiple pivots or complex debugging sessions have created "noise."

### The "Finding" Protocol (Inter-Phase Knowledge)

To ensure knowledge survives a context reset (`/handoff`), agents must produce **Findings**:
- **Findings** are ephemeral `Artifacts/findings.md` files created at the end of a task or phase.
- They document specific technical discoveries, variable names, or logic traps for the next agent.
- During `/sync`, the Concierge promotes critical Findings to permanent **Learnings**.

---

## 🚫 Anti-Patterns

- **Eager Loading**: Loading a full skill file before verifying its relevance via Abstract.
- **Context Hoarding**: Refusing to `/handoff` when saturation is high, leading to "hallucinated" state.
- **Silent Reset**: Ending a session without capturing Findings or updating the DECISION_LOG.
