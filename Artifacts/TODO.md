# TODO — Active & Queued Work

**Updated:** 2026-07-09 · **Branch:** `main` (clean, pushed)

Completed initiatives (LH, OSH, CMD, OSA, DLR) archived → `Artifacts/History/COMPLETED_INITIATIVES.md`.
Deferred findings live in `Artifacts/BACKLOG.md`.

---

# Active Initiative: OXL — OS Cross-Learning

**Status:** OXL-1 kicked off · **Step 0:** approved 2026-07-09 · **Grill:** [REFACTORED] 2026-07-09
**Plans:** `Artifacts/Plans/OXL-1-Plan.md` + `OXL-1-TODO.md` · OXL-2 queued (phase gate after OXL-1)
**Origin:** mattpocock/skills + ralph pattern import — see IMPLEMENTATION_PLAN.md + DECISION_LOG [OXL]

- [ ] [coder] **OXL-1 — Work-Tracking & Planning Conventions** (branch `phase-oxl-1-conventions`) — Success: 5 plan metrics (format spec + example, dispatch cite, slice test, `oxl_afk-runner_1` 6-element spec, deploy exit 0) — tasks: `Plans/OXL-1-TODO.md`
- [ ] **OXL-2 — Skill-Authoring Craft** (queued; gate: reassess after OXL-1) — Success: standards doc ≤150 lines on-demand; audit report covers 100% of commands; hides runtime-verified with measured token delta

### Initiative Hard Rules (Auditor Rejects on Violation)
1. New task-format fields optional everywhere; `[ ]`/`[-]`/`[x]` semantics and TODO authority untouched
2. No runner/hook/script code ships in OXL — specs and markdown only
3. No skill/command hidden without written rationale + runtime verification; `/handoff` + `/sync` stay model-visible
4. Authoring-standards doc lives on-demand only — never in rules/common/ or any always-loaded surface

---

# Completed Initiative: VSE — Visual Storytelling Enhancement

**Status:** VSE COMPLETE (both phases closed, plugin v2.2.0 live) · **Step 0:** approved 2026-07-07
**Plans:** VSE-2 → `Artifacts/Plans/VSE-2-Plan.md` + `VSE-2-TODO.md` · VSE-1 (complete) archived → `Artifacts/History/Plans/` + `History/Reports/VSE-1-Report.md`
**Origin:** ui-ux-pro-max-skill architecture pattern (data-fied design knowledge + executable output validation), applied to `pptx-slide-design` only. banana-prompt out of scope. No search engine (deferred until library >25 entries).
**Sequencing:** VSE-1 → VSE-2 (VSE-2 requires `/grill` + Interface-First `[user-approval]` before kickoff)

- [x] [strategist] **VSE Initiative Kickoff (/blueprint VSE-1)** — decompose Phase 1 tasks, create git branch · Success: phase-vse-1-quality-gates branch created, Tasks decomposed to Artifacts/Plans/VSE-1-TODO.md · **2026-07-09 auditor-verified at phase gate: branch created, tasks decomposed, kickoff complete.**
- [x] **VSE-1 — Executable Quality Gates** (branch `phase-vse-1-quality-gates`, cut from `main` post-OSH) — Success: validate_prompt.py 2/2 gold pass + 3/3 seeded-bad fail; contrast_check.py pass/fail pair correct; pytest exit 0; zero new deps · **2026-07-09 auditor CLOSE: all metrics met fresh (119/119 pytest), install+live-fire verified, post-audit fixes (palette darken, template markers, VP-04 comment) re-confirmed; HR1 residual deferred to VSE-2. Merge authorized.**
- [x] **VSE-2 (REFACTORED) — Archetype Extraction + Tiny Profile Seed** (branch `phase-vse-2-archetype-data`, merged `c569a37`) — Success: 7 archetypes in `archetypes.yaml` (defs in exactly 1 file); 2-3 contrast-gated profiles; `pytest tests/` exit 0 · **2026-07-09 auditor CLOSE: install sha `c569a377...` matches merge commit exactly; live-fire from installed cache — static-grid exit 0, sequential exit 1/"section 8"; 131/131 pytest on `main`. Report: `Artifacts/Reports/VSE-2-Report.md`.**

### Initiative Hard Rules (Auditor Rejects on Violation)
1. Validators check invariants only — no coupling to 13-part section wording/order (Copilot render test still pending)
2. Skill never generates files or invokes renderers; validation is text-only
3. No entry marked `vetted` without contrast_check evidence; generator output always bannered DRAFT
4. Phase close = plugin re-install + live verification (plugin scripts do NOT ship via deploy.sh)

---

# Parked Project: `pptx-slide-design` Skill + `ms-office` / `visual-storytelling` Plugins

