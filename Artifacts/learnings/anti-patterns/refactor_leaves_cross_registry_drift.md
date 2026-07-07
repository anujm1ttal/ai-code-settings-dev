# Anti-Pattern: Refactors Leave Cross-Registry Drift

**Category:** anti-patterns
**First seen:** 2026-07-07 (OSH audit)

## The gotcha

Most HIGH findings in the OSH audit were not bad design — they were **stale references left
behind when a past refactor was applied to the source but not swept across every registry that
names it**. Three refactors accounted for the bulk:
- **Manifest retirement** → `csharp-grasshopper` / `visual-auditor` / `global_workflows/`
  phantom names lingered in agents + commands.
- **Plugin migration** (`skills/` → `optional_plugins/*/skills/`) → agent hard-gates, the
  model_router, and skill-graph still pointed at `skills/python-rhino-grasshopper/…`; overview
  named ghost plugins `ms-office-core` / `visual-storytelling-core`.
- **`LEARNINGS.md` → `learnings/` rename** → orchestration.md contradicted *itself* (lines 18/85
  vs 212/329); learn.md frontmatter + session-boot.js still read the dead file.

Each rename touched the "obvious" file and skipped the 3–5 other places that reference it by name.

## The rule

- **A rename/retire is not done until you grep every registry for the old name in the same
  change.** Registries in this OS: `CLAUDE-global.md`, `rules/common/orchestration.md`,
  `agents/*.md` frontmatter + `agents.overview.md`, `skills/skills.overview.md`, command files,
  plugin `.claude-plugin/*.json` + `marketplace.json`, and the Python scripts that parse any of
  these.
- Prefer **one canonical home + pointers** over N copies of a table (a name then lives in one
  place, so a rename has one edit site). This is the OSH-5 dedup thesis.
- Where a script hardcodes a table that a rule file also owns, make the script **parse the rule
  live** (benchmark: `model_routing_audit.py`) so the two cannot drift.

## Related
[[deploy-stale-after-subsystem-retire]] (deploy-script variant of the same "retire didn't sweep
everything" failure) · [[native-plugins-are-the-loader]].
