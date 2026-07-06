# Memory Anchors: AI Code Settings Global Registry

**Cold Storage**: Critical project-wide constants, non-negotiable constraints, and system boundaries for the global AI OS registry.

*Maintenance: Strategist owns this file. Graduation from LEARNINGS.md happens during /handoff.*

---

## 📐 Non-Negotiables

1. **Skill Registration Immutability**: Once a skill is published in `skills/`, its interface (description, agents, primary use case) must remain backward-compatible. Breaking changes → new skill version.

2. **Plugin System Adoption (Phase 11+)**: Singleton skills (used by exactly 1 project type) MUST be in `optional_plugins/[category]/[skill]/`. Core/universal skills remain in `skills/`.

3. **Native Plugin Registry**: `.claude-plugin/marketplace.json` (repo root) is the single source of truth for the 7 optional plugins (`code-mcp`, `geometry`, `manuscript`, `ms-office`, `pbi-report`, `visual-storytelling`, `youtube`). Each plugin ships its own `optional_plugins/<name>/.claude-plugin/plugin.json`. No schema versioning layer exists — plugins are installed/enabled natively via Claude Code's plugin system.

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
- **Plugin Skills** (`optional_plugins/<name>/skills/<skill>/`): 17 skills across 7 native plugins. Surfaced only when the plugin is installed AND enabled for the project.
- **No Hybrid Load**: A plugin's skills are either fully available (plugin installed + enabled) or not visible at all. No partial loads.

### Native Plugin Load Flow

```
.claude-plugin/marketplace.json (repo root)
    ↓ lists 7 plugins: code-mcp, geometry, manuscript,
    ↓   ms-office, pbi-report, visual-storytelling, youtube
optional_plugins/<name>/.claude-plugin/plugin.json
    ↓ (per-plugin manifest: name, description, author)
/plugin marketplace add <repo>  →  /plugin install <name>@ai-code-settings
    ↓
.claude/settings.json → "enabledPlugins": { "<name>@ai-code-settings": true }
    ↓ (the real loader gate — no project.json/auto_include involved)
Plugin's skills/<skill>/ surfaced to the agent
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
- **Lane A-live** (`rhinocode` CLI): Scriptable probes against a running Rhino instance; requires Rhino 8.11+ and `StartScriptServer`
- **Lane A-full** (Rhino UI): Interactive/manual tests; requires Rhino 8 UI
- **Default**: Use cheapest lane that proves the claim (Lane B >> Lane A-headless >> Lane A-live >> Lane A-full)

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

### Phase 11: Optional Plugin System (HISTORICAL — superseded)
- Migrated 13 singletons to `optional_plugins/`
- Implemented lazy-loading via a bespoke manifest V2 schema (`project.json` + `manifest_validator.py` + `PLUGIN_REGISTRY`)
- Achieved 18–25% bootstrap token savings
- **Delivery**: Git tag `v11.0.0-plugin-system` created
- **Superseded**: Phase OSA / OSA-2 (2026-07-06) retired this entire bespoke manifest mechanism (`scripts/manifest_validator.py`, `PLUGIN_REGISTRY`, root `project.json` + `templates/project*.json`, `/manifest` command, `plugin.yaml` files, `guard-commit-evidence.js` hook) and converted all plugins to Claude Code's native plugin system (`.claude-plugin/marketplace.json` + per-plugin `plugin.json`). See Phase 13.

### Phase 12: Skill Maturity Tiers (PLANNED)
- Classify skills: Tier 1 (Essential), Tier 2 (Recommended), Tier 3 (Niche)
- Enable selective skill discovery in agent prompts

### Phase 13: Cross-Registry Unification (COMPLETE — 2026-07-06)
- Retired the bespoke manifest/plugin.yaml system entirely; native Claude Code plugins are now the single registry
- `.claude-plugin/marketplace.json` lists all 7 plugins; each has `optional_plugins/<name>/.claude-plugin/plugin.json`
- Loader gate is `enabledPlugins` in `.claude/settings.json` — no `project.json`/`auto_include` involved

---

## ⚠️ Known Constraints & Workarounds

| Constraint | Impact | Workaround |
|:---|:---|:---|
| Rhino 8 CPython 3.9 environment | Can't use f-strings, type unions, newer stdlib | Host modules stay 3.9-compat via `List[T]`, `Union` syntax |
| Power BI PBIP format lock | No manual `.json` edits during publish | Use Tabular Editor 3 for schema changes; sync back to PBIP |
| MCP JSON-RPC strictness | No `console.log` in tool output (reserved for JSON-RPC) | Use `console.error` for debug; inspect via stderr |
| Git history immutability | Can't rewrite published commits | Use feature branches + PR reviews; tag stable versions |

---

## Plugin System Architecture (Native Claude Code Plugins — current, since Phase OSA-2 2026-07-06)

### Non-Negotiables

1. **Singleton Skills Live in Native Plugins**: 17 skills across 7 plugins:
   - `code-mcp`: python-mcp, typescript-mcp
   - `geometry`: cd-foundations, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing
   - `manuscript`: business-analyst, manuscript-review
   - `ms-office`: docx, pptx, xlsx
   - `pbi-report`: powerbi-report
   - `visual-storytelling`: banana-prompt, pptx-slide-design
   - `youtube`: youtube-retention, youtube-scriptwriting, youtube-strategy
   - Accessible ONLY via `optional_plugins/<name>/skills/<skill>/` — NOT in `skills/`

2. **Marketplace + Plugin Manifest Is Default**: `.claude-plugin/marketplace.json` (repo root) lists all 7 plugins by name/source/description. Each plugin has its own `optional_plugins/<name>/.claude-plugin/plugin.json` (name, description, author). No schema versioning, no auto-upgrade logic — plugins are a flat native registry.

3. **Core Skills Remain Universal**: 9 core skills remain in `skills/` (not plugins)
   - Always available, never lazy-loaded
   - Non-negotiable for all project types
   - Examples: codebase-navigator, systematic-debugging, project-planner

4. **Loader Gate Is `enabledPlugins`**: A plugin's skills surface only when:
   - The plugin is installed (`/plugin marketplace add <repo>` then `/plugin install <name>@ai-code-settings`), AND
   - It is enabled per-project via `"enabledPlugins": { "<name>@ai-code-settings": true }` in `.claude/settings.json`
   - There is no `project.json`/`auto_include`/`PLUGIN_REGISTRY` gate — this IS the gate.

5. **Validation Is Native**: Use `claude plugin validate` against each `optional_plugins/<name>/` directory. No custom validator script exists.

### Key Routing

- **New singleton-related question?** → Check `optional_plugins/<name>/skills/<skill>/SKILL.md`
- **Plugin not surfacing?** → Verify it's installed AND `enabledPlugins` has `"<name>@ai-code-settings": true` in `.claude/settings.json`
- **Need to add a new optional plugin?** → Create `optional_plugins/<name>/.claude-plugin/plugin.json` + `optional_plugins/<name>/skills/<skill>/`, then add an entry to `.claude-plugin/marketplace.json`. Validate with `claude plugin validate`.

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

**Last Updated**: 2026-07-06
**Next Review**: After Phase 12 completion (estimated 2026-09-15)
