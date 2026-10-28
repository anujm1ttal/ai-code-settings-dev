# Pi optional plugin pilot — project-scoped selection

Pi's package discovery can read the existing first-party `optional_plugins/<group>/skills/` layout as a **local package**. This is independent of the `.claude-plugin/` marketplace metadata. No package is installed, copied, or added to user-level Pi settings by this source-only pilot.

## Opt in one project

In the consuming project's `.pi/settings.json`, select one reviewed source directory (replace the example path with the **absolute path** to your clone):

```json
{
  "packages": [{
    "source": "C:/path/to/ai-code-settings/optional_plugins/manuscript",
    "skills": ["skills/manuscript-review/SKILL.md"],
    "extensions": [], "prompts": [], "themes": []
  }]
}
```

The path is to a **local package**, not an npm/git install. The resource allowlist selects only the named first-party skill. The consuming project must explicitly grant trust (`pi --approve` for one disposable run, or a reviewed trust decision); without project trust, do not claim project resources loaded. The control project has no `.pi/settings.json` and no optional plugin. Pi's usual `~/.agents/skills/` core and synced skills may still load in both; compare only the selected optional skill. Do **not** add this package to `~/.pi/agent/settings.json` or install all groups globally. T10/T11 must validate each additional group and every enabled skill's bundled relative paths before use.

## Code MCP

For a reviewed MCP consumer, replace the manuscript `source` with the absolute path to `optional_plugins/code-mcp`, and set `skills` to `["skills/python-mcp/SKILL.md", "skills/typescript-mcp/SKILL.md"]`. Keep `extensions`, `prompts`, and `themes` as empty arrays. The two skills and their bundled `references/` files resolve from each skill's reported base directory, **not** from the consuming project's cwd. The TypeScript skill has six reference files; the Python skill has two references and `evals.json`. This selects instructions only; it does not start an MCP server, install FastMCP/Zod, or enable network tools. The group must also pass the opted-in vs untrusted/control Pi CLI checks before T10 closes.

## Geometry (source-only preview)

Use the same project-local package shape with `source` set to the **absolute path** to `optional_plugins/geometry` and `skills` set explicitly to `skills/{cd-foundations,grasshopper-plugin-packaging,python-rhino-grasshopper,rhino-e2e-testing,rhino-unit-testing}/SKILL.md` (expand that notation into five separate JSON strings). Leave other resource lists empty. For one disposable Pi process add `--append-system-prompt <absolute-path-to-pi/plugins/geometry/APPEND_SYSTEM.md>` after reviewing the bridge; a future trusted project may copy that first-party instruction to its own `.pi/APPEND_SYSTEM.md` only with approval. Neither step changes user-level Pi settings.

Existing tracked RhinoCommon/Grasshopper/GH_IO XML files stay where they are: **do not copy, relicense as MIT, or add new tracked vendor files**. The source pilot's project paths resolve through the skill's reported location rather than Claude's `${CLAUDE_PLUGIN_ROOT}` token. The user confirms permission covering these existing public-repository XML files; this is not an independently reviewed downstream sublicense or permission for additional third-party assets. Path checks alone do not prove Rhino/GH behavior. The geometry-validator child is not configured; never claim it ran. Project opt-in/control, trust, and reference checks must pass before T10 can close.

## pbi-report

For a Power BI consumer, set `source` to the absolute path of `optional_plugins/pbi-report` and `skills` to `["skills/powerbi-report/SKILL.md"]`. Keep other resource arrays empty. Explicitly preview `--append-system-prompt <absolute-path-to-pi/plugins/pbi-report/APPEND_SYSTEM.md>` with a selected disposable consumer so unbound role references cannot masquerade as a child. Its six `references/` files (including `theme-defaults.json`) resolve against the reported skill location, not the consuming cwd. Loading a skill does not configure Power BI, generate a `.pbip` file, or bind a creative-director child: the three-role pilot has no such binding. An opted-in project must have a real `Artifacts/LAYOUT_SPEC.md` or explicitly use a documented fallback; do not invent one for a smoke test.

## visual-storytelling

Set `source` to the absolute path of `optional_plugins/visual-storytelling`, with `skills` set to `["skills/banana-prompt/SKILL.md", "skills/pptx-slide-design/SKILL.md"]`; other resource arrays empty. For a disposable Pi preview of `pptx-slide-design`, explicitly add `--append-system-prompt <absolute-path-to-pi/plugins/visual-storytelling/APPEND_SYSTEM.md>`. The bridge maps two Claude-only script roots to the loaded skill's absolute location, and does **not** run PowerPoint, Copilot, Python scripts or image generators by merely loading. References, YAML data and Python validators stay in their existing first-party skill directory. No creative-director child is configured: a main-session layout brief needs user review, and any audit is report-only.

## youtube

Set `source` to the absolute path of `optional_plugins/youtube`, with `skills` set to `["skills/youtube-strategy/SKILL.md", "skills/youtube-scriptwriting/SKILL.md", "skills/youtube-retention/SKILL.md"]`; other resource arrays empty. These three skills have no bundled files. Preview `--append-system-prompt <absolute-path-to-pi/plugins/youtube/APPEND_SYSTEM.md>` with a selected disposable consumer. Their text may name a `scribe` or `strategist`: Pi has a generic strategist binding, but **no scribe child or YouTube-specific specialist binding**. Using these skills in a main session is not an isolated role dispatch, and the six deferred YouTube commands are not thereby Pi-native commands. Do not claim script/video production or user-level enablement from skill discovery.

## License and compatibility gate

Before selecting a group, enumerate **tracked** files under its source directory. Reject any third-party license header, restricted license file, or Office-vendored content; do not copy such content into tracked paths. `optional_plugins/manuscript/skills/manuscript-review/` has one first-party `SKILL.md` and two relative `references/*.md` files in this pilot. Its Claude `model:` frontmatter does **not** bind a Pi child; the skill now distinguishes Claude activation from the Pi pilot's explicit opt-in and report-only auditor. No functional editorial review or publication-readiness claim follows from discovery alone.
