# Project TODO: `pptx-slide-design` Skill + `ms-office` / `visual-storytelling` Plugins

**Status:** Phase 1 complete (Contract) — Phase 2 Skill Build REWORK in progress
**Owner:** strategist → coder → auditor
**Plan Reference:** `Artifacts/IMPLEMENTATION_PLAN.md`
**Branch:** `phase-1-pptx-slide-design-contract`

---

## Phase 0 — Office/Storytelling Restructure (RUNS FIRST)

### [x] [coder] Scaffold both plugins
**Description:** Create `optional_plugins/ms-office/plugin.yaml` (`ms-office-core`, skills pptx/docx/xlsx, project_types `[pptx,data,manuscript]`) and `optional_plugins/visual-storytelling/plugin.yaml` (`visual-storytelling-core`, skills banana-prompt/pptx-slide-design, project_types `[pptx,youtube]`). Model on `optional_plugins/pptx/plugin.yaml`.
**Success:** both validate against `plugin_manifest_schema.json`.

### [x] [coder] Move skills + author 3 METADATA.yaml
**Description:** MOVE `optional_plugins/pptx/pptx/`→`ms-office/pptx/`; `skills/docx/`→`ms-office/docx/` (+METADATA.yaml); `skills/xlsx/`→`ms-office/xlsx/` (+METADATA.yaml); `skills/banana-prompt/`→`visual-storytelling/banana-prompt/` (+METADATA.yaml). DELETE `optional_plugins/pptx/plugin.yaml` + empty dir.
**Success:** 5 skill dirs in place (4 moved, 1 new later); docx/xlsx/banana-prompt each have METADATA.yaml; old `pptx/` plugin gone.

### [x] [coder] Register categories (2 files)
**Description:** `scripts/manifest_validator.py` — add `ms-office`, `visual-storytelling` to `PluginCategory` Literal; add both plugin_ids to `PLUGIN_REGISTRY`, remove `pptx-core`. `optional_plugins/plugin_manifest_schema.json` — add both to `category` enum.
**Success:** `--list-plugins` shows both plugins; no `pptx-core`.
**AUDIT [2026-07-04, RESOLVED]:** MEDIUM finding (schema enum dropped `"pptx"`) fixed -- `"pptx"` re-added to `optional_plugins/plugin_manifest_schema.json` category enum (1-line diff, verified). `pytest tests/ -q` re-confirmed 46 passed, exit 0 (via project `.venv`). Gate 3 clean. Task closed.

### [x] [coder] Update test assertions (2 files)
**Description:** `tests/test_manifest_validator_v2.py` L451–471 `test_plugin_registry`: update `categories` set + `skills_by_plugin` (remove `pptx-core:1`; add `ms-office-core:3`, `visual-storytelling-core:2`). `tests/test_v1_v2_migration.py` L283: `("pptx","pptx-core")` → `("pptx","ms-office-core")`.
**Success:** assertions reflect new plugin_ids.

### [x] [coder] Update registry docs + templates
**Description:** REQUIRED — `templates/project-pptx.json` (both plugins), `optional_plugins/index.md` (table+tree+skill listing), `optional_plugins/README.md`, `skills/skills.overview.md` (move banana-prompt/docx/xlsx out of core), `CLAUDE.md` L51, `GEMINI.md`. RECOMMENDED — add plugin to `templates/project-youtube.json` (visual-storytelling-core), `project-data.json` + `project-manuscript.json` (ms-office-core).
**Success:** grep `pptx-core` = 0 outside stale Artifacts.

### [x] [coder] Verify migration
**Description:** `pytest tests/test_manifest_validator_v2.py tests/test_v1_v2_migration.py` + `python scripts/manifest_validator.py --list-plugins`.
**Success:** pytest exit 0; validator lists `ms-office-core` (3) + `visual-storytelling-core` (2).

### [x] [auditor] Mark Phase 0 terminal
**Success:** all Phase 0 tasks `[x]`; tests exit 0; no `pptx-core` regressions.

**AUDIT STATUS [2026-07-04]:** FINAL PASS. All 5 gates clean with fresh evidence, re-verified via project `.venv` after the schema fix: `pytest tests/ -q` -> 46 passed, exit 0; `--list-plugins` -> ms-office-core (pptx, docx, xlsx), visual-storytelling-core (banana-prompt), no pptx-core; `git diff optional_plugins/plugin_manifest_schema.json` -> exactly the 1-line enum restoration, no other drift. Phase 0 terminal. Merge gate satisfied per `Artifacts/IMPLEMENTATION_PLAN.md` Section 8 -- commit authorization remains a separate, user-gated step (auditor does not commit).

**DOC-SYNC NOTE [2026-07-04, RESOLVED by strategist]:** `visual-storytelling` has **1 registered skill now** (banana-prompt); becomes **2 after Phase 2** adds pptx-slide-design. Stale "2 skills" prose in `Artifacts/IMPLEMENTATION_PLAN.md` (§1, §4.2 index.md row, §4.3 success metric) corrected to "1 now, 2 after Phase 2." Registered code count remains 1 until Phase 2 — no code change.

