# Project Manifest Templates

Templates for `project.json` manifests that declare project type and active skills for selective skill loading.

## Quick Start

1. **Copy the appropriate template** to your project root:
   ```bash
   cp templates/project-code.json your-project/project.json
   ```

2. **Customize** the manifest:
   ```json
   {
     "project_name": "My Project Name",
     "project_type": "code",
     "auto_include": true,
     "active_skills": [],
     "disabled_skills": [],
     "metadata": {}
   }
   ```

3. **Run `/sync`** in Claude Code to load the manifest.

## Template Breakdown

| Template | Use Case | `auto_include` | Notes |
|:---|:---|:---|:---|
| `project-code.json` | Python/TypeScript tools, APIs, backends | `true` | Includes: codebase-navigator, systematic-debugging, python-mcp, typescript-mcp, python-patterns |
| `project-geometry.json` | Rhino/GH modeling, CAD scripting | `true` | Includes: python-rhino-grasshopper, rhino-e2e-testing, cd-foundations |
| `project-data.json` | Power BI models, DAX, analytics | `true` | Includes: dax-modeling, powerbi-report, python-patterns |
| `project-pptx.json` | PowerPoint decks, presentations | `true` | Includes: pptx, visual-composition, python-patterns |
| `project-pbi.json` | Power BI report development | `true` | Includes: powerbi-report, visual-composition, dax-modeling |
| `project-youtube.json` | YouTube scripts, video planning | `true` | Includes: youtube-strategy, youtube-scriptwriting, youtube-retention |
| `project-manuscript.json` | Books, documents, editorial | `true` | Includes: manuscript-review, glossary-extraction |
| `project-hybrid.json` | Mixed (geometry + code, pptx + data, etc.) | `true` | Includes all applicable skills per detected files |
| `project-minimal.json` | **Minimal token usage** | `false` | ONLY includes: python-patterns, codebase-navigator. Extend with `active_skills`. |

## Key Concepts

### `auto_include`

- **`true`** (default): Start with default skills for your project type, then add/remove via `active_skills` and `disabled_skills`.
- **`false`**: Use ONLY the skills in `active_skills`. Best for cost-sensitive or highly specialized projects.

### `active_skills`

Declare skills you want available. Behavior depends on `auto_include`:
- If `true`: These are **added** to the default set.
- If `false`: These are the **only** skills available.

### `disabled_skills`

Only applies if `auto_include=true`. Remove specific skills from the default set (e.g., removing `youtube-retention` from a `youtube` project if you're not concerned with retention mechanics).

### `metadata`

Optional project-wide constants and constraints. Mirrors the intent of `Artifacts/MEMORY_ANCHORS.md`. Example:

```json
{
  "project_name": "Stadium Sightline",
  "project_type": "geometry",
  "metadata": {
    "max_seats": 50000,
    "tolerance_mm": 1.5,
    "viewing_angle_min": 20
  }
}
```

## Token Savings

Actual skill-metadata token cost is governed by which **native plugins are enabled** (`enabledPlugins`), not by `auto_include`. To skip an unused skill's L1 metadata, disable or don't install its plugin for the project. `auto_include=false` narrows the concierge's advertised (routing-intent) skill set — useful for clarity, but the loader gate is native plugin enablement.

**Recommended for**:
- Specialized single-purpose projects
- Cost-critical deployments or high-volume automation
- Projects that only need 2-4 specific skills

**Not recommended for**:
- Early-phase projects where requirements are unclear
- Teams that may need to pull in new domains mid-project

## Validation

The concierge validates your manifest during `/sync`:
- Checks against `templates/project.schema.json`
- Reports errors for invalid `project_type` or missing required fields
- Suggests corrections if `active_skills` names don't match registry

## Example Scenarios

### Scenario 1: Python API with minimal overhead

```json
{
  "project_name": "Weather API",
  "project_type": "code",
  "auto_include": false,
  "active_skills": ["python-mcp", "python-patterns", "codebase-navigator"]
}
```

**Effect**: narrows the concierge's advertised skill set to these 3 (routing intent). Real metadata savings come from not enabling the other plugins for this project.

### Scenario 2: Rhino model with extra debugging skill

```json
{
  "project_name": "Stadium Seating",
  "project_type": "geometry",
  "auto_include": true,
  "active_skills": ["systematic-debugging"],
  "disabled_skills": []
}
```

**Result**: Geometry defaults + systematic-debugging (no change)

### Scenario 3: Presentation that doesn't need design help

```json
{
  "project_name": "Q4 Quarterly Report",
  "project_type": "pptx",
  "auto_include": true,
  "disabled_skills": ["visual-composition"]
}
```

**Result**: pptx, python-patterns (visual-composition excluded)

## Troubleshooting

**Q: My manifest isn't loading?**
A: Run `/sync` explicitly. The concierge reads `project.json` during `/sync` and at session boot.

**Q: Do I have to have a manifest?**
A: No, but it's recommended. Without one, the concierge assumes `auto_include=true` for your project type (all default skills loaded).

**Q: Can I change the manifest mid-project?**
A: Yes. Edit `project.json`, run `/sync`, and the new skill set takes effect immediately in that session.

**Q: My skill name isn't recognized.**
A: Check `skills/skills.overview.md` for the exact skill name. Names are case-sensitive.
