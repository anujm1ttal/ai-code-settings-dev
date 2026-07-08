# TODO — Active & Queued Work

**Updated:** 2026-07-08 · **Branch:** `main` (clean, pushed)

Completed initiatives (LH, OSH, CMD, OSA) archived → `Artifacts/History/COMPLETED_INITIATIVES.md`.
Deferred findings live in `Artifacts/BACKLOG.md`.

---

# Active Initiative: DLR — DECISION_LOG Rotation

**Status:** COMPLETE · **Step 0:** approved 2026-07-08 · **Plan:** `Artifacts/Plans/DLR-Plan.md` + `DLR-TODO.md`
**Goal:** Bound the ever-growing DECISION_LOG via size-threshold rotation to a rolling `History/` archive — never prune (it's an audit trail). Adds the lifecycle rule the OS was missing.

- [x] [coder] T1 — Rotation policy in `orchestration.md` (>400 lines/40 entries → oldest resolved to `History/DECISION_LOG-archive.md`; never delete) — Success: M1
- [x] [coder] T2 — Read-discipline (newest-first head) in `sync.md` + `handoff.md` — Success: M2
- [x] [coder] T3 — Archive scaffold + forward-pointer; no move (repo under threshold) — Success: M3
- [x] [auditor] T4 — Gate M1–M4 + deploy + merge — Success: deployed, closed

### Initiative Hard Rules (Auditor Rejects on Violation)
1. Rotation NEVER deletes — entries only move to History/; archive is append-only
2. UNRESOLVED entries never rotate, regardless of age
3. No behavioral loss — head-read still surfaces unresolved; under-threshold entries not force-moved

---

# Queued Initiative: VSE — Visual Storytelling Enhancement

**Status:** UNBLOCKED (OSH + LH both closed 2026-07-08) — ready for `/blueprint VSE-1` · **Step 0:** approved 2026-07-07
**Plans:** `Artifacts/Plans/VSE-[1-2]-Plan.md` + `VSE-[1-2]-TODO.md` (detailed tasks live there)
**Origin:** ui-ux-pro-max-skill architecture pattern (data-fied design knowledge + executable output validation), applied to `pptx-slide-design` only. banana-prompt out of scope. No search engine (deferred until library >25 entries).
**Sequencing:** VSE-1 → VSE-2 (VSE-2 requires `/grill` + Interface-First `[user-approval]` before kickoff)

- [ ] [strategist] **VSE Initiative Kickoff (/blueprint VSE-1)** — decompose Phase 1 tasks, create git branch · Success: phase-vse-1-quality-gates branch created, Tasks decomposed to Artifacts/Plans/VSE-1-TODO.md
- [ ] **VSE-1 — Executable Quality Gates** (branch `phase-vse-1-quality-gates`, cut from `main` post-OSH) — Success: validate_prompt.py 2/2 gold pass + 3/3 seeded-bad fail; contrast_check.py pass/fail pair correct; pytest exit 0; zero new deps
- [ ] **VSE-2 — Design-Data Library + Draft Generator** (branch `phase-vse-2-design-data`) — Success: ≥8 vetted palettes + ≥6 vetted font pairs (100% attributed, contrast-gated); intake draft LAYOUT_SPEC passes VSE-1 validators first try; archetypes defined in exactly 1 file

### Initiative Hard Rules (Auditor Rejects on Violation)
1. Validators check invariants only — no coupling to 13-part section wording/order (Copilot render test still pending)
2. Skill never generates files or invokes renderers; validation is text-only
3. No entry marked `vetted` without contrast_check evidence; generator output always bannered DRAFT
4. Phase close = plugin re-install + live verification (plugin scripts do NOT ship via deploy.sh)

---

# Parked Project: `pptx-slide-design` Skill + `ms-office` / `visual-storytelling` Plugins

**Status:** PARKED — BLOCKED on user Copilot Premium test. Phase 0 ✅ merged (`5a47961`); Phase 1 ✅ (`74b621c`); Phase 2 in progress; Phase 3 blocked.
**Owner:** strategist → coder → auditor · **Branch:** `phase-1-pptx-slide-design-contract` (holding; merge pending template refinement + Copilot test)
**Note:** VSE (above) supersedes the *quality-gate* ambition for this skill; this parked branch is the pre-VSE contract work. Reconcile scope at VSE-1 kickoff.

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
- Phase 0 ✅ merged `5a47961`. Phase 1/2/3 holding on `phase-1-pptx-slide-design-contract` pending template refinement + Copilot test.

### Hard Rules (Auditor Rejects on Violation)
1. `pptx-slide-design`/`banana-prompt` never generate office files or invoke renderers (`ms-office` skills exempt)
2. `pptx-slide-design` reads design tokens from `LAYOUT_SPEC.md` — never redefines
3. **CRITICAL (v2):** Output prompts MUST use concrete hex + named fonts, NEVER abstract token names. Load-bearing for Copilot rendering.

### Notes
- No implementation on `main` — all work on `phase-1-pptx-slide-design-contract`.
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
