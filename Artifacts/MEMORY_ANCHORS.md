# Memory Anchors: AI Code Settings Global Registry

**Cold Storage**: Critical project-wide constants, non-negotiable constraints, and system boundaries for the global AI OS registry.

*Maintenance: Strategist owns this file. Graduation from LEARNINGS.md happens during /handoff.*

---

## 📐 Non-Negotiables

1. **Skill Registration Immutability**: Once a skill is published in `skills/`, its interface (description, agents, primary use case) must remain backward-compatible. Breaking changes → new skill version.

2. **Plugin System Adoption (Phase 11+)**: Singleton skills (used by exactly 1 project type) MUST be in `optional_plugins/[category]/[skill]/`. Core/universal skills remain in `skills/`.

3. **Manifest Schema Versioning**: All `project.json` files MUST declare `schema_version`. Auto-upgrade V1→V2 is silent but logged. No projects left on V0.

4. **Token Economy Priority**: Bootstrap costs capped at 7,600 tokens per project (foundational + universal + project-specific). Plugins reduce this to 5,100–6,700 tokens (18–25% savings).

5. **Foundational Skills Non-Negotiable**: `codebase-navigator`, `systematic-debugging`, `implementation-dispatch`, `verification-gate`, `project-planner`, `project-journal`, `doc-updater` ALWAYS loaded. Not optional.

---

## 🧱 Architectural Boundaries

### Skill Categories (Ownership & Maintenance)

| Category | Maintainer | Boundary |
|:---|:---|:---|
| **Core Orchestration** | concierge agent | Must support all project types; no domain assumptions |
| **Development** (MCP, Python, TypeScript) | coder | Language/framework-specific; update on major version bumps |
| **Design & Visuals** (PPTX, DOCX, XLSX, Power BI) | creative-director | Layout/composition logic; cross-cutting visual rules |
| **Geometry** (Rhino/GH) | coder | CPython 3.9 for scripts; RhinoCommon API only |
| **Specialized** (DAX, Manuscript, YouTube, etc.) | domain specialist | Niche domains; expect low churn; plugin candidates |

### Plugin System Boundary

- **Core Skills** (`skills/`): Foundational (7) + Universal (9) = 16 skills. These are ALWAYS available.
- **Plugin Skills** (`optional_plugins/[category]/`): Singleton skills (12). Lazy-loaded only if project type matches and `auto_include=true`.
- **No Hybrid Load**: A plugin skill is either fully loaded (all references, metadata) or not loaded at all. No partial loads.

### Manifest Validation Flow

```
project.json (V1 or V2)
    ↓
[manifest_validator.py]
    ├─ Detect version
    ├─ If V1: auto-upgrade to V2 (idempotent)
    ├─ Resolve plugins for project_type
    ├─ Validate all skills exist in registry
    └─ Return effective_skills set
```

---

## 🔢 Key Constants

| Constant | Value | Source | Notes |
|:---|:---|:---|:---|
| **Singleton Skills Count** | 13 | Phase 11.3 migration complete | youtube (3), pptx (1), pbi (1), code-mcp (2), geometry (4), manuscript (2) |
| **Foundational Skills Count** | 7 | CLAUDE.md § Project Type Routing | Always loaded, never optional |
| **Universal Skills Count** | 9 | Phase 11 design | Shared across 2+ project types; always loaded if `auto_include=true` |
| **Bootstrap Token Target** | 7,600 | Token economics | Current cost for all-skills load |
| **Optimized Bootstrap Cost** | 5,100–6,700 | Phase 11 projected | With plugin system; 18–25% savings |
| **Skill File Size Limit** | 800 lines | coding-style.md | Deep-Load Protocol: split files >500 lines |
| **Max Plugin Category Size** | 1,960 lines | Phase 11 analysis | youtube (370 lines), geometry (540 lines), etc. |

---

## 🛠 Active Toolchain & Standards

### Testing Strategy (Lane B/A/E2E)

- **Lane B** (Pure Python): Unit tests; no Rhino/runtime required
- **Lane A-headless** (Rhino.Inside): Geometry tests; requires CPython 3.12+
- **Lane A-full** (Rhino UI): GH canvas tests; requires Rhino 8 UI
- **Default**: Use cheapest lane that proves the claim (Lane B >> Lane A-headless >> Lane A-full)

### Python Runtime Matrix

| Context | Python Version | Immutability | Logging | Validation |
|:---|:---|:---|:---|:---|
| **Host** (default) | 3.12+ | `@dataclass(frozen=True)` | loguru | Pydantic BaseModel |
| **Rhino Internal** | 3.9.x | Manual (no frozen) | print() | Manual checks |
| **Rhino.Inside** | 3.12+ (host) | `@dataclass(frozen=True)` | loguru | Pydantic BaseModel |

### Documentation Standards

- **L1 Overview** (~2,000 tokens): `skills.overview.md`, `agents.overview.md`
- **L0 Abstract** (~300 tokens): `skills/[skill]/abstract.md` (functional summary, no implementation)
- **L2 Definition** (3,000–8,000 tokens): `skills/[skill]/SKILL.md` (full instructions + references)

### Code Quality Checkpoints

