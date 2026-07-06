# Native Plugins Are the Skill Loader

**Category:** project-note · **Filed:** 2026-07-06 (Phase OSA/OSA-2)

## The invariant

Skills surface to the Skill tool ONLY through native Claude Code plugins:
`.claude-plugin/marketplace.json` (repo root) + per-plugin
`optional_plugins/<name>/.claude-plugin/plugin.json` + skills at
`optional_plugins/<name>/skills/<skill>/`. Enablement is per-project via
`enabledPlugins` in `.claude/settings.json` — that is the real loader gate.

## What was wrong before

The old `plugin.yaml` + `project.json → plugins[]` + `manifest_validator.py`
system was a **bespoke abstraction with no loader** — it never surfaced any skill.
`auto_include=false` "saved tokens" only by accident (skills lived in an unscanned
folder). That entire manifest system was retired (Phase OSA-2). `project_type`
routing tables survive as strategist/concierge *guidance*, not a validated file.

## Practical

- Register once per machine: `/plugin marketplace add <repo>` (loads nothing).
- Enable per project: `/plugin install <name>@ai-code-settings` → project scope, or
  hand-edit `enabledPlugins`.
- Validate authoring with `claude plugin validate <dir>`.
- 7 plugins: code-mcp, geometry, manuscript, ms-office, pbi-report,
  visual-storytelling, youtube (names == dirs).
