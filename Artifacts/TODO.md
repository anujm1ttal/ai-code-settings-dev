# TODO — Active & Queued Work

**Updated:** 2026-07-24 (RDT-1 closed) · **Branch:** `main` (clean, pushed `dcd321a`)

Completed initiatives (LH, OSH, CMD, OSA, DLR) archived → `Artifacts/History/COMPLETED_INITIATIVES.md`.
Deferred findings live in `Artifacts/BACKLOG.md`.

---

# Active Initiative: IGH — Insights-Guided Hardening

**Status:** IGH-1 active (plan authored, implementation not started) · **Step 0:** approved 2026-07-26 · **Grill:** [REFACTORED] 2026-07-26
**Branch:** `phase-igh-1-mechanical-guards` · User-driven (out of OXL sequence)
**Plans:** `Artifacts/Plans/IGH-1-Plan.md` + `IGH-1-TODO.md` · IGH-2 queued
**Origin:** `/insights` over 141 sessions — six gaps verified by grep; the report's #1 suggestion struck as Rule-echo.

- [x] **IGH-1 — Mechanical Guards** — auditor PASS 2026-07-26; all 8 metrics met, all 3 Hard Rules held. Report: `Artifacts/Reports/IGH-1-Report.md`. **T5 adversarial probe found and fixed a real allowlist-traversal bypass in T2** (`Artifacts/Temp/../../src.py` was allowed). 216 pytest exit 0; deploy 6/6; both guards runtime-verified live from `~/.claude/`. **T1: RDT-1 is DORMANT in all 3 installed geometry plugins — the gap is distribution, not prose.** Success: T1 activation table with raw output; redirect guard denies source-writes while **allowlist tests prove Temp/ + Evidence/ still pass**; shared-state hook fires on subset-only run and is silent on full-suite; `deploy.sh` reports **8** enforced hooks; pytest exit 0; deploy 6/6 — tasks: `Plans/IGH-1-TODO.md`
- [ ] **IGH-2 — Rules + Dispatch** (queued) — Success: read-back rule in testing-strategy.md; call-site sweep as ONE line in coding-style.md; scope discipline in standards.md; auditor blindness clause **not merged without live-fire dispatch evidence**
  - **⚠ Scope cut by IGH-1 T1:** no Rhino rule authoring — RDT-1's guards exist and are correct but are dormant in all installed plugins. Remedy is a `/plugin` geometry reinstall per project, not prose.

### Initiative Hard Rules (Auditor Rejects on Violation)
1. The redirect guard must not block the EVD evidence protocol — Temp/ + Evidence/ allowlist tests mandatory
2. All hooks fail open; no new hook blocks a turn (feedback-only)
3. No rule authored before the T1 activation check answers — a dormant rule needs reinstalling, not rewriting

---

# Completed Initiative: BLR — BACKLOG Lifecycle & Rotation

**Status:** BLR-1 COMPLETE (auditor PASS 2026-07-26; report `Artifacts/Reports/BLR-1-Report.md`) · **Step 0:** approved 2026-07-26 · **Grill:** [REFACTORED] 2026-07-26
**Branch:** `phase-blr-1-backlog-lifecycle` · User-driven (out of OXL sequence — precedent: RDT, GHP, MTU, EVD)
**Plans:** `Artifacts/Plans/BLR-1-Plan.md` + `BLR-1-TODO.md`
**Origin:** cross-repo comparison against `my_mcp_rhino` — the OS specifies how work *enters*
BACKLOG in three places and how it *leaves* in none.

- [x] **BLR-1 — BACKLOG Lifecycle & Rotation** — auditor PASS 2026-07-26; all 3 Hard Rules held (HR2 zero-loss verified 18→18 with presence control). **M3 recorded MISSED** (213 lines vs ≤200; metric deliberately NOT amended — see report §3). Success: §BACKLOG Lifecycle ≤20 lines; `backlog_audit.py` zero repo imports, exit 1/0 correct; this repo's BACKLOG ≤200 lines / ≤12 entries with 0 RESOLVED remaining; audit exit 0; pytest exit 0; deploy 6/6 — tasks: `Plans/BLR-1-TODO.md`