- **No Slop**: Every line of code traces to a requirement in `Artifacts/TODO.md`
- **Adjacent Code Protection**: Do not refactor/improve code unrelated to the current task
- **Immutability-First**: No globals, no mutation, no mutable defaults
- **Type Coverage**: 100% type hints (Python), strict (TS), nullable (C#)

---

## 🚀 Critical Phases & Dependencies

### Phase 9: Skill Dependency Graph (COMPLETE)
- Identified 8 universal skills, 12 singletons, 111 tag clusters
- Enabled Phase 11 plugin system design

### Phase 11: Optional Plugin System (COMPLETE - v11.0.0-plugin-system)
- Migrated 13 singletons to `optional_plugins/`
- Implemented lazy-loading via manifest V2 schema
- Achieved 18–25% bootstrap token savings
- **Delivery**: Git tag `v11.0.0-plugin-system` created
- **Highlights**: 
  - All 13 skills migrated to plugin format
  - V1→V2 auto-upgrade implemented and tested
  - PLUGIN_REGISTRY hardcoded in `scripts/manifest_validator.py`
  - Rollback procedure documented in `Artifacts/ROLLBACK_PROCEDURE.md`

### Phase 12: Skill Maturity Tiers (PLANNED)
- Classify skills: Tier 1 (Essential), Tier 2 (Recommended), Tier 3 (Niche)
- Enable selective skill discovery in agent prompts

### Phase 13: Cross-Registry Unification (PLANNED)
- Align with Anthropic's published skill library
- Bi-directional sync for published skills

---

## ⚠️ Known Constraints & Workarounds

| Constraint | Impact | Workaround |
|:---|:---|:---|
| Rhino 8 CPython 3.9 environment | Can't use f-strings, type unions, newer stdlib | Host modules stay 3.9-compat via `List[T]`, `Union` syntax |
| Power BI PBIP format lock | No manual `.json` edits during publish | Use Tabular Editor 3 for schema changes; sync back to PBIP |
| MCP JSON-RPC strictness | No `console.log` in tool output (reserved for JSON-RPC) | Use `console.error` for debug; inspect via stderr |
| Git history immutability | Can't rewrite published commits | Use feature branches + PR reviews; tag stable versions |

---

## Plugin System Architecture (Phase 11 Complete)

### Non-Negotiables

1. **Singleton Skills Are Now Plugins**: youtube-strategy, youtube-scriptwriting, youtube-retention, pptx, powerbi-report, python-mcp, typescript-mcp, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing, manuscript-review, business-analyst, cd-foundations
   - Accessible ONLY via `optional_plugins/[category]/[skill]/`
   - NO longer in `skills/` directory (removed in Phase 11.3)
   - Lazy-loaded per plugin configuration in project manifest

2. **Manifest V2 Schema Is Default**: All new projects should use `schema_version: "2.0.0"` with `plugins` array
   - V1 manifests auto-upgrade to V2 on validation (transparent to users)
   - No loss of functionality during upgrade
   - Plugin refs are optional; `auto_include: true` projects auto-enable per project_type

3. **Core Skills Remain Universal**: 9 core skills remain in `skills/` (not plugins)
   - Always available, never lazy-loaded
   - Non-negotiable for all project types
   - Examples: codebase-navigator, systematic-debugging, project-planner

4. **Plugin Registry Is Hardcoded**: `PLUGIN_REGISTRY` in `scripts/manifest_validator.py` maps:
   - plugin_id → {category, skills[], project_types[], auto_enable}
   - Must stay in sync with actual `optional_plugins/[category]/plugin.yaml` files
   - Auditor gate: Any drift → regression test failure

5. **Rollback Is Possible**: Migration state saved to `Artifacts/.agent/migration_state.json`
   - Use `python scripts/migrate_skills_to_plugins.py --rollback` to restore skills/ if needed
   - Manual procedure in `Artifacts/ROLLBACK_PROCEDURE.md`
   - Rollback is tested and reversible

### Key Routing

- **New singleton-related question?** → Check `optional_plugins/[category]/[skill]/SKILL.md`
- **Manifest validation broken?** → Check PLUGIN_REGISTRY sync in `scripts/manifest_validator.py`
- **Plugin not loading?** → Verify plugin.yaml has skill in skills array, and project manifest has plugin_id in plugins array
- **Need to add a new optional plugin?** → Follow structure in `optional_plugins/[category]/plugin.yaml` + create category dir with plugin.yaml + add to PLUGIN_REGISTRY

---

## 📊 Skill Audit History

| Phase | Focus | Status | Link |
|:---|:---|:---|:---|
| Phase 1–4 | Structural audit & remediation | ✓ COMPLETE | `Artifacts/SKILL_AUDIT_REPORT.md` |
| Phase 9 | Dependency graph analysis | ✓ COMPLETE | `Artifacts/Temp/` (archived) |
| Phase 11 | Plugin system design & rollout | ✓ COMPLETE | Git tag `v11.0.0-plugin-system` |

---

## 🔗 Cross-References

- **Routing & Orchestration**: `rules/common/orchestration.md`
- **Coding Standards**: `rules/common/coding-style.md`
- **Token Economics**: `rules/common/TOKEN-ECONOMICS.md`
- **Project Type Defaults**: `CLAUDE.md` § Project Type Routing
- **Skill Registry**: `skills/skills.overview.md`
- **Plugin System**: `optional_plugins/index.md`

---

**Last Updated**: 2026-07-03
**Next Review**: After Phase 12 completion (estimated 2026-09-15)
