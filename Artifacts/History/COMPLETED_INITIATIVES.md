# Completed Initiatives — Archive Ledger

Historical record of shipped initiatives, moved out of the active `Artifacts/TODO.md` during the
2026-07-08 TODO-slimming pass. Newest first. Full technical detail lives in
`Artifacts/History/Plans/` + `Artifacts/History/Reports/`; decisions in `Artifacts/DECISION_LOG.md`.

Genuinely-deferred follow-ups from these initiatives were moved to `Artifacts/BACKLOG.md`
(`cmd_gemini-parity_1`, `osa_subagent-tier_1`) — not lost in this archive.

---

# LH — Loop Hardening (2026-07-08)

**Status:** COMPLETE — all 3 phases shipped, auditor-verified, deployed, merged to `main`, pushed.
**Step 0:** approved 2026-07-08 · **Grill:** [REFACTORED] 4→3 phases · **LH-3 re-scoped** (prose-split dropped, see DECISION_LOG)
**Sequencing:** LH-1 → LH-2 (shaped by LH-1 spike verdict) → LH-3 (terminal)

- [x] **LH-1 — Mechanical Hooks + Stop-Block Spike** (`14716e4`, merged + deleted) — auto-lint fix-before-proceeding, scratch-gate + commit-trailer PreToolUse denies, handoff nudge, empirical Stop-block spike. Auditor 2-pass gate (1 HIGH + 2 MEDIUM fixed + re-confirmed live). Deployed 2026-07-08.
- [x] **LH-2 — Evidence Gate** (`541362c`, merged + deleted) — Stop-hook Iron-Law nag on completion claims lacking fresh test evidence (Branch B, per spike). Auditor 2-pass gate (pass 1 found 2 HIGH claim-lexicon false positives via adversarial transcripts, fixed + re-confirmed live pass 2). Live-fire-confirmed against deployed hook.
- [x] **LH-3 — Deploy-Guard + Telemetry + Doc-Sync** (`99ae67b` + `2cee6eb`, ff-merged + deleted) — re-scoped (prose-split DROPPED). Deploy FAILs on unwired enforced hook; hooks emit decision events → `/handoff` gate table; CLAUDE-global describes all 7 hooks; every instrumented hook still fails open. Auditor 1-pass (8/8 gates); 1 MEDIUM fixed post-PASS + re-verified live. Deploy-guard first production run: "OK: all 7 enforced hook(s) present and wired".

**Initiative Hard Rules — all 4 held:** (1) hook malfunction always exits 0; (2) every deny states its unblock condition; (3) no prose leaves always-loaded context before its hook is verified AND deploy-guarded (prose-split dropped — payoff ≈1 line); (4) gate-logging fail-open within fail-open, deploy-guard fails CLOSED naming the missing rule.

---

# OSH — OS Hardening (2026-07-07 → 2026-07-08)

**Status:** COMPLETE — all 6 phases shipped, deployed, merged (`38db2c9`). **Step 0:** approved 2026-07-07.
**Evidence base:** `Artifacts/AUDIT_REPORT.md` (finding IDs HK/AG/CM/RU/SK/TL-*) · **Plans:** `History/Plans/OSH-[1-6]-*`

- [x] **OSH-1 — Restore Hooks Enforcement Layer** (`cedf673`) — deployed + live settings repointed; smoke tests green (PowerShell deny, force-push deny, false-positive allow, SessionStart wrapper, fail-open).
- [x] **OSH-2 — Fix Broken Gates & Capability Mismatches** (`87ba8e9`) — phantom-ref matrix zero; all 8 agent tool-grants correct.
- [x] **OSH-3 — One Name for Every State File** (`9e060c2` + `2147dd8`) — single `History/` casing; DECISION_LOG at root; one residual (project-journal archive scheme) fixed.
- [x] **OSH-4 — Registry Reconciliation & Skill Hygiene** (`23565e7`) — 3 HIGH + 2 MEDIUM fixed + re-verified; stale "17 skills" count fixed.
- [x] **OSH-5 — Token-Economy Diet & Precedence** (`9174be5`) — 19/19 zero-loss blocks + 20/20 Context Boundary cells; corpus 1,827→1,160 lines (−36.5%); CLAUDE-global 12/12 `/claude-md`.
- [x] **OSH-6 — Tooling & Repo Hygiene** (`38db2c9`) — router plugin-skill models fixed; 30/30 tests exit 0; deploy.sh scoped-item rollback (full-wipe footgun fixed); Artifacts root schema-clean; `~/.claude/optional_plugins/` deleted.

