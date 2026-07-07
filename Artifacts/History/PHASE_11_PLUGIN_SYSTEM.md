# Phase 11: Optional Plugin System for Singleton Skills

**Objective**: Move 12 singleton skills (used by exactly 1 project type) to an optional plugin system to reduce bootstrap overhead and enable selective lazy-loading of rarely-used domain skills.

**Context**: Phase 9 identified 8 universal skills (3+ project types), 12 singletons (1 project type), and 111 tag clusters. This phase operationalizes the plugin system.

**Timeline**: 3 implementation phases over 2 sprints.
**Risk Level**: MEDIUM (affects manifest validation, skill discovery, and bootstrap)

---

## Part 1: Singleton Skills Inventory

### 12 Singleton Skills (Exclusive to One Project Type)

| # | Skill | Project Type | Current File Size | Use Case | Rationale for Plugin |
|:---|:---|:---|:---|:---|:---|
| 1 | `youtube-strategy` | youtube | 150 lines | SEO, thumbnails, packaging | Niche content domain; rarely needed outside video projects |
| 2 | `youtube-scriptwriting` | youtube | 120 lines | A/V script formatting | Hyper-specific to video production workflows |
| 3 | `youtube-retention` | youtube | 100 lines | Pacing, viewer retention gates | Specialized content analytics; not applicable elsewhere |
| 4 | `pptx` | pptx | 180 lines | PowerPoint generation via pptxgenjs | Presentation-only domain; niche use case |
| 5 | `powerbi-report` | pbi-report | 200 lines | Power BI visual/DAX patterns | BI-specific; rarely overlaps with other project types |
| 6 | `typescript-mcp` | code | 220 lines | MCP server standards, Zod, JSON-RPC | Code-MCP-specific; not used in other project types |
| 7 | `cd-foundations` | geometry | 140 lines | Architectural constraints, coordination | Constraint-design domain-specific |
| 8 | `python-rhino-grasshopper` | geometry | 250 lines | RhinoCommon API, CPython 3.9 patterns | Rhino/GH runtime specifics; not portable |
| 9 | `rhino-e2e-testing` | geometry | 160 lines | Headless E2E testing (rhinoinside) | Geometry-runtime-specific testing |
| 10 | `rhino-unit-testing` | geometry | 130 lines | Lane B Pure Python testing | Geometry project standard (not cross-cutting) |
| 11 | `manuscript-review` | manuscript | 110 lines | Editorial standards, narrative structure | Publishing domain-specific |
| 12 | `python-mcp` | code | 200 lines | FastMCP server standards | Code-MCP-specific (complements typescript-mcp) |

**Subtotal**: 1,960 lines
**Estimated Token Savings per Project**: ~1,200–1,600 tokens (by not loading singleton metadata for non-matching project types)

---

## Part 2: File Structure for Optional Plugins

### Directory Hierarchy

```
optional_plugins/
├── index.md                          (L0: Plugin registry overview)
├── plugin_manifest_schema.json        (JSON Schema for plugin metadata)
├── youtube/
│   ├── plugin.yaml                   (Plugin metadata)
│   ├── youtube-strategy/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── METADATA.yaml
│   ├── youtube-scriptwriting/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── METADATA.yaml
│   └── youtube-retention/
│       ├── SKILL.md
│       ├── references/
│       └── METADATA.yaml
├── pptx/
│   ├── plugin.yaml
│   └── pptx/
│       ├── SKILL.md
│       ├── references/
│       └── METADATA.yaml
├── pbi-report/
│   ├── plugin.yaml
│   └── powerbi-report/
│       ├── SKILL.md
│       ├── references/
│       └── METADATA.yaml
├── code-mcp/
│   ├── plugin.yaml
│   ├── typescript-mcp/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── METADATA.yaml
│   └── python-mcp/
│       ├── SKILL.md
│       ├── references/
│       └── METADATA.yaml
├── geometry/
│   ├── plugin.yaml
│   ├── cd-foundations/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── METADATA.yaml
│   ├── python-rhino-grasshopper/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── METADATA.yaml
│   ├── rhino-e2e-testing/
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── METADATA.yaml
│   └── rhino-unit-testing/
│       ├── SKILL.md
│       ├── references/
│       └── METADATA.yaml
├── manuscript/
│   ├── plugin.yaml
│   └── manuscript-review/
│       ├── SKILL.md
│       ├── references/
│       └── METADATA.yaml
└── README.md                         (Migration guide & plugin architecture)
```

