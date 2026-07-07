# Next-Session Note: The Plugin-Registry Gap

**Filed:** 2026-07-05 · **Type:** Finding + product decision (unscheduled)
**TL;DR:** The AI-OS "plugin" system (`plugin.yaml` + `project.json → plugins[]` + `manifest_validator.py`) is a **bespoke abstraction with no loader behind it.** It does not surface skills. Only `~/.claude/skills/` does. Optional skills are invisible not because a toggle is off, but because they live in a folder the harness never scans.

---

## The finding

Two **independent, unsynced** registries coexist:

| | AI-OS "plugins" | Claude Code native plugins |
|:---|:---|:---|
| Declared in | `project.json → plugins[]`, `optional_plugins/*/plugin.yaml` | `~/.claude/plugins/installed_plugins.json`, `settings.json → enabledPlugins` |
| Registry / schema | `optional_plugins/plugin_manifest_schema.json` + `manifest_validator.py` | `known_marketplaces.json` + `marketplaces/` |
| Examples | `code-mcp-tools`, `geometry-rhino`, `ms-office-core` | `discord`, `telegram`, `frontend-design-plugin` |
| **Surfaces skills to the Skill tool?** | **No — intent/doc only** | **Yes — real loader** |

`project.json → plugins[]` is declarative intent the concierge reads. Nothing wires `plugin_id → skill availability`.

## Evidence (verified this session)

- **Live proof:** the session's available skills = **exactly** the 14 folders in `~/.claude/skills/`. **Zero** `optional_plugins/` skills surfaced (no python-rhino-grasshopper, pptx, powerbi-report, youtube-strategy, typescript-mcp, …).
- `DEPLOY.md` copies `optional_plugins/` → `~/.claude/optional_plugins/` — **not a native scan path.** So even deployed, these skills sit outside every directory the harness reads.
- Repo has **no** `.claude-plugin/`, `marketplace.json`, or `plugin.json` → it is **not a Claude Code plugin.** The `plugin.yaml` format is custom, not the native `plugin.json`.

## Correction to the earlier explanation

A prior session framed optional skills as *native plugins toggled off* ("not active this session," "harness hasn't loaded them"). **Inaccurate** — there is no native plugin to activate. The gap is a folder-location problem, not a load-state problem. This changes the fix.

---

## Fix options (pick one — this is the product decision)

1. **Cheap / matches current design.** Move or symlink specific skill folders out of `optional_plugins/` into `~/.claude/skills/` (global) or a project's `.claude/skills/` (per-project). Native scan picks them up next launch.
   - Trade-off: loses the "off saves ~2,400 tokens" story where placed globally. **Per-project `.claude/skills/` is the closest real opt-in.**
2. **Proper.** Convert each `optional_plugins/*` group into a real Claude Code plugin (`.claude-plugin/marketplace.json` + `plugin.json`), register the repo as a marketplace, `/plugin install`. Only then does `enabledPlugins` become a real toggle and the AI-OS manifest's `enabled: true` can be genuinely wired.
   - More work, but it makes the two registries into one and delivers the selective loading the manifest advertises.

**Recommended first step:** decide between (1) per-project `.claude/skills/` and (2) real plugins. If unsure, prototype (1) with one skill (e.g. python-rhino-grasshopper) to confirm the native scan surfaces it, then decide whether the token-gating is worth path (2).

## Also fix (honesty)

`CLAUDE.md` / project docs claim `auto_include=false` "saves ~2,400 tokens by skipping unused skill metadata." Currently **true by accident** — optional skills are invisible because they're in an unscanned folder, not because the manifest gates them. The manifest is not doing the gating it advertises. Reword or make it real via a fix above.
