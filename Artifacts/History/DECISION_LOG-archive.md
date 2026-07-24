# Decision Log Archive

Rolling archive of rotated entries from `Artifacts/DECISION_LOG.md`. Newest first, append-only —
entries are moved here, never deleted. Back-pointer: active log → `Artifacts/DECISION_LOG.md`.

Entries rotate here when the active log exceeds ~400 lines / ~40 entries (oldest RESOLVED
entries only; unresolved entries never rotate). See `rules/common/orchestration.md` §Persistence
→ **DECISION_LOG Rotation**.

---

## 2026-07-06 — Retire the bespoke manifest system (full) [Phase OSA-2]

**Decision:** Delete `manifest_validator.py`, `project.json` (+ 9 templates + schema), the `/manifest` command, 7 `plugin.yaml` sidecars, `plugin_manifest_schema.json`, 2 manifest test files, 4 dead migration scripts, and the dormant `guard-commit-evidence.js` hook. Native Claude Code plugins become the single plugin registry.

**Rationale:** After the native-plugin conversion, the manifest layer was redundant and partly broken (`validate_plugins` checked pre-move skill paths; validator crashed on Windows). Its headline value — token savings via `auto_include` — was already shown to be illusory (real gate is `enabledPlugins`). Chose full retire (Option 3) over reconcile because two coexisting registries was exactly the problem Phase OSA set out to eliminate. `project_type` routing tables survive as strategist/concierge guidance.

**Alternatives rejected:** (1) Reconcile — perpetuates two registries. (2) Partial retire — keeps `/manifest`, whose value was thin post-B4.

---

## 2026-07-06 — Convert optional_plugins to native Claude Code plugins [Phase OSA]

**Decision:** Convert all 7 `optional_plugins/*` groups to native plugins (`.claude-plugin/marketplace.json` + per-plugin `plugin.json` + `skills/` layout). Plugin name = directory name; version omitted (git-SHA versioning); enablement per-project via `enabledPlugins`.

**Rationale:** The bespoke `plugin.yaml` format had no loader — it never surfaced skills. Only native plugins do. Proven live: the `code-mcp` pilot's skills appeared as slash commands after `/plugin install`. Repo is private, so "marketplace" stays personal (no publication).

---

## 2026-07-06 — Model-routing "bypass" is a false positive [Phase OSA]

**Decision:** Close the runtime-bypass finding as not-a-bug; add `--since` date filter to the audit tool.

**Rationale:** Routing config existed only from July 3; the audit scanned June-onward history against it. Post-config scope (`--since 2026-07-05`) → 0 violations. The 21 "violations" were pre-config sessions + deliberate alternate-model runs (Fable, Qwen). Routing is honored.