**Migration Path**:
1. Create `optional_plugins/` directory structure
2. **Copy** (not move) skills from `skills/` to `optional_plugins/[category]/[skill]/`
3. Keep skills in `skills/` as **canonical source** during Phase 2 (rollback safety)
4. Phase 3: Remove from `skills/` after validation

---

## Part 3: Plugin Metadata Schema

### Plugin Category Manifest (`plugin.yaml`)

```yaml
# optional_plugins/youtube/plugin.yaml
---
# Plugin Category Definition
plugin_category: youtube
display_name: "YouTube Content Creation"
description: "Skills for YouTube video strategy, scriptwriting, and retention analytics"
version: "1.0.0"
released_date: "2026-07-15"
stability: stable

# Compatibility Matrix
compatibility:
  project_types:
    - youtube
  min_ai_os_version: "1.8.0"
  max_ai_os_version: null  # null = unlimited
  deprecated: false

# Plugin Skills (metadata only; full content in SKILL.md)
skills:
  - name: youtube-strategy
    version: "1.0.0"
    trigger: "YouTube project requiring SEO, title, thumbnail optimization"
    agents: [strategist, creative-director]
    
  - name: youtube-scriptwriting
    version: "1.0.0"
    trigger: "Creating or auditing A/V scripts for YouTube"
    agents: [scribe]
    
  - name: youtube-retention
    version: "1.0.0"
    trigger: "Analyzing pacing, retention gates, and viewer dropout"
    agents: [auditor, coder]

# Dependencies (within plugin system)
dependencies: []

# Auto-enable Rules
auto_enable:
  project_types: [youtube]
  conditions:
    - if: project_type == 'youtube' AND auto_include == true
      then: auto_load_all_skills

# Maintenance
maintainer: "Concierge (Agent OS)"
audit_date: "2026-07-15"
audit_status: PASS
lint_status: PASS
```

### Individual Skill Metadata (`METADATA.yaml` within each skill)

```yaml
# optional_plugins/youtube/youtube-strategy/METADATA.yaml
---
skill_name: youtube-strategy
skill_type: domain
plugin_category: youtube
plugin_id: "youtube-core"

# Classification
domain: content-creation
subdomain: video-strategy
rarity: singleton  # Used by exactly 1 project type

# Discovery
keywords: [youtube, seo, thumbnail, packaging, title-optimization, analytics]
trigger_description: "Use when optimizing YouTube video metadata, packaging, or SEO strategy"

# Lifecycle
version: "1.0.0"
released: "2026-07-15"
status: stable
deprecation_notice: null

# Dependencies
depends_on: []
conflicts_with: []

# Agents & Commands
agents:
  - strategist (primary)
  - creative-director (secondary)
commands: [/ideate, /pack]

# Performance
file_size_bytes: 12400
estimated_tokens: 2800  # When loaded standalone
estimated_tokens_in_plugin: 2200  # When bundled with youtube plugin

# Load Behavior
load_policy: lazy-on-demand
load_cost: medium
  
# Fallback & Warnings
no_fallback: false
fallback_skills: []
warnings:
  - "Requires YouTube account context in project metadata"
```

---

## Part 4: Updated Project Manifest Schema

### New `project.json` Schema (V2)

```json
{
  "project_name": "My YouTube Project",
  "project_type": "youtube",
  "schema_version": "2.0.0",
  
  "skills_config": {
    "auto_include": true,
    "active_skills": [],
    "disabled_skills": [],
    "plugins": [
      {
        "plugin_id": "youtube-core",
        "category": "youtube",
        "version": "1.0.0",
        "enabled": true,
        "skills": ["youtube-strategy", "youtube-scriptwriting", "youtube-retention"]
      }
    ]
  },
  
  "metadata": {
    "created_date": "2026-07-03",
    "last_modified": "2026-07-15",
    "author": "user@example.com"
  }
}
```

### Backward Compatibility Mode

Projects without `plugins` key will auto-initialize via fallback logic:

