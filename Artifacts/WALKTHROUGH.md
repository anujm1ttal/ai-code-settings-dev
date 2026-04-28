# Walkthrough: Matt Pocock Skills Integration

I have systematically integrated high-rigor architectural and interaction patterns from Matt Pocock's skills into your "Agent OS."

## Changes Made

### 1. Architectural Hardening
- **New Rule**: [architecture.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/architecture.md) defines **Deep vs. Shallow** modules and the **Deletion Test**.
- **Standards Update**: [standards.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/standards.md) now references these principles and emphasizes "Locality over Extraction."

### 2. Interactive "Grilling" & Triage
- **New Commands**: Added `/grill` (stress-testing plans) and `/triage` (root-cause analysis) to [orchestration.md](file:///c:/Users/44547/source/repos/ai-code-settings/rules/common/orchestration.md).
- **Task Lifecycle**: The `/blueprint` workflow now includes an optional **Grilling Phase** for complex projects to ensure shared understanding before implementation.

### 3. Domain Model Persistence
- **New Skill**: [glossary-extraction](file:///c:/Users/44547/source/repos/ai-code-settings/skills/glossary-extraction/SKILL.md) automates the creation of a Domain Glossary in `Artifacts/GLOSSARY.md`, following DDD "Ubiquitous Language" principles.

### 4. Development Rigor
- **TDD Mode**: [systematic-debugging](file:///c:/Users/44547/source/repos/ai-code-settings/skills/systematic-debugging/SKILL.md) now enforces a **High-Rigor TDD Loop** (Red-Green-Refactor) for bug fixes and complex features.

## Verification

- **Command Routing**: Verified that `/grill` and `/triage` are correctly mapped to agents in the Fleet table.
- **Skill Availability**: Ensured `glossary-extraction` is auto-activated for all major project types.
- **Mental Models**: Architecture definitions are centralized and referenced in the global standards.

Your Agent OS is now significantly more robust and better equipped to handle complex, domain-heavy projects with high technical leverage.
