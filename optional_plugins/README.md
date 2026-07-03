# Optional Plugins System — Migration Guide

**For**: Project developers migrating from Schema V1 to V2 manifests.

## What Are Plugins?

Plugins are optional, lazy-loaded skill collections organized by functional category. Instead of loading all 29 global skills on every session, projects now load only:
1. Foundational skills (always)
2. Project-type defaults (if `auto_include=true`)
3. Custom plugins (if referenced in project.json)

**Result**: ~15–25% token savings per session.

---

## Do I Need to Migrate?

### Automatic Migration (Silent)
If you're on **Schema V1**, your manifest is compatible with V2:
- `auto_include=true` projects automatically get matching plugins loaded.
- `auto_include=false` projects are unaffected (their behavior is preserved).
- No action required — your project works as before.

### Explicit Opt-In (Recommended for token optimization)
If you want to fine-tune which plugins load, upgrade to Schema V2 and add a `plugins` key:

```bash
python scripts/manifest_validator.py /path/to/your/project --upgrade-schema
```

This generates a V2-compatible manifest without writing to disk. Review and commit when ready.

---

## Migration Steps

### Step 1: Check Your Current Schema
```bash
python scripts/manifest_validator.py /path/to/your/project
```

Look for:
- `Schema Version: 1.0.0` (current) or `2.0.0` (migrated)

### Step 2: Upgrade (Optional, Recommended)
```bash
python scripts/manifest_validator.py /path/to/your/project --upgrade-schema --apply
```

This updates your `project.json` to V2 and adds the `schema_version` field.

### Step 3: Verify
```bash
python scripts/manifest_validator.py /path/to/your/project --analyze
```

Your token count should be similar or lower. If plugins didn't activate correctly, check:
1. `plugins[].plugin_id` matches registry (see `index.md`)
2. `auto_include` is correct
3. `project_type` matches plugin's `project_types`

---

## Schema Examples

### Before (V1 — Schema 1.0.0)
```json
{
  "project_name": "Stadium Sightline Optimizer",
  "project_type": "geometry",
  "auto_include": true,
  "active_skills": ["banana-prompt", "business-analyst"],
  "disabled_skills": [],
  "metadata": {
    "max_seats": 50000,
    "tolerance_mm": 1.5
  }
}
```

### After (V2 — Schema 2.0.0)
```json
{
  "project_name": "Stadium Sightline Optimizer",
  "project_type": "geometry",
  "schema_version": "2.0.0",
  "auto_include": true,
  "active_skills": ["banana-prompt", "business-analyst"],
  "disabled_skills": [],
  "plugins": [
    {
      "plugin_id": "geometry-rhino",
      "enabled": true
    }
  ],
  "metadata": {
    "max_seats": 50000,
    "tolerance_mm": 1.5
  }
}
```

**Key Changes**:
- Added `schema_version: "2.0.0"`
- Added `plugins` array with `plugin_id` and `enabled` status

---

## Advanced: Manual Plugin Control

### Disable a Plugin Explicitly
```json
{
  "project_type": "youtube",
  "plugins": [
    { "plugin_id": "youtube-core", "enabled": false }
  ]
}
```

This loads youtube as a project type but skips the youtube-core plugin (useful if you're testing a custom skill version).

### Enable Multiple Plugins (Hybrid Projects)
```json
{
  "project_type": "hybrid",
  "plugins": [
    { "plugin_id": "youtube-core", "enabled": true },
    { "plugin_id": "geometry-rhino", "enabled": true },
    { "plugin_id": "code-mcp-tools", "enabled": true }
  ]
}
```

---

## Plugin Activation Matrix

Plugins activate automatically based on `project_type` and `auto_include`:

| Project Type | auto_include | Plugins Loaded | Token Cost |
|:---|:---|:---|:---|
| youtube | true | youtube-core + foundational | ~1,200 |
| youtube | false | foundational only | ~700 |
| geometry | true | geometry-rhino + foundational | ~1,400 |
| code | true | code-mcp-tools + foundational | ~1,100 |
| hybrid | true | all matching plugins | ~2,000+ |

---

## Troubleshooting

### Issue: Plugin not loading
**Check**:
1. `manifest.project_type` matches `plugin.project_types`
2. `manifest.auto_include=true` OR `manifest.plugins[plugin_id].enabled=true`
3. No conflicts in `plugin.conflicts` array

### Issue: "Unknown plugin_id"
**Check**:
- `plugin_id` spelling (must match exactly)
- Plugin exists in `optional_plugins/[category]/plugin.yaml`

### Issue: Skills not found
**Check**:
- Skill exists in `optional_plugins/[category]/[skill]/SKILL.md`
- Skill name matches `plugin.yaml` roster

### Issue: Token cost didn't improve
**Check**:
- Are all default foundational skills needed? (Can't remove them)
- Is `active_skills` still declaring redundant skills? (See recommendations)

---

## Rollback (If Needed)

If you need to revert to V1, simply remove the `schema_version` and `plugins` keys:

```json
{
  "project_type": "youtube",
  "auto_include": true,
  "active_skills": ["banana-prompt"],
  "disabled_skills": []
}
```

The validator will treat it as V1 and auto-upgrade on next run (but won't apply without `--apply` flag).

---

## FAQ

**Q: Will my old V1 manifests break?**  
A: No. V1 and V2 are backward compatible. The validator auto-detects and handles both.

**Q: Do I lose any skills?**  
A: No. All 12 singleton skills are now in plugins; their functionality is unchanged. You're just choosing when to load them.

**Q: Can I mix V1 and V2 projects in the same repository?**  
A: Yes. Each project's `project.json` is independent.

**Q: What if I want to load skills NOT in the default plugin?**  
A: Use `active_skills` as before. Plugins are additive; you can still add custom skills.

**Q: Can I create my own plugins?**  
A: Not in Phase 11.1. Phase 11.2+ may support custom plugin definitions.

---

## See Also

- `index.md` — L0 registry overview and reference
- `plugin_manifest_schema.json` — Full schema specification
- `../templates/project.schema.json` — JSON Schema for project.json
- `../scripts/manifest_validator.py` — Validation script docs
