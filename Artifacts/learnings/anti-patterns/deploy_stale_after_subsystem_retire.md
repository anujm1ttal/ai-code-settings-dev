# Anti-Pattern: Deploy/CI Script Goes Stale After a Subsystem Is Retired

**Category:** anti-patterns
**First seen:** 2026-07-06 (CMD initiative)

## The gotcha

`scripts/deploy.sh` had been **unrunnable since Phase OSA-2** (`3f8ab64`) and nobody noticed.
When OSA-2 retired the bespoke manifest system, it deleted `manifest_validator.py`,
`plugin_manifest_schema.json`, and `test_manifest_validator_v2.py` — but `deploy.sh` still
referenced all three (source-validation sentinel, copy step, and a validation test). The break
stayed invisible for two phases because **no one ran a deploy** in between.

## The rule

- When you delete/retire a subsystem, **grep the deploy/build/CI scripts for references to the
  deleted files** in the same change — not just the source tree.
- Treat any deploy/CI script that **hasn't been executed since a large deletion as presumed
  broken** until proven otherwise. "It's not been touched" ≠ "it still works."
- Don't use a soon-to-be-deleted file as a script's existence sentinel. Pick a stable anchor
  (here: switched the sentinel to `CLAUDE-global.md`).

## Also surfaced

`deploy.sh` never copied `commands/` at all — they were hand-synced, and `skill-graph.md` had
already drifted out of `~/.claude/`. Hand-sync of a deployable dir is silent drift waiting to
happen; put every deployable dir in the script's copy loop.

Related: [[native-plugins-are-the-loader]]
