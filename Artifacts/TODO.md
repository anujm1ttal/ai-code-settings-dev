# Active Initiative: Phase OSA — OS Self-Audit

**Status:** DRAFT — awaiting Step 0 approval · **Branch:** `phase-os-audit` (not yet created)
**Plan Reference:** `Artifacts/Plans/Phase-OSA-Plan.md`
**Absorbs:** model-routing audit tool + plugin-registry gap (both were uncommitted drift on `main`)

### Workstream A — Model-Routing Verification (built; verify + commit) ✅
- [x] [auditor] Verify `model_routing_audit.py` — table renders; exit 1 on mismatch (15 honored / 21 violated / 45 runs); evidence `Artifacts/Temp/osa_A1_audit_*.txt`
- [x] [coder] Commit A standalone on `phase-os-audit` — commit `73a50da`, 3 files, `py_compile` clean

### Workstream B — Plugin Registry Unification (convert to real plugins)
- [x] [strategist] `[user-approval]` B0 Step-0: mapping locked (name=dir, omit version, plugin.yaml sidecar) — approved 2026-07-06
- [x] [coder] B1 Pilot: `code-mcp` converted — commit `813a66b`; `claude plugin validate` exit 0
- [x] [coder+auditor] B2 Proof gate: **PASSED** — user installed pilot; `python-mcp`/`typescript-mcp` surface as slash commands
- [x] [coder] B3 Roll out remaining 6 groups — commit `5227b29`; all 7 plugins validate exit 0
- [x] [scribe] B4 Fix token-saving honesty claim — corrected in CLAUDE.md, orchestration.md, templates/README.md (×2), commands/manifest.md
- [x] [auditor] B5 Verify + merge — 7/7 plugins valid, 46 tests pass; merged `6bdd944`, branch deleted

**Phase OSA COMPLETE.** Follow-ups in `Artifacts/BACKLOG.md`: `osa_model-routing_1` (HIGH), `osa_plugin-docs_2` (MED), `osa_plugin-scope_3` (LOW).

**Finding → BACKLOG (not fixed here):** subagents run on wrong tier (haiku vs sonnet/opus); runtime ignores `model:` frontmatter — needs separate Step 0.

---

# Parked Project: `pptx-slide-design` Skill + `ms-office` / `visual-storytelling` Plugins

**Status:** BLOCKED on user Copilot Premium test; Phase 0 ✅ merged; Phase 1 ✅; Phase 2/3 in progress  
**Owner:** strategist → coder → auditor  
**Plan Reference:** `Artifacts/IMPLEMENTATION_PLAN.md`  
**Branch:** `phase-1-pptx-slide-design-contract` (holding; merge pending template refinement + Copilot test)

> [!NOTE]
> **Pick up next session →** `Artifacts/NEXT_SESSION_plugin-registry-gap.md` — the `plugin.yaml`/`project.json → plugins[]` system surfaces **no** skills (bespoke abstraction, no loader). Only `~/.claude/skills/` does. Contains evidence + 2 fix paths + a product decision. Relevant to the active pptx/ms-office plugin work below.

---

## Phase 0 — Office/Storytelling Restructure

### [x] [coder] Scaffold both plugins
**Description:** Create `optional_plugins/ms-office/plugin.yaml` (`ms-office-core`, skills pptx/docx/xlsx, project_types `[pptx,data,manuscript]`) and `optional_plugins/visual-storytelling/plugin.yaml` (`visual-storytelling-core`, skills banana-prompt/pptx-slide-design, project_types `[pptx,youtube]`). Model on `optional_plugins/pptx/plugin.yaml`.  
**Success:** both validate against `plugin_manifest_schema.json`.

### [x] [coder] Move skills + author 3 METADATA.yaml
**Description:** MOVE `optional_plugins/pptx/pptx/`→`ms-office/pptx/`; `skills/docx/`→`ms-office/docx/` (+METADATA.yaml); `skills/xlsx/`→`ms-office/xlsx/` (+METADATA.yaml); `skills/banana-prompt/`→`visual-storytelling/banana-prompt/` (+METADATA.yaml). DELETE `optional_plugins/pptx/plugin.yaml` + empty dir.  
**Success:** 5 skill dirs in place (4 moved, 1 new later); docx/xlsx/banana-prompt each have METADATA.yaml; old `pptx/` plugin gone.

### [x] [coder] Register categories (2 files)
**Description:** `scripts/manifest_validator.py` — add `ms-office`, `visual-storytelling` to `PluginCategory` Literal; add both plugin_ids to `PLUGIN_REGISTRY`, remove `pptx-core`. `optional_plugins/plugin_manifest_schema.json` — add both to `category` enum.  
**Success:** `--list-plugins` shows both plugins; no `pptx-core`.

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

