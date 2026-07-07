# Token Economics & Context Architecture

This document defines the strategies for maximizing token ROI and managing context pressure within the Agent OS.

## 📐 Context Architecture (L0/L1/L2)

To minimize bootstrap costs, the system uses a tiered loading strategy:

| Layer | Token Estimate | Purpose |
|:---|:---|:---|
| **L1 (Overview)** | ~2,000 | High-level map of all agents/skills. Load first to route. |
| **L0 (Abstract)** | ~100–300 | Functional summary of a single agent/skill. Load to confirm fit. |
| **L2 (Definition)**| ~3,000–8,000| Full instruction set. Load ONLY when executing. |

**Mandatory Query Flow**: L1 (Overview) → L0 (Abstract) → L2 (Full Definition).

**L0 Abstract threshold**: An L0 abstract is mandatory only for skills whose `SKILL.md` exceeds 150 lines. Skills at or under 150 lines skip L0 — the L1 overview entry plus the file itself is cheap enough to load directly.

---

## 💰 Token Budgeting

Standard bootstrap load (all rules + L1 overviews): ~15,000 tokens (referenced by
`claude-md-standards.md` §3 as the budget a CLAUDE.md is one line item within).

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

To ensure knowledge survives a context reset, agents file **Findings** to `Artifacts/BACKLOG.md`
(the single home for deferred work and findings — see `orchestration.md` §Findings Protocol):
- They document specific technical discoveries, variable names, or logic traps for the next agent.
- During `/handoff`, the Concierge promotes persistent findings to the `Artifacts/learnings/` registry.

---

## 🚫 Anti-Patterns

- **Eager Loading**: Loading a full skill file before verifying its relevance via Abstract.
- **Context Hoarding**: Refusing to `/handoff` when saturation is high, leading to "hallucinated" state.
- **Silent Reset**: Ending a session without capturing Findings or updating the DECISION_LOG.
