# Backlog — Deferred Work & Findings

Unscheduled deferred work, filed findings, and pending product decisions.
Reference-on-demand (not boot-loaded). ID format: `<phase>_<component>_<n>`.

---

## ~~`osa_model-routing_1` — Runtime bypasses assigned model tiers~~ — RESOLVED (not a bug)

**Filed:** 2026-07-06 · **Resolved:** 2026-07-06 · **Severity:** ~~HIGH~~ → none

**Original claim:** the audit showed 15 honored / 21 violated / 45 runs — agents
apparently downgraded to Haiku at runtime.

**Resolution:** false positive from historical data. Model routing was set up on
July 3; the audit was scanning transcripts back to June against the new config.
Scoping to post-config transcripts (`--since 2026-07-05`) yields **0 violations /
3 honored**. The 21 "violations" decompose as: 2 Qwen (June experiments, not even
Claude models), 6 Fable (one deliberate July-4 Fable session — main thread was
213 msgs of `claude-fable-5`), 13 Haiku (one July-3 setup-day session). **No
post-config downgrades exist — routing is honored.**

**Outcome:** added `--since YYYY-MM-DD` to the audit tool so historical/alt-model
sessions no longer register as false positives; corrected `model-routing.md`.

---

## `osa_plugin-docs_2` — Reconcile/retire the bespoke plugin manifest

**Filed:** 2026-07-06 (Phase OSA) · **Severity:** MEDIUM · **Type:** doc/tech-debt

After the native-plugin conversion, two registries describe the same skills:
native (`.claude-plugin/` + `enabledPlugins`, the real loader) and the AI-OS
manifest (`plugin.yaml` + `project.json → plugins[]` + `manifest_validator.py`,
routing intent only). Stale references to the pre-native skill layout remain in
`optional_plugins/index.md`, `skills/skills.overview.md`, `DEPLOY.md`, and
`manifest_validator.py`'s `PLUGIN_REGISTRY`. Decide: reconcile the two, or retire
the bespoke validator now that native plugins are canonical.

---

## `osa_plugin-scope_3` — Permanent per-plugin enable scope (product decision)

**Filed:** 2026-07-06 (Phase OSA) · **Severity:** LOW · **Type:** product decision

Where each of the 7 plugins is enabled (user/global vs per-project
`.claude/settings.json`) is deliberately left open. Per-project `enabledPlugins`
delivers the "only load what the project needs" goal; decide per plugin as real
projects adopt them.
