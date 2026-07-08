# Backlog — Deferred Work & Findings

Unscheduled deferred work, filed findings, and pending product decisions.
Reference-on-demand (not boot-loaded). ID format: `<phase>_<component>_<n>`.

---

## `osh_docs-count_1` — Stale "17 skills" count in out-of-scope docs

**Filed:** 2026-07-07 (OSH-4) · **Severity:** LOW · **Needs:** doc pass

OSH-4 moved `business-analyst` from the manuscript plugin to core, dropping the
optional-plugin skill count 17 → 16. Two files still say "17 skills" but were
**not** in OSH-4's approved file list, so they were left untouched per Hard Rule 2
(deletions/edits enumerated-only):

- `README.md` (3 occurrences)
- `Artifacts/MEMORY_ANCHORS.md` (2 occurrences)

Fix: update both to 16 (or point them at `optional_plugins/index.md` as the single
source of truth for the count, matching the `skills.overview.md:5` DRY fix applied
in OSH-4). Trivial; batch into any future doc-sync pass.

---

## ~~`osh_hooks-gaps_1..4` — New hook features (deferred from OSH-1)~~ — GRADUATED to LH (3 of 4)

**Filed:** 2026-07-07 (OSH-1) · **Graduated:** 2026-07-08 → LH initiative (`Plans/LH-1-Plan.md`)

Separate Step 0 completed 2026-07-08 (LH blueprint + grill). Disposition:

1. **`osh_hooks-gaps_1` — Stop/SubagentStop handoff nudge** → **LH-1 T4** (nudge-only;
   additionalContext, never blocks).
2. **`osh_hooks-gaps_2` — PreCompact hook** → **STRUCK — unimplementable.** PreCompact
   is absent from the current hook-events list (SessionStart, SessionEnd,
   UserPromptSubmit, Stop, StopFailure, PreToolUse, PostToolUse — official docs check
   2026-07-08 via claude-code-guide). Re-file only if the event returns to the harness.
3. **`osh_hooks-gaps_3` — Scratch-dir hard-gate** → **LH-1 T2** (state-basename deny
   under shadow paths; memory/ allowlisted).
4. **`osh_hooks-gaps_4` — Commit-trailer guard** → **LH-1 T3** (Bash + PowerShell forms).

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

## ~~`osa_plugin-docs_2` — Reconcile/retire the bespoke plugin manifest~~ — RESOLVED

**Filed:** 2026-07-06 · **Resolved:** 2026-07-06 (Phase OSA-2) · **Severity:** ~~MEDIUM~~

**Decision:** Option 3 (full retire). The entire bespoke manifest system was
deleted — `manifest_validator.py`, root `project.json` + 9 templates + schema,
`/manifest` command, 7 `plugin.yaml` sidecars, `plugin_manifest_schema.json`, the
2 manifest test files, 4 dead migration scripts, and the dormant
`guard-commit-evidence.js` hook. Native `.claude-plugin/` + `enabledPlugins` is
now the single plugin registry. Docs pruned across ~14 files; `skill_graph_analyzer`
made self-contained; `MEMORY_ANCHORS.md` updated to native architecture.

**Residual (accepted):** one illustrative `project.json type` mention in
`skills/receiving-code-review/SKILL.md` left untouched per Hard Rule 1 (no skill
content edits).

---

## ~~`osa_plugin-scope_3` — Permanent per-plugin enable scope~~ — CLOSED (by design)

**Filed:** 2026-07-06 · **Closed:** 2026-07-06 · **Severity:** LOW

**Resolution:** no blanket decision needed — decide per project. Per-project
`enabledPlugins` in `.claude/settings.json` already delivers the "only load what
the project needs" goal, and the mechanism is in place + documented
(`optional_plugins/index.md`). Forcing a global default now would re-create the
global-install anti-pattern that was explicitly rejected. Each project enables the
plugins it needs as it adopts them.
