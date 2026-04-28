# Council Protocols

Deliberation rules and reporting templates for high-rigor architectural decisions.

## ⚖️ Deliberation Framework
1. **Persona Rotation**: Every Council session MUST represent at least three distinct viewpoints (Optimist, Skeptic, Architect).
2. **Evidence Threshold**: Decisions cannot be made on "intuition." Every claim must be backed by code references or specific rule citations.
3. **Conflict Resolution**: If the Council cannot reach consensus, the Strategist's architectural decision stands, but the Auditor's dissenting opinion must be logged as a "High Priority Risk."

## 📝 Reporting Template (`/council`)

### 1. The Dispute / Decision Point
*What is the core architectural conflict or high-stakes pivot being reviewed?*

### 2. Persona Perspectives
- **The Optimist (Coder)**: [Argument for speed/implementation]
- **The Skeptic (Auditor)**: [Argument for safety/quality]
- **The Architect (Strategist)**: [Argument for alignment/long-term]

### 3. Factual Evidence
- **Ref 1**: `path/to/file:L123`
- **Ref 2**: `rules/common/security.md`

### 4. Resolution (GO / NO-GO)
**Decision**: [Clear outcome]
**Rationale**: [Synthesis of evidence and perspectives]

### 5. Action Items
- [ ] Task 1 (Assigned to Coder)
- [ ] Task 2 (Assigned to Auditor)

*Log this resolution in `Artifacts/DECISION_LOG.md` immediately.*