### Initiative Hard Rules (Auditor Rejects on Violation)
1. No BACKLOG outside this repo is touched — `my_mcp_rhino` and all other projects untouched
2. Rotation never deletes — archive append-only; OPEN entries never rotate regardless of age
3. `backlog_audit.py` reports, never edits — no auto-rotation; mutation stays human-confirmed

**⚠ Drift flagged (auditor-owned):** OXL-3 below is marked `[ ]` citing branch
`phase-oxl-3-interview-mode`, which does not exist — its deliverables are on `main`
(`elicitation-guide.md`; `--interview` in `blueprint.md`). Shipped-but-unmarked, or R3 live-fire
gate genuinely unmet. Only the auditor may resolve.

---

# Completed Initiative: RDT — Rhinocode Doc-Targeting Guard

**Status:** RDT-1 COMPLETE (merged `2b9f88d`, pushed) · User-driven (out of OXL sequence) · 2026-07-24
**Origin:** user flagged wrong-document risk in Lane A-live (`rhinocode script`) with multiple Rhino instances open. Live probe corrected the premise: no `-i` flag exists (real defect = omitting `-r`); PIDs are volatile (resolve by doc-hint); `compute.geometry` publishes a `remotepipe_*` pipe the old first-match regex could wrongly target.

- [x] **RDT-1 — Harden the Lane A-live harness** — Success (all met, auditor GO): `discover_rhino_instances()` filters `processName=="Rhino"`; `resolve_instance()` fail-loud naming each doc on >1 instance (`RHINO_INSTANCE_ID` override); `_INSTANCE_ID_RE` removed; doc-hint guard aborts (`SENTINEL+"94"`) on `RHINO_DOC_HINT` ⊄ `ActiveDoc.Name`; 136 pytest exit 0. SKILL.md Key Rules 3–4 + pitfalls row.
- [x] **RDT-2 — Codify the rule** (same branch) — Success: SKILL.md "always `-r`, never bare" + doc-hint rule; pitfalls row; 0 phantom `-i` prohibition; example commands `-r`-qualified (HR1 fix). Plans: `Artifacts/Plans/RDT-1-Plan.md` + `RDT-1-TODO.md`.

### Initiative Hard Rules (verified at gate)
1. No `rhinocode` invocation in any shipped resource omits `-r` ✅ (HR1 reject on SKILL.md examples → fixed)
2. Instance resolution filters `processName == "Rhino"` — no bare pipe-id regex match survives ✅
3. No pinned PID / instance-id literal in any template or doc example ✅

**⚠ Activation:** ships via `/plugin` geometry refresh, NOT deploy.sh — not live in sessions until user reinstalls the geometry plugin.
**Follow-up → BACKLOG** `rdt_graduate-source-vs-deployed_1`: harden `/graduate` to resolve destinations against repo source, not `~/.claude/`.

---

# Active Initiative: OXL — OS Cross-Learning

**Status:** OXL-1 expanded (AFK runner folded in) · **Step 0:** approved 2026-07-09 · **Grill:** [REFACTORED] 2026-07-09 · **Grill-2:** [REFACTORED] 2026-07-10
**Plans:** `Artifacts/Plans/OXL-1-Plan.md` + `OXL-1-TODO.md` · `OXL-3-Plan.md` + `OXL-3-TODO.md` (active) · OXL-2 queued (phase gate after OXL-1)
**Origin:** mattpocock/skills + ralph pattern import — see IMPLEMENTATION_PLAN.md + DECISION_LOG [OXL]

- [x] [coder] **OXL-1 — Work-Tracking & Planning Conventions + AFK Runner** (branch `phase-oxl-1-conventions`) — Success: 9 plan metrics (format spec + example, dispatch cite, slice test, commit-as-handoff, AFK/HITL tag spec, `commands/afk.md` 8 elements, registry rows, live-fire smoke evidence, deploy exit 0) — tasks: `Plans/OXL-1-TODO.md`
- [ ] **OXL-3 — Interview Mode (`/blueprint --interview`)** (active, branch `phase-oxl-3-interview-mode`; Step 0 approved 2026-07-20) — Success: `elicitation-guide.md` ≤70 lines with 4 breadth categories intact + ≥4-question worked traversal; exactly 3 files wired in P2 with 0 new registry rows; deploy exit 0; live-fire ≤12 questions with ≥2 codebase-answered; **R3 hard gate — unqualified user affirmation, soft yes = FAIL** — tasks: `Plans/OXL-3-TODO.md`
- [ ] **OXL-2 — Skill-Authoring Craft** (queued; gate: reassess after OXL-1) — Success: standards doc ≤150 lines on-demand; audit report covers 100% of commands; hides runtime-verified with measured token delta