**Post-OSH finalization:** git push (origin == local); OSH-1..6 phase plans archived Plans/ → History/Plans/ (12 files).

**Initiative Hard Rules — all held:** (1) every fix traces to a finding ID; (2) zero behavioral loss during dedup (zero-loss map mandatory); (3) hooks remain fail-open after every edit; (4) each phase deploys + passes validation before its gate.

---

# CMD — CLAUDE.md Discipline (2026-07-06)

**Status:** COMPLETE — merged (`a393e2b`, branch deleted). **Step 0:** approved 2026-07-06.
**Plan:** `History/Plans/CMD-Plan.md`
**Deferred → BACKLOG:** `cmd_gemini-parity_1` (GEMINI.md holds old combined content; out of scope per Step 0).

- **CMD-1 — The Standard:** `rules/common/claude-md-standards.md` (split table + 6 scored dimensions + 6 anti-patterns + size caps); `templates/CLAUDE.md.template`; rule registered. `[user-approval]` rubric signed off (caps 150/250 project, 250/400 global).
- **CMD-2 — The Split:** `CLAUDE-global.md` (deployable global, additive-only diff); repo `CLAUDE.md` slimmed to 65 lines; `deploy.sh:127` repointed; DEPLOY.md updated.
- **CMD-3 — The Command:** `commands/claude-md.md` (thin `/claude-md` wrapper over `claude-md-improver`, report-first); registered; `commands/` added to deploy.sh copy+validation (fixed latent `skill-graph.md` undeployed drift); cross-ref 9/9 clean.
- Deployed (backup `~/.claude.backup-20260706-125644`); deploy.sh OSA-2 regression repaired (`1801e24`).

**Hard Rules — all held:** (1) standard references `rules/common/*`, never restates; (2) size caps self-consistent with TOKEN-ECONOMICS; (3) no global content dropped in split; (4) `/claude-md` never auto-edits, reuses existing plugin.

---

# OSA — OS Self-Audit (2026-07-06)

**Status:** COMPLETE — all workstreams merged (`6bdd944`, branch deleted). **Plan:** `History/Plans/Phase-OSA-Plan.md`
**Absorbed:** model-routing audit tool + plugin-registry gap (both were uncommitted drift on `main`).
**Deferred → BACKLOG:** `osa_subagent-tier_1` (subagents may run on wrong tier; runtime may ignore `model:` frontmatter — needs separate Step 0).

- **Workstream A — Model-Routing Verification:** `model_routing_audit.py` verified (table renders; exit 1 on mismatch); committed `73a50da`.
- **Workstream B — Plugin Registry Unification:** converted all 7 optional_plugins to native Claude Code plugins. B0 mapping locked (`[user-approval]`); B1 pilot `code-mcp` (`813a66b`); B2 proof gate PASSED (user installed, skills surface as slash commands); B3 rollout (`5227b29`, all 7 validate); B4 token-saving honesty fix; B5 merged `6bdd944`, 46 tests pass.

**Follow-ups (all resolved):** `osa_model-routing_1` (false positive, `--since` filter added); `osa_plugin-docs_2` (OSA-2 full manifest retire, `1c00fb3`); `osa_plugin-scope_3` (by design: per-project `enabledPlugins`).