**Status:** PARKED — BLOCKED on user Copilot Premium test. Phase 0 ✅ merged (`5a47961`); Phase 1 ✅ (`74b621c`); Phase 2 content landed on `main`; Phase 3 blocked on Copilot test only.
**Owner:** strategist → coder → auditor · **Branch:** ~~`phase-1-pptx-slide-design-contract`~~ deleted — content reached `main` via plugin conversion (`5227b29`) + OSH-4 (`23565e7`); SKILL.md + plugin.json at v2.0.0.
**Scope reconciled at VSE-1 kickoff (2026-07-09):** VSE owns all quality-gate work for this skill (validators, enforcement wiring, v2.1.0 bump). This section retains ONLY the Copilot Premium render test (Phase 3) — the sole remaining blocker.

**Done (archived detail):**
- **Phase 0 — Office/Storytelling Restructure** ✅ merged `5a47961` — scaffolded `ms-office` + `visual-storytelling` plugins, moved skills, registered categories, tests exit 0 (46 passed), no `pptx-core` regressions. *(NB: bespoke manifest system since retired in OSA-2 — plugin.yaml/schema references are historical.)*
- **Phase 1 — Contract** ✅ PASS `74b621c` — `design-tokens.md` maps palette/type/grid/spacing/archetypes 1:1 from LAYOUT_SPEC.md; covers all 6 visual-composition archetypes + title. Deferred LOW: §1.3 citation precision (fold into Phase 2).

**Open:**

### Phase 2 — Skill Build
- [-] [scribe] Author SKILL.md + METADATA.yaml — `.../pptx-slide-design/SKILL.md` (banana-prompt structure, emit concrete-hex-only prompts, NOT abstract token names) + METADATA.yaml · Success: SKILL.md ≥400 words, 4-step pipeline aligned with reference-slides.md 13-part anatomy. **v2 inversion:** emit concrete hex (`#C84A1E`) + named fonts, never abstract token names.
- [-] [scribe] Author slide-prompt-templates.md — 13-part skeleton (annotated) + 3 worked Input→Output examples, each single copy-paste block · Success: skeleton maps 1:1 to anatomy; 7 layout archetypes via Part 6 variation; zero abstract token names. **Deferred:** user to refine templates via Copilot iteration.

### Phase 3 — Register + Integrate
- [-] [coder] Register skill in overview — add to `skills.overview.md` + `optional_plugins/index.md` · Status: DONE in `47d1a25`; mark `[x]` when Phase 2 SKILL.md auditor-verified.
- [ ] [auditor] Test 3 prompts with Copilot Premium — user pastes 3 emitted prompts into PowerPoint Copilot · Success: ≥80% first-pass quality. **BLOCKED — awaiting user re-engagement.**
- [ ] [auditor] Mark project terminal — verify Phase 2/3 `[x]`, metrics met, authorize merge → `main`, delete branch. **BLOCKED on Copilot test gate.**

### Merge Gate
- Phase 0 ✅ merged `5a47961`. Phase 1/2 content on `main` (holding branch deleted — see Status). Phase 3 gate = Copilot Premium test.

### Hard Rules (Auditor Rejects on Violation)
1. `pptx-slide-design`/`banana-prompt` never generate office files or invoke renderers (`ms-office` skills exempt)
2. `pptx-slide-design` reads design tokens from `LAYOUT_SPEC.md` — never redefines
3. **CRITICAL (v2):** Output prompts MUST use concrete hex + named fonts, NEVER abstract token names. Load-bearing for Copilot rendering.

### Notes
- ~~No implementation on `main`~~ superseded: skill content is on `main` (v2.0.0); new quality-gate work happens on `phase-vse-1-quality-gates` (VSE).
- `banana-prompt` is the structural twin/template for the plugin structure.
- Fidelity bar: two user-authored gold slides in `references/reference-slides.md`.
- Deferred repo hygiene: `scripts/office/` triplication (dedup opportunity); `plugin.yaml` min_model_version schema nit (pre-existing, low priority).

---

# Completed Initiatives (Archived)

Full ledger → `Artifacts/History/COMPLETED_INITIATIVES.md`. Summary:

| Initiative | Status | Terminal commit |
|:---|:---|:---|
| **LH — Loop Hardening** | COMPLETE (3 phases) | `2cee6eb` |
| **OSH — OS Hardening** | COMPLETE (6 phases) | `38db2c9` |
| **CMD — CLAUDE.md Discipline** | COMPLETE (3 phases) | `a393e2b` |
| **OSA — OS Self-Audit** | COMPLETE (2 workstreams) | `6bdd944` |
| **DLR — DECISION_LOG Rotation** | COMPLETE (1 phase) | `ca03928` |
