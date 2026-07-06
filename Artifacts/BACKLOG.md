# Backlog — Deferred Work & Findings

Unscheduled deferred work, filed findings, and pending product decisions.
Reference-on-demand (not boot-loaded). ID format: `<phase>_<component>_<n>`.

---

## `osa_model-routing_1` — Runtime bypasses assigned model tiers

**Filed:** 2026-07-06 (Phase OSA) · **Severity:** HIGH · **Type:** finding (needs own Step 0)

**Evidence:** `scripts/model_routing_audit.py` audited session transcripts vs the
`model:` frontmatter in `agents/*.md`: **15 honored / 21 violated / 45 runs**.
Coder ran on `claude-haiku-4-5` ~82% of the time despite being assigned Sonnet;
auditor honored only 36%; strategist and one run dropped to Haiku too.

**Impact:** the cost/quality model in `rules/common/model-routing.md` is intent
only — expensive agents are silently downgraded at runtime, so both the quality
(Sonnet/Opus reasoning) and the cost accounting are off.

**Why deferred:** the bypass is a runtime/harness behavior (the runtime appears to
ignore per-agent `model:` frontmatter), not fixable from repo config. Needs its
own Step 0 to investigate: is it a subagent-inherits-main-thread-model default, a
settings misconfiguration, or a harness limitation? Detect-only in Phase OSA
(Hard Rule 3).

**Repro:** `python scripts/model_routing_audit.py --violations-only`

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
