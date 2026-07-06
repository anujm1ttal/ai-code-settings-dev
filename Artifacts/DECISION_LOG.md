# Decision Log

Historical architectural decisions and pivots. Newest first.

---

## 2026-07-06 — Split CLAUDE.md into global + project tiers [CMD]

**Decision:** Introduce `CLAUDE-global.md` as the deployable global (→ `~/.claude/CLAUDE.md`) and slim the repo's own `CLAUDE.md` (195→65 lines) to repo-specific guidance. Governed by new `rules/common/claude-md-standards.md`; audited by new `/claude-md` command.

**Rationale:** One `CLAUDE.md` was serving two roles (byte-identical global + project instructions), deployed verbatim. Splitting by blast radius removes the conflation and cuts per-session duplication. Global content preserved with zero regression (diff verified additive-only).

---

## 2026-07-06 — Reuse claude-md-improver instead of building a scanner [CMD]

**Decision:** Do NOT build a bespoke "check-and-update CLAUDE.md" engine. Build only the missing *standard* + a thin `/claude-md` wrapper over the already-installed official `claude-md-improver` plugin.

**Rationale:** Decision Ladder rung 2 (already in the codebase). The audit-and-update mechanism already existed as an installed plugin; the real gap was an OS-specific quality bar for it to grade against. Reuse over rebuild.

---

## 2026-07-06 — Repair deploy.sh (OSA-2 regression) [CMD]

**Decision:** Fix `deploy.sh`'s references to three files deleted in OSA-2 (`test_manifest_validator_v2.py`, `manifest_validator.py`, `plugin_manifest_schema.json`) and add `commands/` to its copy loop.

**Rationale:** First actual deploy since OSA-2 exposed that the script had been unrunnable for two phases. Repaired as a required precondition of the CMD deploy; also closed a `commands/` hand-sync drift (`skill-graph.md` was undeployed). Captured as anti-pattern learning.

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