```python
# Pseudo-code for manifest loader
def load_project_manifest(path):
    manifest = json.load(path)
    
    if "schema_version" not in manifest or manifest["schema_version"] < "2.0.0":
        # BACKWARD COMPAT: Inject default plugins
        manifest = upgrade_to_v2(manifest, project_type=manifest["project_type"])
    
    return manifest

def upgrade_to_v2(v1_manifest, project_type):
    """Convert V1 manifest to V2 with plugin references."""
    default_plugins = get_default_plugins_for_type(project_type)
    
    v1_manifest["schema_version"] = "2.0.0"
    v1_manifest["skills_config"] = {
        "auto_include": v1_manifest.get("auto_include", True),
        "active_skills": v1_manifest.get("active_skills", []),
        "disabled_skills": v1_manifest.get("disabled_skills", []),
        "plugins": default_plugins
    }
    
    return v1_manifest
```

### Manifest Validator Update

```python
# Updated DEFAULT_SKILLS with plugin references
DEFAULT_PLUGINS: dict[ProjectType, list[dict]] = {
    "youtube": [
        {
            "plugin_id": "youtube-core",
            "category": "youtube",
            "version": "1.0.0",
            "enabled": True,
            "skills": ["youtube-strategy", "youtube-scriptwriting", "youtube-retention"]
        }
    ],
    "pptx": [
        {
            "plugin_id": "pptx-core",
            "category": "pptx",
            "version": "1.0.0",
            "enabled": True,
            "skills": ["pptx"]
        }
    ],
    # ... (all project types with their singleton plugins)
}

# Foundational & universal skills remain in core (NOT plugins)
FOUNDATIONAL_SKILLS = [
    "codebase-navigator",
    "systematic-debugging",
    "implementation-dispatch",
    "verification-gate",
    "project-planner",
    "project-journal",
    "doc-updater"
]

UNIVERSAL_SKILLS = [
    "python-patterns",
    "visual-composition",
    "dax-modeling",
    "business-analyst",
    "skill-creator",
    "banana-prompt",
    "glossary-extraction",
    "docx",
    "xlsx"
]
```

---

## Part 5: Token Impact Analysis

### Current Bootstrap Cost (All Skills Loaded)

| Layer | Skills Loaded | Estimated Tokens |
|:---|:---|:---|
| L1 Overview | All 35 skills | 2,800 |
| L0 Abstracts (Active Skills) | 8–12 per project | 3,200–4,800 |
| **Total Current** | — | **~6,000–7,600** |

### After Plugin System (Optimized)

#### Scenario A: youtube project with `auto_include=true`

| Layer | Skills Loaded | Estimated Tokens |
|:---|:---|:---|
| L1 Overview (Core Only) | 7 foundational + 9 universal | 2,000 |
| Plugin Registry | youtube-core plugin metadata | 400 |
| L0 Abstracts (Active) | 10 youtube + 3 plugin | 3,400 |
| **Total Optimized** | — | **~5,800** |
| **Savings** | — | **-1,200–1,800 tokens (18–25%)** |

#### Scenario B: code project with `auto_include=true`

| Layer | Skills Loaded | Estimated Tokens |
|:---|:---|:---|
| L1 Overview (Core Only) | 7 foundational + 9 universal | 2,000 |
| Plugin Registry | code-mcp plugin metadata | 300 |
| L0 Abstracts (Active) | 5 code + 2 plugin | 2,800 |
| **Total Optimized** | — | **~5,100** |
| **Savings** | — | **-1,500–2,500 tokens (23–30%)** |

#### Scenario C: geometry project with `auto_include=true`

| Layer | Skills Loaded | Estimate Tokens |
|:---|:---|:---|
| L1 Overview (Core Only) | 7 foundational + 9 universal | 2,000 |
| Plugin Registry | geometry-core plugin metadata | 500 |
| L0 Abstracts (Active) | 5 geometry + 4 plugin | 4,200 |
| **Total Optimized** | — | **~6,700** |
| **Savings** | — | **-600–1,000 tokens (8–13%)** |

### Net Impact

- **Average savings per project**: 1,200–1,600 tokens (18–22%)
- **Hybrid projects**: 800–1,200 tokens (12–18%)
- **Global registry bootstrap**: 3,000–4,000 tokens saved when only loading core

---

## Part 6: 3-Phase Migration Plan

### Phase 11.1: Plugin Infrastructure (Week 1)

**Deliverable**: `optional_plugins/` directory structure, schema definitions, validator updates.

