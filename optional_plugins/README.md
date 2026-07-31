# Optional Plugins — Native Claude Code Plugin Structure

**For**: Developers authoring or maintaining plugins in this repository.

## What Are Plugins?

Each subdirectory under `optional_plugins/` is a **real, native Claude Code plugin** — a functional-category bundle of skills (youtube, geometry, manuscript, etc.) that a project can install and enable on demand instead of loading every skill in the registry.

A plugin is nothing more than:
```
optional_plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json          # name, description, author
└── skills/
    └── <skill-name>/
        └── SKILL.md          # (+ references/, scripts/, resources/, assets/ as needed)
```

There is no bespoke manifest, schema, or validator layer — plugin discovery and loading are handled natively by Claude Code via the marketplace mechanism described below.

---

## The Marketplace

The repository root declares itself as a marketplace in [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json):

```json
{
  "name": "ai-code-settings",
  "owner": { "name": "Anuj Mittal" },
  "plugins": [
    { "name": "geometry", "source": "./optional_plugins/geometry", "description": "..." },
    ...
  ]
}
```

Every plugin listed there is a directory with its own `.claude-plugin/plugin.json`. The `name` field in `plugin.json` is the plugin's identity — it is also the value used in `enabledPlugins`.

---

## Installing & Enabling a Plugin

1. **Register the marketplace** (once per machine):
   ```
   /plugin marketplace add anujm1ttal/ai-code-settings
   ```
2. **Install the plugin you need**:
   ```
   /plugin install youtube@ai-code-settings
   ```
3. **Enable it for a specific project** by adding its name to `enabledPlugins` in that project's `.claude/settings.json`:
   ```json
   {
     "enabledPlugins": ["youtube"]
   }
   ```

Only plugins listed in a project's `enabledPlugins` contribute their skills/commands to that project's context. This replaces the old `project_type` + `auto_include` manifest logic entirely — enablement is explicit and per-project.

---

## Current Plugin Roster

See [`index.md`](index.md) for the full catalog (skills per plugin, counts). Quick summary:

| Plugin | Skills |
|:---|:---|
| `code-mcp` | python-mcp, typescript-mcp |
| `geometry` | cd-foundations, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing |
| `manuscript` | manuscript-review |
| `pbi-report` | powerbi-report |
| `visual-storytelling` | banana-prompt, pptx-slide-design |
| `youtube` | youtube-retention, youtube-scriptwriting, youtube-strategy |

---

## Authoring a New Plugin

1. Create `optional_plugins/<plugin-name>/.claude-plugin/plugin.json`:
   ```json
   {
     "name": "<plugin-name>",
     "description": "One-sentence summary of what this plugin provides.",
     "author": { "name": "Anuj Mittal" }
   }
   ```
2. Add each skill under `optional_plugins/<plugin-name>/skills/<skill-name>/SKILL.md` (with YAML frontmatter per the [skill-creator](../skills/skill-creator/) workflow).
3. Register the plugin in [`../.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) — add a `{ "name", "source", "description" }` entry pointing at `./optional_plugins/<plugin-name>`.
4. Update [`index.md`](index.md)'s catalog table and directory tree to include the new plugin and its skill count.

---

## Adding a Skill to an Existing Plugin

1. Create `optional_plugins/<plugin-name>/skills/<skill-name>/SKILL.md`.
2. Update the skill list and count for that plugin in [`index.md`](index.md).
3. No registration step is needed beyond that — the plugin's `skills/` directory is read directly; there is no separate roster file to keep in sync.

---

## FAQ

**Q: Do I need a manifest or schema file to add a plugin?**
A: No. Native plugins only need `.claude-plugin/plugin.json` plus a `skills/` directory. There is no `plugin.yaml`, JSON Schema, or validator script in this system.

**Q: How does a project choose which plugins load?**
A: Via `enabledPlugins` in that project's own `.claude/settings.json`, after installing the plugin from this marketplace. There is no `project_type`/`auto_include` inference layer.

**Q: Can I enable multiple plugins for one project (hybrid projects)?**
A: Yes — list every plugin name you need in `enabledPlugins`.

**Q: Where do universal (always-on) skills live?**
A: In `skills/` at the repo root, not under `optional_plugins/`. Those are not part of any plugin and load for every project. See `../skills/skills.overview.md`.

---

## See Also

- [`index.md`](index.md) — L0 catalog: plugin list, skill counts, directory tree
- [`../.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) — Canonical plugin registry
- [`../skills/skills.overview.md`](../skills/skills.overview.md) — Universal skill registry
