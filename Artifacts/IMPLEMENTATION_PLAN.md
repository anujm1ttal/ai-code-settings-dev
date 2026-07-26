# Implementation Plan

# Active Initiative: BLR — BACKLOG Lifecycle & Rotation

**Step 0 approved:** 2026-07-26 · **Grill:** [REFACTORED] 2026-07-26 · User-driven (out of OXL sequence)
**Origin:** user compared this repo's BACKLOG against `my_mcp_rhino`'s to find what the OS was
missing. Measured: 7/18 entries here are unrotated corpses (39%); my_mcp_rhino is 1228 lines with
17 per-phase findings sections and a 465-line reference doc (38%) squatting inside. Both repos
independently improvised the missing mechanism — the gap is the OS's.

| Phase | Scope | Spec |
|:---|:---|:---|
| **BLR-1 — BACKLOG Lifecycle & Rotation** (active) | BACKLOG contract (memory-not-queue; stable ID + `OPEN`/`RESOLVED` marker); DLR-parallel rotation (>250 lines OR >20 entries → `History/BACKLOG-archive.md`, never delete) + 1-line eviction clause; `scripts/backlog_audit.py` (stdlib-only, read-only, 4 checks) wired into `/handoff`; dogfood migration of this repo's BACKLOG as the acceptance test | `Artifacts/Plans/BLR-1-Plan.md` |

**Grill outcome [REFACTORED]** — the Step 0 draft treated BACKLOG as a work queue. Refuted by the
user's own data: 8/11 open entries already carry a `Needs:` field and none caused a pickup in
17–19 days; user confirms items don't get picked up at all. BACKLOG's evidenced job is
**searchable institutional memory**. **Struck:** 4-group blocker taxonomy, `Exit:` trigger
vocabulary, `/blueprint` consume point, and any restatement of `orchestration.md:364`/`:365` —
both of those rules were already live while all the measured damage accumulated.

**Known limitation (surfaced, not resolved):** `deploy.sh` excludes `scripts/`, so
`backlog_audit.py` is repo-local and does not help `my_mcp_rhino`. Identical to the deferred
`lh3_telemetry-deploy_1`. Mitigated by zero repo imports (copyable) + the proven graceful-skip
wiring pattern; the deploy-policy decision stays deferred.

**Precedent:** DLR (DECISION_LOG Rotation, `ca03928`) — same artifact class, same growth pattern,
one phase, auditor first-pass PASS.

---
---

# Active Initiative: OXL — OS Cross-Learning

**Step 0 approved:** 2026-07-09 · **Grill:** [REFACTORED] 2026-07-09 (3 phases → 2 — see DECISION_LOG [OXL])
**Origin:** external-pattern review of mattpocock/skills + ralph (2026-07-09 session). Imports:
mechanical task dependencies, vertical-slice decomposition, commit-as-handoff, skill-authoring
anti-pattern craft, `disable-model-invocation` token diet. Cut at grill: AFK/HITL tag (→ folded
into `oxl_afk-runner_1` BACKLOG spec), `/blueprint --foggy` wayfinder mode (→ `oxl_wayfinder_1`,
trigger-conditioned), blanket commit ceremony (→ task-completion commits only).

| Phase | Scope | Spec |
|:---|:---|:---|
| **OXL-1 — Work-Tracking & Planning Conventions + AFK Runner** (active) | `Blocked by:` + optional task IDs (orchestration.md); dispatch independence (implementation-dispatch); vertical-slice + expand–contract (project-planner); commit-as-handoff (task commits); AFK/HITL tag + `/afk` markdown runner + live-fire smoke (grill-2 user override 2026-07-10 — was "spec → BACKLOG"; first consumer: `my_mcp_rhino`) | `Artifacts/Plans/OXL-1-Plan.md` |
| **OXL-2 — Skill-Authoring Craft** (queued) | On-demand `skills/skill-authoring-standards.md` (anti-pattern taxonomy + scored checklist, mirrors claude-md-standards); report-first `disable-model-invocation` audit over 22 commands + plugin skills; apply hides + runtime verify (config ≠ honored); measured token delta. Hard rules: nudge commands (`/handoff`,`/sync`) stay model-visible; no hide without rationale + runtime evidence; standards doc never enters an always-loaded surface | OXL-2-Plan.md at phase start |

**Phase gate after OXL-1:** reassess OXL-2 cost (LH precedent: token-diet wins can evaporate at
small scale — the audit report must show the delta before hides apply).

---
---

# Completed Initiative: DLR — DECISION_LOG Rotation (2026-07-08)