**Tasks**:
1. `[coder]` Create `optional_plugins/` directory tree (file structure as per Part 2)
2. `[coder]` Write `plugin_manifest_schema.json` (JSON Schema validation)
3. `[coder]` Write `optional_plugins/index.md` (L0 registry overview)
4. `[coder]` Update `scripts/manifest_validator.py` to support V2 schema and backward compatibility
5. `[coder]` Add `optional_plugins/README.md` (migration guide and plugin architecture)
6. `[auditor]` Validate schema, JSON, and Python code changes
7. **Success Metric**: Validator passes test suite for both V1 and V2 manifests

**Blockers**: None (purely additive, no breaking changes to existing structure)

---

### Phase 11.2: Copy & Validate Singletons (Week 2)

**Deliverable**: All 12 singleton skills copied to `optional_plugins/[category]/[skill]/`, with updated metadata.

**Tasks**:
1. `[coder]` Copy all 12 singleton skills to plugin structure:
   - youtube/ (3 skills)
   - pptx/ (1 skill)
   - pbi-report/ (1 skill)
   - code-mcp/ (2 skills)
   - geometry/ (4 skills)
   - manuscript/ (1 skill)
2. `[coder]` Create `plugin.yaml` for each category
3. `[coder]` Create `METADATA.yaml` for each skill
4. `[coder]` Update `templates/project-*.json` to reference plugins (via `plugins` key)
5. `[auditor]` Validate all YAML files against schema
6. `[auditor]` Spot-check 3 skills (youtube-strategy, python-rhino-grasshopper, manuscript-review)
7. **Success Metric**: All 12 skills validated, templates updated, no diff between `skills/` and `optional_plugins/[skill]/`

**Blockers**: Schema must be finalized in Phase 11.1

---

### Phase 11.3: Deactivation & Rollback Safety (Week 3)

**Deliverable**: Core skills directory cleaned; rollback procedure documented; full test coverage.

**Tasks**:
1. `[coder]` Create `scripts/migrate_skills_to_plugins.py` (idempotent, reversible migration script)
2. `[coder]` Write `Artifacts/ROLLBACK_PROCEDURE.md` (step-by-step reversal instructions)
3. `[coder]` Run migration script in **simulation mode** (dry-run) on a test project
4. `[coder]` Test project.json validation with V1 and V2 manifests
5. `[coder]` Test backward compatibility layer (manifest upgrade logic)
6. `[auditor]` Run comprehensive test suite:
   - `/manifest` validation for all 8 project types
   - Plugin discovery and lazy-loading simulation
   - Token calculation accuracy (spot-check 3 scenarios)
7. `[coder]` After auditor sign-off: Remove singleton skills from `skills/` directory
8. `[concierge]` Update CLAUDE.md and MEMORY_ANCHORS with new plugin discovery path
9. **Success Metric**: All tests pass; rollback procedure validated; zero integration failures on 3 test projects

**Blockers**: Phase 11.2 must be complete; auditor PASS required before deactivation

---

## Part 7: Risk Assessment & Mitigation

### CRITICAL Risks

| Risk | Severity | Likelihood | Mitigation |
|:---|:---|:---|:---|
| **Backward Compatibility Break** | CRITICAL | LOW | Auto-upgrade V1→V2 manifest schema; test both formats pre-merge |
| **Plugin Discovery Failure** | CRITICAL | LOW | Hard-coded fallback to core `skills/` if plugin registry unreadable; detailed error logging |
| **Token Count Miscalculation** | HIGH | MEDIUM | Instrument actual token usage via `/manifest --analyze`; update token estimates based on real data |

### HIGH Risks

| Risk | Severity | Likelihood | Mitigation |
|:---|:---|:---|:---|
| **Skill References Break** | HIGH | MEDIUM | Validate all inter-skill references (e.g., "See `typescript-mcp`") still resolve correctly; update relative links |
| **Plugin Loading Race Condition** | HIGH | LOW | Manifest loader must be thread-safe; concierge `/sync` must lock during plugin discovery |
| **Incomplete Metadata Migration** | HIGH | MEDIUM | Audit checklist: every skill must have `METADATA.yaml` with all required fields; validator enforces this |

### MEDIUM Risks

