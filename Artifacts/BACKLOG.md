# Backlog — Deferred Work & Findings

Unscheduled deferred work, filed findings, and pending product decisions.
Reference-on-demand (not boot-loaded). ID format: `<phase>_<component>_<n>`.

---

## `osh_hooks-gaps_1..4` — New hook features (deferred from OSH-1)

**Filed:** 2026-07-07 (OSH-1) · **Severity:** LOW–MEDIUM · **Needs:** separate Step 0

OSH-1 fixed the five existing hooks (output schemas, guard coverage, deploy
integration). These are *new capabilities* the audit (HK-G1..G4) recommended but
that are out of OSH-1's fix-only scope — each is a feature, not a repair:

1. **`osh_hooks-gaps_1` — Stop/SubagentStop hook**: nudge `/handoff` when a session
   ends with uncommitted TODO changes (CLAUDE-global mandates the handoff).
2. **`osh_hooks-gaps_2` — PreCompact hook**: enforce the "context >60% → `/handoff`"
   emergency protocol at the natural compaction boundary.
3. **`osh_hooks-gaps_3` — Scratch-dir hard-gate**: extend `guard-paths.js` to block
   writes to shadow `~/.claude/projects/**` state and `scratch/`, which
   orchestration.md declares a HARD-GATE.
4. **`osh_hooks-gaps_4` — Commit-trailer guard**: PreToolUse Bash/PowerShell pattern
   rejecting commits carrying `Co-Authored-By: Claude` / "Generated with Claude Code"
   (standing deny-list rule, currently unenforced).

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
