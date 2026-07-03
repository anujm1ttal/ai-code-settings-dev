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
| **Singleton Skills Count** | 12 | Phase 9 analysis | youtube (3), pptx (1), pbi (1), code-mcp (2), geometry (4), manuscript (1) |
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

### Phase 11: Optional Plugin System (IN PROGRESS / APPROVED)
- Move 12 singletons to `optional_plugins/`
- Implement lazy-loading via manifest V2 schema
- Reduce bootstrap overhead 15–25%
- **Timeline**: Weeks 33–35 (Jul 21 – Aug 10)
- **Delivery**: `v11.0.0-plugin-system` tag
- **Blocking on**: User approval of Phase 11 plan

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

## 📊 Skill Audit History

| Phase | Focus | Status | Link |
|:---|:---|:---|:---|
| Phase 1–4 | Structural audit & remediation | ✓ COMPLETE | `Artifacts/SKILL_AUDIT_REPORT.md` |
| Phase 9 | Dependency graph analysis | ✓ COMPLETE | `Artifacts/Temp/` (archived) |
| Phase 11 | Plugin system design & rollout | ⏳ IN PROGRESS | `Artifacts/PHASE_11_PLUGIN_SYSTEM.md` |

---

## 🔗 Cross-References

- **Routing & Orchestration**: `rules/common/orchestration.md`
- **Coding Standards**: `rules/common/coding-style.md`
- **Token Economics**: `rules/common/TOKEN-ECONOMICS.md`
- **Project Type Defaults**: `CLAUDE.md` § Project Type Routing
- **Skill Registry**: `skills/skills.overview.md`
- **Plugin System**: `optional_plugins/index.md` (after Phase 11.1)

---

**Last Updated**: 2026-07-03
**Next Review**: After Phase 11 completion (estimated 2026-08-10)