| Risk | Severity | Likelihood | Mitigation |
|:---|:---|:---|:---|
| **Documentation Staleness** | MEDIUM | HIGH | Update CLAUDE.md, routing rules, and `/explain` output to reference plugins; add link checker to CI |
| **User Confusion on First Load** | MEDIUM | MEDIUM | Write clear migration guide (`optional_plugins/README.md`); auto-upgrade is silent but logged |
| **Plugin Naming Conflicts** | MEDIUM | LOW | Enforce globally-unique plugin IDs and category names; validator rejects duplicates |

---

## Part 8: Rollback Procedure

### Trigger Conditions

Rollback should be initiated if:
- **Auditor marks Phase 11.3 as FAIL** (test failures, incompatibility issues)
- **Post-merge validation detects >3 integration failures** in dependent projects
- **User requests rollback** within 72 hours of merge

### Rollback Steps (Reversible)

**Estimated Time**: 30 minutes (git-based reversal)

1. **Freeze Changes**: Halt any ongoing skill edits
2. **Restore Skills Directory**:
   ```bash
   git checkout main -- skills/
   ```
3. **Revert Manifest Validator**:
   ```bash
   git checkout main -- scripts/manifest_validator.py
   ```
4. **Verify Backward Compat**:
   ```bash
   python scripts/manifest_validator.py validate-all
   ```
5. **Archive Plugin Directory** (retain for forensics):
   ```bash
   mv optional_plugins/ optional_plugins.rollback-[timestamp]/
   ```
6. **Notify Stakeholders**: Email with rollback reason, no action required
7. **Post-Mortem**: Within 24 hours, review failure logs and adjust Phase 11.2/11.3 tasks

**No Data Loss**: All projects revert to V1 manifest schema automatically. Plugin directory is archived, not deleted.

---

## Part 9: Success Criteria

### Phase 11.1 (Infrastructure)
- [ ] `optional_plugins/` directory exists with correct structure
- [ ] `plugin_manifest_schema.json` validates against sample YAML files
- [ ] `scripts/manifest_validator.py` updated and passes unit tests
- [ ] Zero lint violations in new Python code
- [ ] Auditor approves all schema changes

### Phase 11.2 (Copy & Validate)
- [ ] All 12 skills copied to `optional_plugins/[category]/[skill]/`
- [ ] Each skill has `plugin.yaml` (category level) and `METADATA.yaml` (skill level)
- [ ] Templates (`project-*.json`) updated with `plugins` key
- [ ] Spot-check validation: diff between `skills/[skill]/` and `optional_plugins/[category]/[skill]/` is zero
- [ ] Auditor passes all 12 skills

### Phase 11.3 (Deactivation & Rollback)
- [ ] Migration script runs idempotently (dry-run then live)
- [ ] Singleton skills removed from `skills/` directory
- [ ] V1→V2 manifest upgrade validated on 3 test projects
- [ ] Token savings measured and logged in `/manifest --analyze` output
- [ ] Rollback procedure tested on live environment (reverse, validate, restore)
- [ ] Auditor marks all integration tests as PASS
- [ ] Zero regressions in dependent projects or workflows

### Token Impact Validation
- [ ] Baseline token measurement before migration
- [ ] Post-migration token measurement (at least 3 project types)
- [ ] Actual savings >= 15% (lower bound) for all project types
- [ ] No token increase for universal/foundational skills

---

## Part 10: Integration Points & Dependencies

### Files Affected (Phase 11)

| File | Impact | Change Type |
|:---|:---|:---|
| `CLAUDE.md` | Update Project Type Routing section | ADD `plugin` discovery flow |
| `skills/skills.overview.md` | Cross-reference to plugin registry | ADD links to `optional_plugins/index.md` |
| `scripts/manifest_validator.py` | Support V2 schema, plugin references | EDIT ~150 lines |
| `templates/project-*.json` | Add `plugins` key, update structure | EDIT all 9 templates |
| `Artifacts/MEMORY_ANCHORS.md` | Document plugin system launch | ADD new anchor |
| `Artifacts/IMPLEMENTATION_PLAN.md` | Archive Phase 11 spec to history | MOVE to `Artifacts/history/` |

### External Systems (No Direct Integration)

- GitHub CI/CD: No changes required (tests remain compatible)
- Claude Code hooks: `guard-paths.js` may need to whitelist `optional_plugins/` for writes (LOW priority)
- Agent prompts: Concierge intake flow updated to check for `project.json` V2 schema (automatic)

### Dependent Workflows

