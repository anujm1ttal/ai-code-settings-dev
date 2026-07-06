# Phase OSA-2 — Retire the Bespoke Manifest System

**Type:** `os-maintenance` (delete-heavy) · **Owner:** strategist → coder → auditor
**Branch:** `phase-osa2-retire-manifest` · **Status:** DRAFT — awaiting scope approval
**Decision:** Option 3 (full retire) — `manifest_validator.py`, `project.json`, `/manifest`, and `plugin.yaml` are vestigial after the native-plugin conversion. Native `plugin.json` + `enabledPlugins` is canonical; project-type routing survives as concierge guidance, not a validated file.

## Hard Rules (auditor rejects on violation)

1. **No skill content touched** — only registry/manifest scaffolding is removed.
2. **Remaining test suite stays green** — deleting the 2 manifest test files must leave the rest of `pytest tests/` at exit 0 (no orphaned imports).
3. **No runtime breakage** — `skill_graph_analyzer.py` and every hook must still run after deletions (verified, not assumed).

## Scope — DELETE (25 files)

- `scripts/manifest_validator.py`
- `scripts/phase_11_2_copy_skills.py`, `scripts/phase_11_2_populate_plugins.py` (dead one-shot migration)
- `optional_plugins/plugin_manifest_schema.json`
- `optional_plugins/*/plugin.yaml` (×7)
- `tests/test_manifest_validator_v2.py`, `tests/test_v1_v2_migration.py`
- `commands/manifest.md`
- `templates/project.schema.json`, `templates/project-*.json` (×9)
- `project.json` (root)

## Scope — EDIT (remove references, ~14 files)

- `scripts/skill_graph_analyzer.py` — inline `FOUNDATIONAL_SKILLS` (it currently regex-reads it from the deleted validator; degrades gracefully but should be self-contained)
- `scripts/README.md` — drop the `manifest_validator.py` section
- `commands/skill-graph.md`, `rules/common/orchestration.md`, `rules/common/model-routing.md` — drop `/manifest` + the "Project Configuration & Skill Manifest" section + project.json boot step
- `CLAUDE.md`, `GEMINI.md` — drop `/manifest` from command tables, the "Manifest Loading (project.json)" section, and the boot/validation step
- `README.md`, `cheatsheet.md`, `DEPLOY.md`, `optional_plugins/index.md`, `optional_plugins/README.md`, `hooks/README.md` — remove manifest/validator references
- `Artifacts/TODO.md`, `Artifacts/BACKLOG.md` — close `osa_plugin-docs_2`

## Two decisions for sign-off

**A — `hooks/guard-commit-evidence.js`** reads `project.json` for its opt-in flag. It's **dormant** (`enforce_commit_evidence` unset) and fails open if the file is gone.
- **Recommend: delete the hook + its `hooks/README.md` row.** Retire the dormant feature with the manifest; re-add via `settings.json` later if wanted.
- Alt: keep it (harmless but permanently vestigial).

**B — `optional_plugins/index.md` + `README.md`** are the hand-maintained plugin catalog (bespoke names).
- **Recommend: slim-rewrite** to describe the native plugins + point at `.claude-plugin/marketplace.json` as source of truth.
- Alt: delete them entirely (marketplace.json self-documents).

## Verification (B-gate before merge)

- `pytest tests/` → exit 0 (with 2 files gone)
- `python scripts/skill_graph_analyzer.py` → runs, no crash
- `grep -rn 'manifest_validator\|project.json\|plugin.yaml\|/manifest'` over source (excl. Artifacts/History) → only intentional residue
- Every hook executes (dry-run guard hooks)

## Sequence

Delete → fix `skill_graph_analyzer` → prune docs → verify → merge `phase-osa2-retire-manifest` → `main`.