---

## Phase 1 — Contract

### [x] [strategist] Define design-token map
**Description:** Create `optional_plugins/visual-storytelling/pptx-slide-design/references/design-tokens.md` — map palette/type/grid/spacing/archetypes from `LAYOUT_SPEC.md` + 7-type taxonomy.
**Success:** covers all 6 visual-composition archetypes + title; 0 new schema files.

### [x] [coder] Verify design-tokens against LAYOUT_SPEC.md
**Success:** 1:1 mapping validated; no missing archetypes/tokens.

**AUDIT STATUS [2026-07-04]:** PASS. All 4 gates clean (success metric, source-integrity spot-check, Hard Rules, scope). `find` confirms 0 new JSON schema files; 7-type taxonomy confirmed (Title + 6 visual-composition archetypes, 1:1 match against `SKILL.md` Repeating Patterns table). No Phase 1 auditor task exists in this phase's task list — see Phase 1 header for terminal sign-off. Authorized to proceed with commit (user-gated).

**DEFERRED (non-blocking, LOW):** §1.3 `grid.columns=1` exception cites only `§Grid Rules`; should also cite `§Repeating Patterns` (Hero+Evidence / Full-Bleed Visual structures are the actual grounding for the stacked-layout exception). Citation-precision only — underlying claim is source-traceable, not fabricated. Fold into Phase 2 SKILL.md authoring pass.

---

## Phase 2 — Skill Build (REWORK: Rebuilt Around Reference-Slides 13-Part Anatomy)

### [-] REWORK [scribe] Author SKILL.md + METADATA.yaml
**Description:** `optional_plugins/visual-storytelling/pptx-slide-design/SKILL.md` (banana-prompt structure, rebuilt to emit concrete-hex-only prompts, NOT abstract token names) + `METADATA.yaml`.
**Success:** SKILL.md complete (≥400 words), 4-step pipeline aligned with reference-slides.md 13-part anatomy, ready for review.
**REWORK NOTE [2026-07-04]:** v1 emitted abstract token names (`palette.primary`) INTO prompts; v2 emits concrete hex (`#C84A1E`). Core inversion complete.

### [-] REWORK [scribe] Author slide-prompt-templates.md
**Description:** `.../references/slide-prompt-templates.md` — 13-part skeleton (annotated) + 3 worked Input→Output examples, each a single copy-paste block. Skeleton maps 1:1 to reference-slides.md anatomy table.
**Success:** 13-part skeleton present; 7 layout archetypes (Title/Section, Hero+Evidence, Two-Column Compare, Grid of Cards, Top Summary+Detail, Left Narrative+Right Visual, Full-Bleed Visual) via Part 6 variation; 3 examples copy-paste-ready; **zero abstract token names** in any emitted-prompt example.
**REWORK NOTE [2026-07-04]:** v1 had "7 templates" as separate files; v2 has 1 skeleton + 7 Part-6 variations (cleaner). v1 had token names in examples; v2 has concrete hex + fonts only.

---

## Phase 3 — Register + Integrate

### [-] [coder] Register skill in overview
**Description:** Add `pptx-slide-design` to `skills/skills.overview.md` + `optional_plugins/index.md`; confirm in `visual-storytelling/plugin.yaml`.
**Success:** skill appears in registry.

### [ ] [auditor] Test 3 prompts with Copilot Premium
**Success:** user approves ≥80% first-pass quality; no major rendering issues.

### [ ] [auditor] Mark project terminal
**Success:** all tasks `[x]`; success metrics met; ready to merge.

---

## Merge Gates

- **Phase 0:** all tasks `[x]` + `pytest` exit 0 → merge `phase-0-office-storytelling-restructure` to `main`, delete branch.
- Subsequent phases branch from `main` per lifecycle.

---

## Notes

- **Re-recon:** docx/xlsx are `skills/` singletons (no METADATA.yaml); pptx already a plugin skill; `scripts/office/` triplicated (dedup deferred — report only).
- **Structural twin for pptx-slide-design:** `banana-prompt` (now `optional_plugins/visual-storytelling/banana-prompt/`).
- **No implementation on `main`.**
- **Hard Rules (auditor rejects on violation):**
  1. `pptx-slide-design`/`banana-prompt` never generate office files or invoke renderers (`ms-office` skills exempt).
  2. `pptx-slide-design` reads design tokens from `LAYOUT_SPEC.md` — never redefines.
  3. Phase 0 registry renames mirrored in test assertions before merge.
  4. **CRITICAL (v2):** Output prompts MUST use concrete hex + named fonts, NEVER abstract token names. This is load-bearing for Copilot rendering.
- **Routing tradeoff:** plugins atomic — data/manuscript auto-load extra ms-office skills, youtube auto-loads pptx-slide-design (~200 tokens each, accepted).