Single phase, shipped + deployed + merged (`d36cfbd`/`6e989eb`). Added the DECISION_LOG
lifecycle rule the OS was missing: **size-threshold rotation** (>400 lines OR >40 entries) of
oldest **resolved** entries to a rolling `Artifacts/History/DECISION_LOG-archive.md` — **never
prune** (it's an audit trail); unresolved entries never rotate. Plus newest-first head-read
discipline in `/sync` + `/handoff`, and the archive scaffold. This repo stayed put (115 lines
< threshold — the policy correctly no-op'd on its own first application). Auditor first-pass
PASS (M1–M4), all 3 Hard Rules held. Detail: `Artifacts/Plans/DLR-Plan.md`,
`Artifacts/Reports/DLR-Report.md`.

---
---

# Completed Initiative: LH — Loop Hardening (2026-07-08)

All 3 phases shipped, deployed, merged to `main` (terminal commit `2cee6eb`). Converted the
OS's prose-enforced gates into harness-enforced loops where the runtime permits. Successor to
OSH; absorbed the deferred HK-G backlog items. Grounding: loop-engineering assessment
2026-07-08 — a rule the harness enforces beats one the model chooses to obey.

| Phase | Shipped | Commit |
|:---|:---|:---|
| LH-1 | Mechanical hooks: auto-lint fix-before-proceeding feedback; scratch-gate + commit-trailer PreToolUse denies; handoff-nudge Stop hook; empirical Stop-block spike (all 3 block variants prevent turn-end but unsafely → LH-2 uses feedback) | `14716e4` |
| LH-2 | Evidence gate: Stop-hook Iron-Law nag on completion claims lacking fresh test evidence (Branch B — additionalContext only, per spike). Detection = claim lexicon + source-edit + tool_use_id-correlated fresh-evidence | `541362c` |
| LH-3 | Deploy-guard (`enforced-rules.json` + deploy.sh FAILs on an unwired enforced hook); gate telemetry (instrument → `gate_telemetry.py` → `/handoff`); correctness doc-sync | `99ae67b`/`2cee6eb` |

**Live-fire confirmed this session**: the handoff nudge and the evidence gate both fired on the
orchestrator's own turns; the deploy-guard reported "all 7 enforced hooks wired" on its first
production run.

**Binding decisions** (grill + recon, in `Plans/LH-*-Plan.md` + `DECISION_LOG.md` [LH]): no
PostToolUse blocking exists (state machine CUT); hard-deny only at PreToolUse; TODO-authority
hook KILLED (no caller identity in hook input); HK-G2/PreCompact unimplementable; Stop CAN
block but unsafely (LH-2 uses feedback); all gates fail-open on script error.

**Consciously dropped** (recorded, not overlooked): the initiative's original headline —
reclaim always-loaded prose via hook enforcement. Post-grill the delete-eligible set shrank to
~1 line (only 2 deny-hooks survived), below the cost of a `gemini-only.md` drift surface. The
enforcement wins stand; the token-diet win did not materialize at this scale.
**Cut at grill:** blocking-lint state machine; guard-todo-authority.js; HK-G2. **Deferred
(BACKLOG):** global gate-telemetry deployment (`lh3_telemetry-deploy_1`); GEMINI.md parity.
Phase plans → archive to `Artifacts/History/Plans/LH-[1-3]-*` at handoff.

---
---

# Completed Initiative: OSH — OS Hardening (2026-07-07 → 2026-07-08)

All 6 phases shipped, deployed, merged to `main` (terminal commit `38db2c9`). Remediated the
2026-07-07 full-setup audit: hooks enforcement restored, agent gates fixed, state-file naming
unified, registries reconciled, always-loaded corpus −36.5%, tooling + real test suite (30
tests). Phase plans archived → `Artifacts/History/Plans/OSH-[1-6]-*`; findings base
`Artifacts/AUDIT_REPORT.md`; decisions in `DECISION_LOG.md` [OSH] entries.
**Deferred → LH:** HK-G1/G3/G4 (scheduled LH-1); HK-G2 struck (unimplementable). **Still
deferred:** GEMINI.md parity (partially addressed by LH-3's gemini-only file).

---
---

# Parked Plan: `pptx-slide-design` Skill + `ms-office` / `visual-storytelling` Plugins

**Project type:** `skill-authoring` · **Owner:** strategist · **Status:** Phase 0 pending branch init

> Prior content (Global Skill Audit, Phase 12, `design-prompts` single-plugin draft) superseded. Pruned per Plan Pruning HARD-GATE; recoverable from git history.

---

## 1. Purpose

Create `pptx-slide-design` — a skill generating copy-paste-ready slide-design prompts for **Copilot Premium (Opus) in PowerPoint**, consuming the design system `creative-director` emits (`Artifacts/LAYOUT_SPEC.md`).

**Taxonomy (this revision):** two plugins split by theme.

| Plugin (`plugin_id`) | Skills | Theme |
|:---|:---|:---|
| `ms-office` (`ms-office-core`) | `pptx`, `docx`, `xlsx` | OOXML file manipulation (shared `scripts/office/` engine) |
| `visual-storytelling` (`visual-storytelling-core`) | `banana-prompt` (registered now); `pptx-slide-design` added Phase 2 → **1 skill now, 2 after Phase 2** | Copy-paste prompt generation for external AI renderers |

**Step 0 (approved):** VALUE_CHECK — converts design system + slide intent into a Copilot-ready prompt. MINIMALISM — `SKILL.md` + 2 refs + 3 examples, consumes `LAYOUT_SPEC.md`, no renderer. Gates — consume `LAYOUT_SPEC.md`; 7-type taxonomy; two-plugin split.

**Hard Rules (auditor rejects on violation):**
1. `pptx-slide-design`/`banana-prompt` never generate `.pptx`/`.docx`/`.xlsx` or invoke renderers *(the `ms-office` skills ARE the renderers — exempt)*.
2. `pptx-slide-design` reads design tokens from `LAYOUT_SPEC.md` — never redefines.
3. Phase 0 must not break `manifest_validator.py` tests — every registry rename mirrored in test assertions before merge.

---

## 2. Re-Recon Findings (current physical state)

| Skill | Current location | In plugin system? | `METADATA.yaml`? | `scripts/office/`? |
|:---|:---|:---:|:---:|:---:|
| `pptx` | `optional_plugins/pptx/pptx/` | Yes (`pptx-core`) | **Yes** | own copy |
| `docx` | `skills/docx/` | No (singleton) | **No — author** | own copy |
| `xlsx` | `skills/xlsx/` | No (singleton) | **No — author** | own copy |
| `banana-prompt` | `skills/banana-prompt/` | No (singleton) | **No — author** | n/a |
| `pptx-slide-design` | — (new) | — | **No — author (Phase 2)** | n/a |

**Key findings:**
- **docx/xlsx are `skills/` singletons, NOT plugins** (contra any tree impression). No plugin references exist for them anywhere in live registry (grep `docx`/`xlsx` as plugin = 0 hits outside stale Artifacts + one internal `api-guide.md`). They are also absent from `DEFAULT_SKILLS` and auto-load nowhere today → **pure on-demand**.
- **METADATA.yaml to author in Phase 0: 3** (docx, xlsx, banana-prompt). `pptx` already has one (moves as-is). `pptx-slide-design` authored in Phase 2.
- **`scripts/office/` is triplicated** — docx, xlsx, and pptx each bundle a full independent copy (~50 schema files + identical `validators/{base,docx,pptx,redlining}.py` + pack/unpack/validate/soffice). **Dedup opportunity** (single `scripts/office/` at `ms-office/` root). **Deferred — reported, not fixed** (out of Phase 0 scope; behavior-preserving move first, dedup as a follow-up phase).

---

## 3. Routing (proposed + justified)

| Plugin | `project_types` | Justification |
|:---|:---|:---|
| `ms-office-core` | `["pptx", "data", "manuscript"]` | pptx→whole-deck renderer (preserves `pptx-core`); data→xlsx (Excel/financial modeling); manuscript→docx (Word production). **`code` dropped** — code projects manipulate source, not Office binaries; Office tooling is noise there → available on-demand only. |
| `visual-storytelling-core` | `["pptx", "youtube"]` | banana-prompt→youtube thumbnails + pptx deck imagery; pptx-slide-design→pptx slides. |

**Atomicity tradeoff (flag):** plugins are atomic. A `manuscript` project auto-loads pptx+xlsx it may not need; `data` auto-loads pptx+docx; `youtube` auto-loads pptx-slide-design (~200 tokens over-inclusion each). Accepted — load-policy is per-skill-global, and metadata cost is negligible (heavy `scripts/` never enter context). `pptx` projects legitimately want both plugins (renderer + prompt-gen).

**Behavior change to note:** docx/xlsx move from pure on-demand → auto for data/manuscript. Intended (makes document tooling discoverable for those types).

---

## 4. Phase 0 — Office/Storytelling Restructure (RUNS FIRST)

**Goal:** Stand up both plugins, relocate 4 skills, author 3 METADATA.yaml. All later phases depend on final paths.

### 4.1 Create / Move / Retire

| Action | Target |
|:---|:---|
| NEW | `optional_plugins/ms-office/plugin.yaml` (`ms-office-core`, cat `ms-office`, skills pptx/docx/xlsx, project_types `[pptx,data,manuscript]`, keywords: office, ooxml, powerpoint, word, excel, document, spreadsheet, deck) |
| NEW | `optional_plugins/visual-storytelling/plugin.yaml` (`visual-storytelling-core`, cat `visual-storytelling`, skills banana-prompt/pptx-slide-design, project_types `[pptx,youtube]`, keywords: prompt, image, thumbnail, slide, storytelling, renderer, copilot) |
| MOVE | `optional_plugins/pptx/pptx/` → `optional_plugins/ms-office/pptx/` |
| MOVE | `skills/docx/` → `optional_plugins/ms-office/docx/` + author `METADATA.yaml` |
| MOVE | `skills/xlsx/` → `optional_plugins/ms-office/xlsx/` + author `METADATA.yaml` |
| MOVE | `skills/banana-prompt/` → `optional_plugins/visual-storytelling/banana-prompt/` + author `METADATA.yaml` |
| RETIRE | delete `optional_plugins/pptx/plugin.yaml` + empty `optional_plugins/pptx/` dir |

Model METADATA.yaml on `optional_plugins/ms-office/pptx/METADATA.yaml` (the moved pptx copy).

### 4.2 Impact Map — Exact Coder Worklist (live edits only)

**A. Plugin category registration (2 files — REQUIRED):**
| File | Edit |
|:---|:---|
| `scripts/manifest_validator.py` | L23 `PluginCategory` Literal: add `"ms-office"`, `"visual-storytelling"` (leave `pptx` — now unused-as-category, harmless). `PLUGIN_REGISTRY` (L40–71): add `ms-office-core` (skills pptx/docx/xlsx, project_types `[pptx,data,manuscript]`) + `visual-storytelling-core` (skills banana-prompt/pptx-slide-design, project_types `[pptx,youtube]`); **remove `pptx-core`**. |
| `optional_plugins/plugin_manifest_schema.json` | L17 `category` enum: add `"ms-office"`, `"visual-storytelling"`. |

**B. `pptx-core` plugin references (REQUIRED):**
| File | Edit |
|:---|:---|
| `optional_plugins/pptx/plugin.yaml` | DELETE (retired) |
| `templates/project-pptx.json` | `plugins`: replace `pptx-core` with BOTH `ms-office-core` + `visual-storytelling-core` |
| `optional_plugins/index.md` | Quick-Ref table: replace `pptx-core` row with `ms-office-core` (3 skills) + `visual-storytelling-core` (1 skill now: banana-prompt; 2 after Phase 2 adds pptx-slide-design); Directory-Structure tree: `pptx/` → `ms-office/` + `visual-storytelling/`; skill-count totals |
| `optional_plugins/README.md` | Migration-guide references to pptx/banana-prompt |

**C. Test assertions hardcoding plugin_ids (2 files — REQUIRED, will fail CI otherwise):**
| File | Edit |
|:---|:---|
| `tests/test_manifest_validator_v2.py` | L455 `categories` set assertion — read full `test_plugin_registry` (L451–471); L461–465 `skills_by_plugin` dict: remove `"pptx-core": 1`, add `"ms-office-core": 3`, `"visual-storytelling-core": 2` |
| `tests/test_v1_v2_migration.py` | L283 tuple `("pptx", "pptx-core")` → `("pptx", "ms-office-core")` (membership assert L298 passes; visual-storytelling-core also present) |

**D. `banana-prompt`/`docx`/`xlsx` singleton references (REQUIRED):**
| File | Edit |
|:---|:---|
| `skills/skills.overview.md` | Move `banana-prompt` (L38), `docx`, `xlsx` (L26–27) out of core `skills/` listing; note plugin locations |
| `CLAUDE.md` | L51 `banana-prompt` registry row — note plugin location |
| `GEMINI.md` | Mirror of CLAUDE.md — same edit |
| `optional_plugins/index.md` | (same file as B) add banana-prompt/pptx-slide-design under visual-storytelling; docx/xlsx under ms-office |

**E. Templates — consistency (RECOMMENDED):**
| File | Edit |
|:---|:---|
| `templates/project-youtube.json` | add `visual-storytelling-core` to `plugins` (preserve banana-prompt for youtube) |
| `templates/project-data.json` | add `ms-office-core` to `plugins` |
| `templates/project-manuscript.json` | add `ms-office-core` to `plugins` |

**F. Verify-only / DO NOT EDIT:**
- `scripts/phase_11_2_update_templates.py`, `scripts/migrate_skills_to_plugins.py` — historical one-shot migration scripts; verify only.
- `hooks/*`, remaining `skills/docx|xlsx` internal `scripts/office/`, `commands/*.md`, `agents/*.md`, `rules/common/orchestration.md`, `cheatsheet.md`, `README.md` — reference `.pptx`/`python-pptx`/skill-name/project_type (unchanged); no plugin_id. **No edit.**
- `Artifacts/History/PHASE_11_*`, `Artifacts/History/SKILL_*`, `Artifacts/History/REGISTRY_HEALTH_REPORT.md` — stale reports (archived OSH-6), skip.

### 4.3 Success Metric
`python scripts/manifest_validator.py --list-plugins` shows `ms-office-core` (3 skills) + `visual-storytelling-core` (1 skill now: banana-prompt; → 2 after Phase 2 adds pptx-slide-design), no `pptx-core`; `pytest tests/test_manifest_validator_v2.py tests/test_v1_v2_migration.py` exits 0; grep `pptx-core` = 0 outside stale Artifacts.
**Owner:** coder + auditor. **Deps:** none (runs first).

---

## 5. Phase 1 — Contract

| Action | File |
|:---|:---|
| NEW | `optional_plugins/visual-storytelling/pptx-slide-design/references/design-tokens.md` — field map from `LAYOUT_SPEC.md` (palette+hex, type scale, grid/margins, spacing unit, archetypes) + 7-type taxonomy |

- **Deps:** Phase 0. **Success:** covers all 6 visual-composition archetypes + title; 0 new schema files. **Owner:** strategist + creative-director.

**7-type taxonomy:** Title/Section · Hero+Evidence · Two-Column Compare · Grid of Cards · Top Summary+Detail · Left Narrative+Right Visual · Full-Bleed Visual.

---

## 6. Phase 2 — Skill Build

| Action | File |
|:---|:---|
| NEW | `optional_plugins/visual-storytelling/pptx-slide-design/SKILL.md` — banana-prompt-shaped pipeline + frontmatter + output format |
| NEW | `optional_plugins/visual-storytelling/pptx-slide-design/METADATA.yaml` |
| NEW | `optional_plugins/visual-storytelling/pptx-slide-design/references/slide-prompt-templates.md` — 7 slot templates + 3 worked Input→Output examples |

- **Deps:** Phase 1. **Success:** 7 templates; each of 3 examples a single copy-paste block referencing tokens by name. **Owner:** scribe + skill-creator.

---

## 7. Phase 3 — Register + Integrate

| Action | File |
|:---|:---|
| EDIT | `optional_plugins/visual-storytelling/plugin.yaml` — confirm `pptx-slide-design` present |
| EDIT | `skills/skills.overview.md` / `optional_plugins/index.md` — list `pptx-slide-design` |
| TEST | 3 test prompts, user-reviewed against Copilot Premium output |

- **Deps:** Phase 2. **Success:** user approves ≥80% first-pass quality; skill in registry. **Owner:** skill-creator + user.

---

## 8. Git Branch Init

```bash
git checkout main
git pull
git checkout -b phase-0-office-storytelling-restructure
```

- **Branch:** `phase-0-office-storytelling-restructure`
- **Merge gate:** auditor marks final Phase 0 task `[x]` AND `pytest` on both validator test files exits 0.
- **Cleanup:** delete branch after merge.

---

## 9. Blast-Radius Summary

| Reference | Files matched | Live edits | Verify-only | Stale/skip |
|:---|:---:|:---:|:---:|:---:|
| `pptx-core` (plugin) | 12 | 4 | 1 | ~2 reports |
| `banana-prompt` | 16 | 4 (shared) | 2 tests | ~6 reports |
| `docx`/`xlsx` (plugin) | 3 | 0 new (folded into skills.overview + index) | — | 2 reports + 1 internal |
| Category + PLUGIN_REGISTRY | — | 2 | — | — |
| Test plugin_id hardcodes | 2 | 2 | — | — |

**Unique Phase-0 live-edit files: ~10 required** (manifest_validator.py, plugin_manifest_schema.json, project-pptx.json, index.md, README.md, skills.overview.md, CLAUDE.md, GEMINI.md, 2 test files) **+ 3 recommended templates** (youtube/data/manuscript).
**New files: 5** (2 plugin.yaml + 3 METADATA.yaml). **Moves: 4. Retires: 1.**
