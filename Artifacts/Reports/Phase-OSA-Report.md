# Phase OSA — OS Self-Audit · Report

**Status:** Implementation complete; awaiting merge approval · **Branch:** `phase-os-audit`
**Completed:** 2026-07-06

## Outcome

Absorbed two OS-improvement workstreams that were uncommitted drift on `main`, and closed a real architectural gap.

### Workstream A — Model-Routing Verification
- Committed `scripts/model_routing_audit.py` + README + `creative-director` profile (`73a50da`).
- **Finding surfaced:** subagents frequently bypass their assigned tier — **15 honored / 21 violated / 45 runs** (coder honored only 18%, auditor 36%). Runtime ignores `model:` frontmatter.
- **Deferred → BACKLOG:** the runtime bypass itself is likely unfixable from config; needs its own Step 0. Detect-only this phase (Hard Rule 3 honored).

### Workstream B — Plugin Registry Unification
- **Proved the core finding:** native plugins surface skills to the Skill tool; the bespoke `plugin.yaml` format never did. Pilot (`code-mcp`) installed live — `python-mcp`/`typescript-mcp` appeared as slash commands (user-confirmed).
- Converted **all 7 groups** to native Claude Code plugins: root `.claude-plugin/marketplace.json` + a `plugin.json` per group; **17 skills** moved under native `skills/` layout (all git renames **R100 / byte-identical** — Hard Rule 1 honored).
- `plugin.yaml` retained as the AI-OS routing sidecar (Decision C) — clean split: **native = loading, yaml = OS routing metadata**.
- Corrected the dishonest "`auto_include=false` saves ~2,400 tokens" claim in 4 docs — the real loader gate is `enabledPlugins`, not `auto_include`.

## Evidence

| Gate | Result |
|:---|:---|
| `claude plugin validate` | 7/7 plugins + marketplace, exit 0 (advisory version-omit warnings only) |
| `pytest tests/` | 46 passed, exit 0 |
| B2 live proof | User confirmed converted skills surface as slash commands |
| Dangling refs | None in code; only stale historical Artifacts prose |

## Commits

- `73a50da` model-routing audit tool
- `3bce840` phase scaffolding
- `813a66b` code-mcp pilot conversion
- `5227b29` remaining 6 groups
- `8c8fefc` token-claim honesty fix

## Follow-ups (not in this phase)

Filed in `Artifacts/BACKLOG.md`:

1. `osa_model-routing_1` (HIGH) — runtime bypasses assigned tiers; needs Step 0 (harness/runtime issue, not config).
2. `osa_plugin-docs_2` (MEDIUM) — stale pre-native refs in `index.md`, `skills.overview.md`, `DEPLOY.md`, `manifest_validator.py`; reconcile-or-retire the bespoke validator.
3. `osa_plugin-scope_3` (LOW) — permanent per-plugin enable scope (per-project vs global), left open per usage.

The audit tool is now documented in `scripts/README.md` (usage) and
`rules/common/model-routing.md` (Verification section + known-issue note); the
bypass finding is linked from both.
