# Walkthrough: Agent OS Hardening (Superpowers × gstack)

We have completed the systematic integration of high-rigor patterns from `superpowers` (obra) and `gstack` (garrytan) into the Antigravity Agent OS. This update transforms the setup from a coordination layer into a self-verifying, high-rigor execution environment.

## 🏁 Hardening Checklist (All Items [x])

| Item | Improvement | Impact |
|:---|:---|:---|
| 1 | **Verification Gate** | "Iron Law" (evidence-before-claims) enforced via new skill. |
| 2 | **CSO Description Fixes** | Removed workflow summaries from 9 skills to prevent agent shortcutting. |
| 3 | **Search Before Building** | Coder agent now mandatorily searches for runtime built-ins/best practices. |
| 4 | **AI Effort Compression** | Strategist uses "Boil the Lake" metrics to prevent over-minimalism. |
| 5 | **Subagent Templates** | Standardized `implementer-prompt.md` and `reviewer-prompt.md` in `implementation-dispatch`. |
| 6 | **Skill Pressure Testing** | Auditor mandates RED-GREEN-REFACTOR evidence for all skill changes. |
| 7 | **Slop Detection** | `/audit` now scans for empty catches, redundant awaits, and dead code. |
| 8 | **Session Boot Protocol** | Concierge automatically recovers state, surfaces recent learnings, and checks for drift. |
| 9 | **Hard-Gate Step 0** | Orchestration rules explicitly block implementation until Step 0 is complete/approved. |
| 10 | **Skill Drift Validation** | Audit command now verifies registry integrity (GEMINI.md ↔ skills dir). |

## 🛡️ Key New Protocols

### 1. The Verification Gate (`skills/verification-gate/`)
Agents are now forbidden from claiming "Tests pass" or "Bug fixed" unless the command output is visible in the SAME message. This eliminates "hallucinated success."

### 2. Two-Stage Review (`skills/implementation-dispatch/`)
Subagent delegation now follows a strict sequence:
- **Stage A (Spec Compliance)**: Did it do exactly what was asked? (No missing/extra items).
- **Stage B (Quality)**: Does it follow standards? (No slop).
Stage A MUST pass before Stage B is even considered.

### 3. LLM Council (`commands/council.md`)
The `/council` command allows the Concierge to trigger sequential deliberation between three personas: **The Skeptic**, **The Maintainer**, and **The Optimizer**. This forces the system to find its own blind spots before bothering the user.

## 🛠 Files Created/Modified

### New Components
- [SKILL.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/verification-gate/SKILL.md) — The "Iron Law" of verification.
- [implementer-prompt.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/implementation-dispatch/implementer-prompt.md) — Standardized subagent instructions.
- [reviewer-prompt.md](file:///c:/Users/44547/source/repos/ai-code-settings/skills/implementation-dispatch/reviewer-prompt.md) — Two-stage review protocol.

### Hardened Agents
- [coder.md](file:///c:/Users/44547/source/repos/ai-code-settings/agents/coder.md) — Added Search-Before-Building and Verification Gate.
- [strategist.md](file:///c:/Users/44547/source/repos/ai-code-settings/agents/strategist.md) — Added Effort Compression (Lake vs. Ocean).
- [auditor.md](file:///c:/Users/44547/source/repos/ai-code-settings/agents/auditor.md) — Added Pressure Testing mandate for skills.
- [concierge.md](file:///c:/Users/44547/source/repos/ai-code-settings/agents/concierge.md) — Added Session Boot Protocol.

## 🚀 Next Steps

1. **Pressure Test**: Run `/audit` on a simple task to see the new slop-scan and registry consistency checks in action.
2. **Dispatch Trial**: Use `/council` on your next major architectural decision to witness the sequential deliberation flow.
3. **Iron Law Compliance**: Observe the coder now providing command output for every "complete" claim.

---
*Status: HARDENING COMPLETE*
