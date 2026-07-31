# Optional Plugins Registry

**L0 Overview**: Catalog of native Claude Code plugins bundled in this repository, their skills, and how to install/enable them.

## Overview

Each functional category (youtube, geometry, manuscript, etc.) is a **real native Claude Code plugin** — not a bespoke manifest entry. A plugin is a directory with a `.claude-plugin/plugin.json` descriptor and a `skills/<skill>/` directory per skill it provides. Plugins are lazy-loaded: only install/enable the ones a given project needs.

**Source of truth**: [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) at the repo root lists every plugin (name, source path, description). If this table and the marketplace file ever disagree, the marketplace file wins — re-derive this table from it and the `skills/` directory listings.

---

## Plugin Catalog

| Plugin | Description | Skills (Count) |
|:---|:---|:---|
| `code-mcp` | MCP tool development for Python and TypeScript. Schemas, JSON-RPC patterns, async boundary standards. | python-mcp, typescript-mcp (2) |
| `geometry` | Rhinoceros/Grasshopper geometry modeling and computation. RhinoCommon APIs, E2E testing, manifoldness verification. | cd-foundations, grasshopper-plugin-packaging, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing (5) |
| `manuscript` | Manuscript and academic writing support. Developmental review workflows. | manuscript-review (1) |
| `pbi-report` | Power BI report development and modeling. Visual composition, DAX design, performance optimization. | powerbi-report (1) |
| `visual-storytelling` | Copy-paste-ready prompt generation for external AI renderers (thumbnails, decks, visual assets). | banana-prompt, pptx-slide-design (2) |
| `youtube` | YouTube content creation pipeline (strategy, scriptwriting, retention). Enables `/ideate`, `/script`, `/pack`. | youtube-retention, youtube-scriptwriting, youtube-strategy (3) |

**Total**: 6 plugins, 14 skills. (Counts derived from the tree, not maintained by hand.)

> Office document skills (`docx`/`pptx`/`xlsx`) are **not shipped by this repo** — Anthropic
> licensed material whose terms bar redistribution. Obtain them from Anthropic.

---

## Install & Enable (Native Plugin Flow)

Plugins are distributed via a Claude Code **marketplace**. This repository is itself a marketplace (`.claude-plugin/marketplace.json`).

1. **Add the marketplace** (once per machine):
   ```
   /plugin marketplace add anujm1ttal/ai-code-settings
   ```
2. **Install a plugin**:
   ```
   /plugin install geometry@ai-code-settings
   ```
3. **Enable per-project**: add the plugin name to `enabledPlugins` in that project's `.claude/settings.json`:
   ```json
   {
     "enabledPlugins": ["geometry", "code-mcp"]
   }
   ```

Only enabled plugins load their skills into a project's context — this is the lazy-loading mechanism (no bespoke `project.json`/manifest layer involved).

---

## Directory Structure

```
optional_plugins/
├── index.md                          (This file — L0 catalog)
├── README.md                         (Native plugin structure & usage guide)
├── code-mcp/
│   ├── .claude-plugin/plugin.json
│   └── skills/{python-mcp, typescript-mcp}/
├── geometry/
│   ├── .claude-plugin/plugin.json
│   └── skills/{cd-foundations, python-rhino-grasshopper, rhino-e2e-testing, rhino-unit-testing}/
├── manuscript/
│   ├── .claude-plugin/plugin.json
│   └── skills/manuscript-review/
├── pbi-report/
│   ├── .claude-plugin/plugin.json
│   └── skills/powerbi-report/
├── visual-storytelling/
│   ├── .claude-plugin/plugin.json
│   └── skills/{banana-prompt, pptx-slide-design}/
└── youtube/
    ├── .claude-plugin/plugin.json
    └── skills/{youtube-retention, youtube-scriptwriting, youtube-strategy}/
```

---

## Token Impact

Enabling only the plugins a project needs avoids loading unused skill metadata into context. A project that only needs `geometry` installs and enables that one plugin instead of all 16 skills across all 7 plugins.

---

## See Also

- [`../.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json) — Canonical plugin registry (name, source, description)
- `README.md` — Native plugin structure and authoring guide
- `../skills/skills.overview.md` — Universal (always-on) skill registry, distinct from these optional plugins
