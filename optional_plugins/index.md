# Optional Plugins Registry

**L0 Overview**: Plugin discovery, load policies, and activation rules for the Claude Code optional plugin system.

## Overview

The optional plugin system reduces bootstrap overhead by lazy-loading specialized skills only when needed. Plugins are organized by functional category (youtube, geometry, manuscript, etc.) and auto-activate based on `project_type` detection.

**Impact**: 15–25% token savings on projects using only 1–2 plugin categories.

---

## Quick Reference Table

| Plugin ID | Category | Skills (Count) | Project Types | Auto-Enable | Min OS |
|:---|:---|:---|:---|:---|:---|
| `youtube-core` | youtube | youtube-strategy, youtube-scriptwriting, youtube-retention (3) | youtube | Yes | 2.5.0 |
| `ms-office-core` | ms-office | pptx, docx, xlsx (3) | pptx, data, manuscript | Yes | 2.5.0 |
| `visual-storytelling-core` | visual-storytelling | banana-prompt, pptx-slide-design (2) | pptx, youtube | Yes | 2.5.0 |
| `pbi-core` | pbi-report | *(none in v1.0)* | pbi-report, data | Yes | 2.5.0 |
| `code-mcp-tools` | code-mcp | python-mcp, typescript-mcp (2) | code | Yes | 2.5.0 |
| `geometry-rhino` | geometry | cd-foundations, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing (4) | geometry | Yes | 2.5.0 |
| `manuscript-tools` | manuscript | manuscript-review, glossary-extraction (2) | manuscript | Yes | 2.5.0 |

**Total Skills in Phase 0**: 15 singleton skills across 7 plugins.

---

## Load Policies

Each skill within a plugin has a load policy:

| Policy | Meaning | Activation |
|:---|:---|:---|
| `auto` | Loads automatically when plugin is active | Default for core skills |
| `on-demand` | User must explicitly enable in project.json | Reserved for future extensions |
| `disabled` | Not available in this plugin version | For deprecation warnings |

---

## Activation Rules

### Automatic Activation
A plugin is automatically activated if:
1. **Project type match**: `manifest.project_type` matches one of `plugin.project_types`
2. **Auto-include enabled**: Either `manifest.auto_include=true` OR manifest explicitly references the plugin
3. **Compatibility met**: Current AI OS version ≥ `plugin.compatibility.min_os_version`

### Manual Override
Users can override activation in `project.json`:

```json
{
  "project_type": "youtube",
  "auto_include": true,
  "plugins": [
    { "plugin_id": "youtube-core", "enabled": false },
    { "plugin_id": "geometry-rhino", "enabled": true }
  ]
}
```

---

## Token Impact Analysis

### Baseline Costs (L1 metadata per skill)
- ~100 tokens per skill metadata
- 29 total skills in global registry
- All skills loaded: ~2,900 tokens

### Per-Plugin Cost
| Plugin | Skills | Approx. Tokens | Loaded For | Savings (opt-out) |
|:---|:---|:---|:---|:---|
| youtube-core | 3 | 300 | youtube projects only | 2,600 |
| geometry-rhino | 4 | 400 | geometry projects only | 2,500 |
| manuscript-tools | 2 | 200 | manuscript projects only | 2,700 |
| code-mcp-tools | 2 | 200 | code + MCP focus only | 2,700 |
| ms-office-core | 3 | 300 | pptx, data, manuscript projects | 2,600 |
| visual-storytelling-core | 2 | 200 | pptx, youtube projects | 2,700 |

**Expected Outcome**: A project using only `youtube` and foundational skills will load ~12 skills total instead of 29, saving ~1,700 tokens/session.

---

## Directory Structure

```
optional_plugins/
├── index.md                    (This file — L0 registry)
├── README.md                   (Migration guide for users)
├── plugin_manifest_schema.json (JSON Schema for validation)
├── youtube/
│   ├── plugin.yaml            (Manifest for youtube category)
│   ├── youtube-strategy/       (Skill directory — moved in Phase 11.2)
│   ├── youtube-scriptwriting/
│   └── youtube-retention/
├── ms-office/
│   ├── plugin.yaml
│   ├── pptx/                   (Skill directory — moved in Phase 0)
│   ├── docx/                   (Skill directory — moved in Phase 0)
│   └── xlsx/                   (Skill directory — moved in Phase 0)
├── visual-storytelling/
│   ├── plugin.yaml
│   ├── banana-prompt/          (Skill directory — moved in Phase 0)
│   └── pptx-slide-design/     (Skill directory — authored in Phase 2)
├── pbi-report/
│   └── plugin.yaml            (No skills in v1.0; reserved for future)
├── code-mcp/
│   ├── plugin.yaml
│   ├── python-mcp/            (Skill directory — moved in Phase 11.2)
│   └── typescript-mcp/
├── geometry/
│   ├── plugin.yaml
│   ├── cd-foundations/        (Skill directory — moved in Phase 11.2)
│   ├── python-rhino-grasshopper/
│   ├── rhino-e2e-testing/
│   └── rhino-unit-testing/
└── manuscript/
    ├── plugin.yaml
    ├── manuscript-review/     (Skill directory — moved in Phase 11.2)
    └── glossary-extraction/
```

---

## Manifest Versioning

The plugin system introduces **Schema V2** for `project.json` manifests.

### V1 → V2 Migration

**V1 Manifest** (current, pre-plugin):
```json
{
  "project_type": "youtube",
  "auto_include": true,
  "active_skills": ["banana-prompt"],
  "disabled_skills": []
}
```

**V2 Manifest** (with plugin support):
```json
{
  "project_type": "youtube",
  "schema_version": "2.0.0",
  "auto_include": true,
  "active_skills": ["banana-prompt"],
  "disabled_skills": [],
  "plugins": [
    { "plugin_id": "youtube-core", "enabled": true }
  ]
}
```

**Auto-upgrade**: The `manifest_validator.py` script auto-detects V1 manifests and offers silent upgrade to V2 (without writing to disk unless user approves).

---

## Plugin Discovery

To list all available plugins:

```bash
python scripts/manifest_validator.py /path/to/project --list-plugins
```

To validate a plugin manifest:

```bash
python scripts/manifest_validator.py /path/to/project --validate-plugins
```

---

## Constraints & Future Work

### Phase 11.1 (Infrastructure)
- Plugins are read-only (manifest-driven activation only).
- No dynamic plugin loading or unloading mid-session.
- Plugins must be part of the git repository (no external/downloadable plugins in v1).

### Phase 11.2 (Implementation)
- Copy singleton skills to plugin directories.
- Validate YAML syntax and schema compliance.
- Update project templates to include `plugins` key.

### Phase 11.3 (Deactivation)
- Remove singleton skills from `skills/` after validation.
- Implement reversible migration script with rollback support.
- Update all routing and discovery commands to recognize plugins.

---

## See Also

- `plugin_manifest_schema.json` — Full JSON Schema specification
- `README.md` — User migration guide
- `scripts/manifest_validator.py` — Validation and upgrade logic
- `templates/project.schema.json` — Updated with `plugins` support
- `Artifacts/IMPLEMENTATION_PLAN.md` — Phase 11 technical design