1. **`/sync` (Concierge)**: Must validate V1→V2 upgrade; emit audit log
2. **`/manifest` (Concierge)**: Must parse plugin references; output token savings breakdown
3. **`/audit` (Auditor)**: Must cross-reference skills in plugins with audited list
4. **Agent Initialization**: Must lazy-load plugins only if project type matches

---

## Part 11: Timeline & Ownership

### Phased Rollout Schedule

| Phase | Week | Agent | Milestones | Gate |
|:---|:---|:---|:---|:---|
| 11.1 | W33 (Jul 21–27) | coder, auditor | Schema, validator, docs | Auditor PASS |
| 11.2 | W34 (Jul 28–Aug 3) | coder, auditor | Copy 12 skills, metadata, templates | Auditor PASS + spot-check |
| 11.3 | W35 (Aug 4–10) | coder, auditor, concierge | Migration, rollback, integration tests | Auditor PASS + zero failures |

### Pre-Merge Checklist

- [ ] All artifacts in `Artifacts/` (no shadow files)
- [ ] Git branch: `phase-11-plugin-system`
- [ ] Commit message: `feat(plugin-system): migrate 12 singleton skills to optional plugins`
- [ ] Auditor approval: `/audit --final` PASS
- [ ] Rollback tested: `rollback.sh` script functional
- [ ] Documentation updated: CLAUDE.md, skills.overview.md, README
- [ ] Token impact validated: 15%+ savings demonstrated

### Merge & Deployment

1. Create PR from `phase-11-plugin-system` to `main`
2. Auditor final review + approval
3. Merge to `main`
4. Delete feature branch
5. Create annotated tag: `v11.0.0-plugin-system`
6. Notify team: Email + DECISION_LOG entry

---

## Appendix: Schema Examples

### Sample `plugin.yaml` (youtube category)

```yaml
plugin_category: youtube
display_name: YouTube Content Creation
version: 1.0.0
released_date: 2026-07-15

compatibility:
  project_types: [youtube]
  min_ai_os_version: 1.8.0
  deprecated: false

skills:
  - name: youtube-strategy
    version: 1.0.0
  - name: youtube-scriptwriting
    version: 1.0.0
  - name: youtube-retention
    version: 1.0.0

auto_enable:
  project_types: [youtube]
```

### Sample `project.json` (V2, youtube project)

```json
{
  "project_name": "My YouTube Channel",
  "project_type": "youtube",
  "schema_version": "2.0.0",
  "skills_config": {
    "auto_include": true,
    "plugins": [
      {
        "plugin_id": "youtube-core",
        "category": "youtube",
        "version": "1.0.0",
        "enabled": true
      }
    ]
  }
}
```

### Migration Script Pseudocode

```python
#!/usr/bin/env python3
"""
Migrate singleton skills from skills/ to optional_plugins/
Fully reversible via git restore.
"""

from pathlib import Path
import shutil

SINGLETONS = [
    ("youtube", ["youtube-strategy", "youtube-scriptwriting", "youtube-retention"]),
    ("pptx", ["pptx"]),
    ("pbi-report", ["powerbi-report"]),
    ("code-mcp", ["typescript-mcp", "python-mcp"]),
    ("geometry", ["cd-foundations", "python-rhino-grasshopper", "rhino-e2e-testing", "rhino-unit-testing"]),
    ("manuscript", ["manuscript-review"]),
]

def migrate_skills(dry_run=True):
    """Copy skills from skills/ to optional_plugins/ (idempotent)."""
    for category, skills in SINGLETONS:
        for skill in skills:
            src = Path(f"skills/{skill}")
            dst = Path(f"optional_plugins/{category}/{skill}")
            
            if dry_run:
                print(f"[DRY-RUN] Copy {src} -> {dst}")
            else:
                if dst.exists():
                    print(f"[SKIP] {dst} already exists")
                else:
                    shutil.copytree(src, dst)
                    print(f"[OK] Copied {src} -> {dst}")

if __name__ == "__main__":
    migrate_skills(dry_run=True)
```

---

## Summary

This Phase 11 plan:
1. **Identifies 12 singleton skills** and structures them as optional plugins
2. **Reduces bootstrap overhead** by 15–25% per project on average
3. **Maintains backward compatibility** via silent V1→V2 manifest upgrade
4. **Provides reversible rollback** procedure for safety
5. **Introduces plugin discovery** system for future extensibility

**Next Steps**: User approval of this plan → Phase 11.1 kickoff.
