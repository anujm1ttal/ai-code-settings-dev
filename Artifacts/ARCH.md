# ARCH - Agent OS Architecture

Canonical architecture for the Gemini/Claude Agent OS, optimizing for high-rigor computational design, data modeling, and code execution.

## 🏗 The Stack

1. **Governance Layer**: `rules/common/orchestration.md` + `GEMINI.md`. Defines authority, routing, and task lifecycle.
2. **Execution Layer**: `agents/*.md`. Persona-driven agents with specialized tools and restricted write-authority.
3. **Intelligence Layer**: `skills/*/SKILL.md`. Domain-specific expertise loaded on-demand per project type.
4. **State Layer**: `Artifacts/`. The persistent source of truth.

## 📡 Command & Skill Flow

```mermaid
graph TD
    User([User Request]) --> Concierge[concierge]
    Concierge --> |Route| Strategist[strategist]
    Strategist --> |Blueprint| Plan[IMPLEMENTATION_PLAN.md]
    Strategist --> |Task| TODO[TODO.md]
    
    Plan --> Coder[coder]
    TODO --> Coder
    
    Coder --> |Implement| Files[Source Files]
    Coder --> |Dispatch| SubAgent[Sub-Agents]
    
    Files --> Auditor[auditor]
    Auditor --> |Audit| Pass{Pass?}
    Pass --> |Yes| Complete[TODO.md [x]]
    Pass --> |No| Coder
    
    Complete --> Scribe[scribe]
    Scribe --> |Docs| Documentation[README/Docs]
```

## 🗂 Artifact Hierarchy

The `Artifacts/` directory is the **Primary Source of Truth**. Agents must never rely solely on chat context.

| Category | File | Owner | Description |
|:---|:---|:---|:---|
| **Identity** | `LOCAL_AGENT_PROFILES.json` | Strategist | Role/instruction mapping for sub-agents. |
| **Strategy** | `IMPLEMENTATION_PLAN.md` | Strategist | The "How & Why": Technical design and rationale. |
| **Execution** | `TODO.md` | Strategist | The "Who & When": Task status and agent assignment. |
| **Logic** | `COUNCIL_PROTOCOLS.md` | Strategist | Deliberation rules for high-rigor decisions. |
| **Memory** | `LEARNINGS.md` | Concierge | Project-specific knowledge and corrections. |
| **Audit** | `DECISION_LOG.md` | Concierge | Tracking of architectural pivots and council outcomes. |
| **Visual** | `LAYOUT_SPEC.md` | Creative Dir | UI/Composition standards (for PPTX/PBI). |

## 🛡 Security Boundaries

- **Write Authority**: Coder marks `[-]`, Auditor marks `[x]`. Strategist owns Plan/TODO structure.
- **Path Traversal**: Tools are scoped to the project root.
- **Secret Handling**: Mandatory `.env` exclusion and secret-scanning during `/audit`.
- **Slop-Scan**: Systematic detection of AI artifacts (placeholder comments, redundant awaits) during audit.

## 🔄 Lifecycle: The "Loop of Rigor"

1. **Step 0**: Strategist validates "Right to Exist" and "Minimalism."
2. **Search-Before-Building**: Coder verifies runtime built-ins before reinventing.
3. **RED-GREEN-REFACTOR**: Mandatory failing test before implementation.
4. **Verification Gate**: Evidence (command output) required for ALL completion claims.
5. **Two-Stage Review**: Spec Compliance → Technical Quality.
6. **Handoff**: Context compression and learning capture.