### Initiative Hard Rules (Auditor Rejects on Violation)
1. New task-format fields optional everywhere; `[ ]`/`[-]`/`[x]` semantics and TODO authority untouched
2. [AMENDED 2026-07-10, user override] No **executable** runner code ships in OXL — no scripts/hooks/JS/bash; `commands/afk.md` is markdown procedure only (see DECISION_LOG [OXL] 2026-07-10)
3. No skill/command hidden without written rationale + runtime verification; `/handoff` + `/sync` stay model-visible
4. Authoring-standards doc lives on-demand only — never in rules/common/ or any always-loaded surface

---

# Completed Initiative: GHP — Grasshopper Plugin Packaging + Rhino Graduation

**Status:** GHP-1 + GHP-2 + GHP-3 COMPLETE (merged + pushed; GHP-1 `ab7b558`, GHP-2 `ba435ce`, GHP-3 `e0984b9`) · User-driven (out of OXL sequence) · 2026-07-17
**Origin:** user surfaced their `my_mcp_rhino` live-Rhino test-lane workflow + a new external Python-Grasshopper-plugin project; asked what graduates globally + web research on GH plugin packaging. GHP-2/GHP-3 followed from reading Deleuran's GH103 (2021) Python workshop PDF, then probing GH_IO. Together they give `python-rhino-grasshopper` + `grasshopper-plugin-packaging` full coverage: authoring, testing, packaging, headless definition tooling.

- [x] **GHP-1 — Packaging skill + harness/gotchas graduation** — Success (all met, auditor GO): new `grasshopper-plugin-packaging` skill (140-line SKILL.md + `references/yak-cli.md`) routed into `geometry` type across 4 registry surfaces + skill-graph mirror; in-process bridge templates → `rhino-e2e-testing/resources/`; 9 Rhino gotchas → `python-rhino-grasshopper/pitfalls.md`; 131 pytest exit 0; deploy 6-step pass. Report: `Artifacts/AUDIT_REPORT.md`.
- [x] **GHP-2 — GHPython component-contract reference** — Success (all met, auditor GO): new `python-rhino-grasshopper/references/ghpython-component.md` (component I/O, `ghenv.Component`, data trees via `treehelpers`+SDK, `ghcomp`, `sc.sticky`, custom viewport draw); 2 pitfalls rows (`sc.doc` ProxyDocument trap, GUID-without-hint); `api-lookups.md` API-gate gap closed (Grasshopper.xml worked example + `.BoundingBox`→`ClippingBox` fix). Every fact **live-probed in Rhino 8 CPython 3.9.10 + XML-verified**; provenance-tagged. 131 pytest exit 0. Ships via geometry-plugin refresh (no deployed surface touched).
- [x] **GHP-3 — Headless GH_IO serialization reference** — Success (all met, auditor GO): new `python-rhino-grasshopper/references/gh-io-serialization.md` (112L) — read/write `.gh`/`.ghx` via `GH_IO` (Rhino-free → definition-audit CI needs only `GH_IO.dll`+pythonnet). Both read+write paths **live round-trip-verified in Rhino 8** + every member XML-gated vs `GH_IO.XML`; new `[XML-listed-but-not-callable]` provenance tag for `WriteToFile_Xml`. 131 pytest exit 0. Ships via geometry-plugin refresh.

### Initiative Hard Rules (verified at gate)
1. No gBlox leakage — templates/gotchas project-agnostic (grep-verified zero matches)
2. No re-documentation — each shared fact single-owner + pointers (HR2: failed once on parallel-dispatch duplication, then fixed)
3. Two McNeel doc-ambiguities (distribution-tag targeting; `# r:` bundle-vs-runtime) shipped FLAGGED for live-Rhino verification, never as settled fact

**Parked → BACKLOG:** `oxl_mcp-rhino-scaffold` — MCP-over-socket stack (LazyConnection, `marshal_to_rhino_thread`, sticky live-reload server, FastMCP template). Revive if a reusable Rhino-MCP scaffold is wanted.

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
