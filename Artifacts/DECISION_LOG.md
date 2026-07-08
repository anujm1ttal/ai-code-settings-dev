# Decision Log

Historical architectural decisions and pivots. Newest first.

---

## 2026-07-08 — Launch LH (Loop Hardening) initiative; grill cuts 4 phases → 3 [LH]

**Decision:** Launch LH as OSH's successor: convert prose gates to harness-enforced hooks where the runtime permits, then reclaim the replaced prose. Step 0 + `/grill` completed same session; user approved the hardened 3-phase roadmap (LH-1 mechanical hooks + spike → LH-2 evidence gate → LH-3 telemetry + prose split). Absorbs deferred BACKLOG items HK-G1/G3/G4.

**Rationale:** Loop-engineering assessment (2026-07-08): the OS scores ~90% on loop *philosophy* (TDD loop, auditor rejection loop, semantic loop detection) but ~50% on *mechanism* — most gates are prose the model must choose to obey. Highest-leverage fix is mechanical enforcement plus token payoff from deleting enforced prose.

**Grill verdicts (binding, evidence: official hook-docs check 2026-07-08 via claude-code-guide):** (1) PostToolUse cannot block — blocking-lint state machine CUT; auto-lint upgrades to loud additionalContext feedback instead. (2) Stop-block semantics undocumented — LH-1 carries an empirical spike; LH-2's design branches on its verdict. (3) Hook input carries no agent identity — TODO-authority hook KILLED, prose stays. (4) PreCompact event no longer exists — HK-G2 struck from BACKLOG. (5) User override on prose disposition: split-by-consumer — Claude context gets pointers, full text moves to a single `rules/gemini-only.md` (strategist constraint: exactly one file, registry-audited, to bound drift).

**Hard Rules:** hooks fail-open on script error; every deny states its unblock condition; no prose leaves context before its hook is verified + deploy-guarded; one Gemini-side file only.

---

## 2026-07-07 — Kick off OSH-5 (Token-Economy Diet) consolidation [OSH]

**Decision:** Launched OSH-5 on branch `phase-osh-5-token-diet` with a single consolidation coder (zero-loss Hard Rule prevents parallelization). Consolidated 19 duplicated blocks across 8 rules files + CLAUDE-global into single-canonical homes with pointers; demoted high-rigor-engineering.md (349 ln) → on-demand skill; cut model-routing.md (272→~40 ln, docs to scripts/README.md); trimmed TOKEN-ECONOMICS.md; added 3 precedence statements.

**Result:** Always-loaded corpus 1,827 → 1,160 lines (−36.5%, exceeds ~1,300 target). Coder produced zero-loss block map (19 entries, each with canonical home verified). Zero-loss + `/claude-md` gate in flight; verdicts will determine remediation or deploy approval.

**Evidence:** `Artifacts/Temp/osh-5_linecounts.txt` (before/after), `Artifacts/Temp/osh-5_zeroloss.txt` (block map).

**Residual risk:** Coder self-flagged 15 "Context Boundary" cells from orchestration's Command Fleet as potentially non-behavioral drops (e.g., "/council follows COUNCIL_PROTOCOLS.md"). Auditor gate must verify each survives in the command's own file or elsewhere — if any is lost, that is a zero-loss CRITICAL violation.

---

## 2026-07-07 — Ship OSH-1/2/3: merged to main + deployed live [OSH]

**Decision:** After independent auditor PASS on all three phases, merged the 4-commit stack fast-forward to `main` (`2147dd8`), deleted the phase branches, ran `bash scripts/deploy.sh` (backup `~/.claude.backup-20260707-125501`), and repointed live `~/.claude/settings.json` to the deployed `~/.claude/hooks/*.js` (matcher `Bash|PowerShell`, timeouts in seconds).

**Rationale:** User approved "merge + deploy + go live" at the checkpoint. The hooks-deploy integration (OSH-1) means editing the repo no longer changes live hook behavior until deploy — settings now point at `~/.claude/hooks/`, not the dev repo. This closes HK-H2/TL-H3 (hooks bypassing the deploy gate).

**Evidence:** deployed-hook smoke tests 5/5 green (`Artifacts/Temp/osh-1_deployed_evidence.txt`). The live guard-commands hook blocked its own deploy-session commands 3× when they contained literal dangerous syntax — end-to-end proof the deny path reaches the model. **Residual:** true live-session hook firing (session-boot injection, guards on real tool calls) confirmable only after a session restart.

**Auditor note:** OSH-3 shipped with one residual the auditor caught — `project-journal/SKILL.md` retained the retired archive rename scheme after the casing pass — fixed forward in `2147dd8` before merge.

---

## 2026-07-07 — Launch OSH (OS Hardening) initiative from full-setup audit [OSH]

**Decision:** Accept the 2026-07-07 read-only best-practices audit (6 parallel subagents over agents/commands/skills/hooks/rules/templates/scripts) and remediate via a 6-phase OSH initiative. Findings persisted with stable IDs in `Artifacts/AUDIT_REPORT.md`; phases planned in `Artifacts/Plans/OSH-[1-6]-*`. Step 0 approved by user.

**Rationale:** Audit surfaced 3 CRITICAL + ~27 HIGH issues clustering into: (1) hooks enforcement layer emitting invalid output schemas — session-boot injects nothing, guards block without reason, PowerShell tool uncovered; (2) agents mandated to write files without Write tools + hard gates citing a nonexistent `visual-auditor` and moved skill paths; (3) systemic state-file naming drift (`LEARNINGS.md` vs `learnings/`, both `History/` casings git-tracked); (4) registries out of sync + 17 vestigial METADATA.yaml; (5) ~30% always-loaded token waste; (6) model_router returning wrong models for plugin-hosted skills. Sequenced 1→6 by dependency (fix enforcement first, names before registries, registries before dedup).

**Binding sub-decisions** (recorded in phase plans, coder does not re-litigate): auditor gains Write/Edit; guards use `hookSpecificOutput` deny form; `Artifacts/History/` casing wins; CLAUDE-global = command-registry master; high-rigor-engineering.md demoted to on-demand skill; skills/skill-creator/ deleted (plugin duplicate); business-analyst moved to core. New hook *features* (PreCompact/Stop/commit-trailer) deferred to BACKLOG, separate Step 0.

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