**AUDIT STATUS [2026-07-04]:** FINAL PASS. All 5 gates clean with fresh evidence; `pytest tests/ -q` → 46 passed, exit 0; `--list-plugins` → ms-office-core + visual-storytelling-core, no pptx-core; schema fix verified. Phase 0 terminal. Commit `5a47961` on main.

---

## Phase 1 — Contract

### [x] [strategist] Define design-token map
**Description:** Create `optional_plugins/visual-storytelling/pptx-slide-design/references/design-tokens.md` — map palette/type/grid/spacing/archetypes from `LAYOUT_SPEC.md` + 7-type taxonomy.  
**Success:** covers all 6 visual-composition archetypes + title; 0 new schema files.

### [x] [coder] Verify design-tokens against LAYOUT_SPEC.md
**Success:** 1:1 mapping validated; no missing archetypes/tokens.

**AUDIT STATUS [2026-07-04]:** PASS. All 4 gates clean (success metric, source-integrity spot-check, Hard Rules, scope). Commit `74b621c` on `phase-1-pptx-slide-design-contract`.

**DEFERRED (non-blocking, LOW):** §1.3 citation precision — grid exception should cite both `§Grid Rules` and `§Repeating Patterns`. Fold into Phase 2 SKILL.md authoring pass.

---

## Phase 2 — Skill Build

### [-] [scribe] Author SKILL.md + METADATA.yaml
**Description:** `optional_plugins/visual-storytelling/pptx-slide-design/SKILL.md` (banana-prompt structure, emit concrete-hex-only prompts, NOT abstract token names) + `METADATA.yaml`.  
**Success:** SKILL.md complete (≥400 words), 4-step pipeline aligned with reference-slides.md 13-part anatomy, ready for review.  
**Status Note:** v1→v2 inversion: now emits concrete hex (`#C84A1E`) + named fonts, never abstract token names (`palette.primary`).

### [-] [scribe] Author slide-prompt-templates.md
**Description:** `.../references/slide-prompt-templates.md` — 13-part skeleton (annotated) + 3 worked Input→Output examples, each a single copy-paste block. Skeleton maps 1:1 to reference-slides.md anatomy table.  
**Success:** 13-part skeleton present; 7 layout archetypes via Part 6 variation; 3 examples copy-paste-ready; zero abstract token names in any emitted-prompt example.  
**Status Note:** v1→v2 restructure: 7 separate templates → 1 skeleton + 7 Part-6 variations (cleaner). Concrete hex + fonts only in all examples.  
**Deferred:** User to refine templates via Copilot testing iteration.

---

## Phase 3 — Register + Integrate

### [-] [coder] Register skill in overview
**Description:** Add `pptx-slide-design` to `skills/skills.overview.md` + `optional_plugins/index.md`; confirm in `visual-storytelling/plugin.yaml`.  
**Success:** skill appears in registry.  
**Status Note:** DONE in commit `47d1a25`; mark as complete when Phase 2 SKILL.md auditor-verified.

### [ ] [auditor] Test 3 prompts with Copilot Premium
**Description:** User to paste 3 emitted prompts into PowerPoint Copilot and verify rendering quality.  
**Success:** user approves ≥80% first-pass quality; no major rendering issues.  
**Status Note:** BLOCKED — awaiting user re-engagement with Copilot Premium and real slide iteration.

### [ ] [auditor] Mark project terminal
**Description:** Verify all Phase 2/3 tasks `[x]`; success metrics met; authorize merge.  
**Success:** all tasks complete; ready to merge `phase-1-pptx-slide-design-contract` → `main`; delete branch.  
**Status Note:** BLOCKED on Copilot test gate.

---

## Merge Gates

- **Phase 0:** ✅ all tasks `[x]` + pytest exit 0 → merged `5a47961` to `main`
- **Phase 1/2/3:** Holding on `phase-1-pptx-slide-design-contract` branch pending template refinement + Copilot test

---

## Hard Rules (Auditor Rejects on Violation)

1. `pptx-slide-design`/`banana-prompt` never generate office files or invoke renderers (`ms-office` skills exempt)
2. `pptx-slide-design` reads design tokens from `LAYOUT_SPEC.md` — never redefines
3. Phase 0 registry renames mirrored in test assertions before merge
4. **CRITICAL (v2):** Output prompts MUST use concrete hex + named fonts, NEVER abstract token names. Load-bearing for Copilot rendering.

---

## Notes

- **No implementation on `main`** — all work on `phase-1-pptx-slide-design-contract`
- **Structural twin:** `banana-prompt` is the template for pptx-slide-design plugin structure
- **Reference methodology:** Two user-authored gold-standard slides in `references/reference-slides.md` as fidelity bar
- **Deferred repo hygiene:**
  - `scripts/office/` triplicated (dedup opportunity — noted in report)
  - `plugin.yaml` schema issue (min_model_version; pre-existing repo-wide; low priority)
