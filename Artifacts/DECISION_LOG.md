# Decision Log

Historical architectural decisions and pivots. Newest first.

Archive of rotated entries → `Artifacts/History/DECISION_LOG-archive.md`.

---

## 2026-07-26 — IGH: Four grill cuts on insights-driven plan [IGH]

**Context:** `/insights` report (141 sessions, 572h, 413 commits) identified six gaps (0 grep
hits). Blueprint shaped the plan; Gate 1 (grill) ran as mandatory stress-test per §Blueprint.
Skeptical architect attacked the plan on four dimensions.

**Cuts:**

1. **Fix Protocol section struck, one line added instead.** Plan proposed a 3-clause section
   (call-site sweep, shared-I/O full-suite re-run, first-fix root-cause). Auditor evidence: 2×n=1
   (04b_concourse.py signature, 279-test stdout break) + 0 (re-root-cause is already Semantic
   Loop Detection in `systematic-debugging` + `orchestration.md`). Non-blocking; folded
   call-site sweep as a single line in `coding-style.md` §Surgical Precision where it belongs.

2. **Test hook narrowed from subset-detection to shared-state grep.** Plan proposed a Stop hook
   that nags on any subset test run (fires most turns → nag fatigue on the third hook).
   Refactored to grep the diff for `sys.stdout`, `sys.stderr`, `logging.`, `TextIOWrapper`,
   `reconfigure`, `os.environ`. Fires only when those are touched AND no full-suite run. Evidence:
   n=1 (2026-07-26, 279 teardown errors from stdout reassignment). **Self-deleting guardrail:**
   `gate_telemetry.py` counts per-hook fires; zero fires across 20 sessions → auto-delete via a
   BACKLOG exit-condition entry.

3. **Auditor blindness re-scoped, live-fire gate added.** Plan proposed Tier-3 architecture
   refactor. Grill discovered `implementation-dispatch` **already** carries a two-stage review
   (Spec → Quality) with `reviewer-prompt.md` template. Redefined as one clause: a blind auditor
   receives git diff + contract only, never the implementer summary. **Gated on live-fire dispatch
   evidence**: no subagent ran this session, so this clause doesn't merge without a real
   coder/blind-auditor transcript proving it works.

4. **Priority argument withdrawn.** Plan claimed hooks deserve priority because they deploy
   globally while rules don't. Grill checked `deploy.sh:102` and found `DEPLOYED_ITEMS=(agents
   rules skills …)` — rules deploy too. Same reach, same priority. Argument was factually wrong.

**Status:** OPEN (IGH-1 execution pending, IGH-2 planned, live-fire gate gates one IGH-2 item).

---

## 2026-07-26 — BLR-1: Auditor PASS, M3 recorded MISSED [BLR]

**Context:** BLR-1 (BACKLOG lifecycle, rotation, checker) shipped T1–T4. Auditor gate (T5) ran
independently against raw artifacts.

**Ruling:** PASS. All 3 Hard Rules verified: HR1 my_mcp_rhino has zero content change (the `M`
flag is a CRLF normalization artifact, pre-existing). HR2 zero-loss confirmed 18 entries
before→after with a presence control (injected fake entry, oracle correctly reported it lost).
HR3 no write operations in `backlog_audit.py` (stdlib-only). M1–M2, M4–M8 all verified.

**M3 recorded MISSED (not amended).** Metric was ≤200 lines; result 213. Nine other gates pass +
all Hard Rules. **Auditor refused to amend the metric** — rewriting a threshold to match the
result is the move an auditor exists to prevent. Lesson for handoff: **derive metrics from
enforced thresholds, not pre-write estimates.** The rule's enforced threshold is 250
(`backlog_audit.py`); entries are 11/20 ✅. Metric intent satisfied, MISSED recorded honestly.

**Report:** `Artifacts/Reports/BLR-1-Report.md`. Caveat stated in §1: auditor self-audit is the
weakest verification. Every claim re-derived or re-run rather than carried forward; independence
would be preferable.

**Status:** RESOLVED. Merged `621e42a`, **uncommitted at handoff time**.

---

## 2026-07-25 — Tier 1 model bumped to Claude Opus 5 [MTU]

**Decision:** Replace `claude-opus-4-8` with `claude-opus-5` as the Tier 1 model ID everywhere
in the OS — `model-routing.md` Tier 1 row, `agents/{strategist,council}.md` frontmatter, 7
`commands/*.md` frontmatter (afk, blueprint, council, grill, ideate, skill-graph, sweep),
`scripts/model_router.py` (`ModelID` Literal, `AGENT_MODELS`, `MODEL_PRICING` key, both
tier→id maps), `scripts/README.md`, and the two routing tests.

**Rationale:** User-directed model upgrade. Verified against the `claude-api` skill's model
table before editing: Claude Opus 5 is the current Opus-tier model at **the same $5/$25 per
MTok as Opus 4.8**, so `MODEL_PRICING` stays at `15.0` (the file's input/output average) and
the minimum-capable-model economics in `model-routing.md` are unchanged. A same-tier ID swap,
not a tier change — no rule text needed rewriting.

**Deliberately unchanged:** generic "Opus"/"Opus-tier" prose (tier names, still correct);
`Artifacts/` history (no literal `claude-opus-4-8` present); `statusline.sh` /
`subagent_statusline.sh` (they colour-match on the `opus` substring, so Opus 5 renders green
with no edit); one stale `"Opus 4.8"` string in a `.claude/settings.local.json` permission
allowlist entry (inert, flagged to user).

**Status:** RESOLVED. 136 pytest exit 0; `deploy.sh` validation passed (7 hooks wired);
deployed `~/.claude/{agents,commands,rules}` re-grepped and confirmed carrying `claude-opus-5`.
Backup `~/.claude.backup-20260725-002827`. **Uncommitted** at handoff time.

---

## 2026-07-24 — RDT-1: Lane A-live doc-targeting guard (premise-corrected via live probe) [RDT]

**Context:** User asked to make correct-document targeting mandatory for `rhinocode` (Lane
A-live), citing a `-i` flag to avoid and a pinned instance `remotepipe_37092`. Probed the live
CLI before encoding anything.

**Premise corrections (evidence, not opinion):**
- **No `-i` flag exists** — `rhinocode --help`/`script --help` expose only `-r, --rhino <ID>`.
  The real defect is *omitting* `-r`. Rule codified as "always `-r`, never bare".
- **PIDs are volatile** — user's `37092` was already stale (live was `31340`). Guard resolves by
  doc-hint, never a pinned id.
- **`compute.geometry` publishes a `rhinocode_remotepipe_*` pipe** with empty `activeDoc`. The
  old `_INSTANCE_ID_RE.search()` first-match could target it. Resolution now filters
  `processName == "Rhino"`.

**Decision:** Two-layer guard in `rhino-e2e-testing` resources: `resolve_instance()` fails loud
on >1 Rhino instance (lists each doc; `RHINO_INSTANCE_ID` overrides); doc-hint guard in the suite
runner aborts (`SENTINEL+"94"`) when `RHINO_DOC_HINT` ⊄ `RhinoDoc.ActiveDoc.Name` (warn-only when
unset / `RHINO_DOC_READONLY=1`). SKILL.md Key Rules 3–4 + one pitfalls.md row.

**Status:** RESOLVED. 136 pytest exit 0; auditor GO (after HR1 reject on bare example commands in
SKILL.md → fixed). Merged `2b9f88d`, pushed. **Delivery caveat:** ships via `/plugin` geometry
refresh, NOT `deploy.sh` — not live in sessions until user reinstalls the geometry plugin.

## 2026-07-24 — /graduate wrote to deployed dir instead of repo source; corrected [RDT/OS]

**Context:** During `/graduate` of 8 `my_mcp_rhino` inbox entries, the concierge subagent applied
6 of 8 edits directly to `~/.claude/rules/common/*.md` (the **deployed** copies) instead of the
repo source `rules/common/*.md`. Its commit `48842c1` captured only entry 7 (implementation-
dispatch SKILL.md) + inbox cleanup; entries 1–6 were unversioned and would be clobbered on the
next `deploy.sh`.

**Detection:** mtime comparison — deployed rules 23:26–23:28 (just written), repo source
11:05–15:37 (untouched), working tree clean. Confirmed via diff of deployed vs source.

**Decision:** Ported the exact additions into repo source (5 files, 13 lines), committed `dcd321a`,
ran `deploy.sh` (exit 0, 136 pytest) to re-sync production from versioned source, pushed.
Entry 8 (standards.md, reported blocked for the subagent) also applied to source.

**Status:** RESOLVED. **Follow-up finding (→ BACKLOG):** `/graduate` command doc lists
destinations as bare `rules/common/*.md` — ambiguous between repo source and deployed; a subagent
resolved them against `~/.claude/`. Harden the command to state "repo source, then deploy" and/or
block writes outside the workspace.

## 2026-07-17 — GHP-3: headless GH_IO serialization reference, read+write live-verified [GHP]

**Context:** Follow-on from GHP-2. User asked to explain, then probe, then build a reference for
the `GH_IO.XML` resource (Grasshopper's serialization layer for `.gh`/`.ghx`). Chose to probe
before building.

**Decision:** Build `python-rhino-grasshopper/references/gh-io-serialization.md`, scoped to the
**headless definition-inspection** use case (the one with real leverage), after live-verifying
both read AND write paths against the user's Rhino 8 via `rhinocode` + pythonnet.

**What the probes verified / surfaced:**
- READ: `GH_Archive().ReadFromFile` → `GetRootNode` (a `GH_Chunk`) → walk `Definition` →
  `DefinitionObjects.ObjectCount` → `FindChunk("Object", i)`. Pulled a real 5-component inventory
  from a sample `.gh`. Enumeration API is `Chunks`/`ChunkCount`/`Items`/`ItemCount` (the grep
  missed these; the live member-dump caught them).
- WRITE (round-trip): `CreateNewRoot(True)` (void) → `GetRootNode` writer → `Set*`/`CreateChunk`
  → `Serialize_Xml()` → `Deserialize_Xml` read-back identical.
- **3 pythonnet gotchas found only by probing** (now documented): `CreateNewRoot` returns void;
  **`WriteToFile_Xml`/`_Binary` are in `GH_IO.XML` but NOT callable at runtime** (new provenance
  tag `[XML-listed-but-not-callable]`); `TryGetX` out-params bind awkwardly → use `ItemExists`+`GetX`.
- **Headline:** GH_IO is Rhino-free by design → a `.gh` audit/diff/migration CI tool needs only
  `GH_IO.dll` + pythonnet, **no Rhino on the runner**. Honestly scoped YAGNI for authoring a
  Python plugin.

**Outcome:** RESOLVED. 131 pytest exit 0, auditor GO (members independently re-verified vs
`GH_IO.XML`, `WriteToFile_Xml` framing + provenance + single-ownership confirmed), merged +
deployed + pushed `e0984b9`. Prior GHP-2 audit report archived → `History/Reports/` (normalized
a lowercase `history/` path the auditor created back to capital `History/` to avoid a
case-duplicate dir on case-sensitive checkouts). **Reinforces the GHP-2 methodology win:
probe-before-encode caught runtime facts the XML alone (and memory) would have gotten wrong.**

---

## 2026-07-17 — GHP-2: GHPython component-contract reference, live-probe-verified [GHP]

**Context:** User shared Anders Deleuran's "Grasshopper 103" Python workshop PDF (197 pages,
2021, IronPython 2.7). Two parallel readers digested it. Finding: ~70% is beginner Python or
Rhino 6/7 IronPython-era (superseded), but it exposed a real gap — our `python-rhino-grasshopper`
skill was strong on RhinoCommon + external-module architecture but light on the **GHPython
component runtime contract** itself.

**Decision:** Graduate a focused component-contract reference — but only after **verifying every
interop-flavored claim against the user's live Rhino 8**, since the source is a 4-year-old
IronPython deck. User had Rhino 8 + Grasshopper open; we probed via `rhinocode` (Lane A-live) +
the `Grasshopper.xml` API-signature gate.

**What verification caught (the point of doing it):**
- Engine is CPython 3.9.10; `DataTree[object]()`, `ghpythonlib.treehelpers`/`.components`,
  `sc.sticky` all confirmed working.
- `sc.doc` INSIDE a GH component is `...GH1.Legacy.ProxyDocument` (`is RhinoDoc.ActiveDoc` →
  False) — the deck's #1 trap is **real in R8** → graduated to pitfalls (single-owner).
- `ghenv.Component` = `RhinoCodePluginGH.Components.Python3Component` (IGH_Component) — exists.
- The deck's "provide a `BoundingBox`" for custom display is **WRONG for R8** — the member is
  `GH_ScriptInstance.ClippingBox` (XML-verified). Corrected.
- `GH_Path` has **no `(int,int)` ctor** — the two-int call binds to the `int[]` ctor at runtime;
  documented as contract-vs-runtime-binding, not a fictional overload. (This corrected the
  orchestrator's own task brief, not just the deck.)

**Also fixed a gate gap the user flagged:** `api-lookups.md` named `Grasshopper.xml`/`GH_IO.XML`
but every worked grep example targeted only `RhinoCommon.xml`, so GH-SDK members were
under-grepped. Added a `Grasshopper.xml` worked example + corrected the `.BoundingBox` note.

**Outcome:** RESOLVED. 131 pytest exit 0, auditor GO (members independently re-verified vs XML,
single-ownership + provenance honesty confirmed), merged + pushed `ba435ce`. Ships via
geometry-plugin refresh — no rules/global surface touched, so `deploy.sh` was a no-op validation.
`GH_IO.XML` (serialization) parked for a future reference. **Methodology win: probe live runtime +
XML gate before graduating a documentation source — it corrected both a 2021 deck and the
orchestrator's brief** (reinforces `testing-strategy.md` "Inherited Triage Is a Hypothesis").

---

## 2026-07-17 — GHP-1: graduate Rhino workflow globally + author GH-plugin packaging skill [GHP]

**Context:** User surfaced their `my_mcp_rhino` live-Rhino test-lane workflow as "quite nice" and
asked (a) what graduates globally, especially for a NEW external Python-Grasshopper-plugin
project, and (b) web research on GH plugin dev + packaging. Three parallel research streams
(map `my_mcp_rhino`, inventory existing global Rhino assets, web-research packaging).

**Findings that shaped scope:**
- Most of the lane workflow (rhinocode CLI, `# venv:`/`# r:` directives, exit-0 sentinel,
  4-lane taxonomy) was ALREADY global in `rhino-e2e-testing` (graduated earlier). Net-new from
  `my_mcp_rhino`: the concrete in-process bridge runner + a set of Rhino runtime gotchas.
- The real gap (both project AND global): **Grasshopper plugin PACKAGING** — global repo had
  exactly one `.yak` table cell; zero on Yak workflow, `.rhproj`, manifests, dependency bundling.

**Decisions:**
1. **Scope = both gaps, skip the MCP stack** (user choice). Build the packaging skill (the true
   gap) AND graduate the 2 net-new items. MCP-over-socket scaffold parked → BACKLOG
   `oxl_mcp-rhino-scaffold` (powerful but not needed for a GH-plugin project).
2. **Recommended path in the skill:** Rhino 8 C#-free pipeline `#! python 3` → `.rhproj` →
   `rhinocode project build` → `.yak` → `yak push`. `.ghpy` documented as deprecated; Python
   CAN now produce a real `.gha`.
3. **Two McNeel doc-ambiguities shipped FLAGGED** (HR3), not settled: distribution-tag version
   targeting (lives in `--platform`/build-target, not `manifest.yml`); whether `# r:` deps bundle
   into the `.yak` or pip-install on the user's machine at first run (vendor into `Libraries/` for
   offline determinism). User has a live Rhino to confirm both.

**Process note (→ learning):** Parallel fan-out of 4 doc-authoring coders produced HR2
duplication — each independently re-documented shared facts (rhinocode exit-0 in ~5 files).
Auditor caught it; fixed via single-owner (`rhino-e2e-testing`) + pointers. Filed as the mirror
failure mode in `execution-rules/verify-centrally-after-fanout.md`: assign single-ownership of
shared facts at DISPATCH time, not just verify after.

**Outcome:** RESOLVED. 131 pytest exit 0, audit GO, deployed (6-step pass), merged + pushed
`ab7b558`. Skill body activates in sessions on `geometry`-plugin refresh (`deploy.sh` doesn't
ship plugins).

---

## 2026-07-10 — AFK runner folded into OXL-1: user override of the 2026-07-09 deferral [OXL]

**Decision:** User described their target operating model (interactive planning → Opus
orchestrator dispatches Sonnet/Haiku subagents → orchestrator reviews each return → auditor
gates → user approves only HITL tasks) and, on being shown that this is exactly the deferred
`oxl_afk-runner_1`, chose **"Fold into OXL-1 now"** over the recommended "revive after OXL-1."

**Override:** OXL Hard Rule 2 ("no runner ships in OXL") AMENDED → "no *executable* runner code
ships" — the runner lands as `commands/afk.md`, a markdown procedure composing existing machinery
(Agent tool + model bindings, implementation-dispatch review protocol, T1 `Blocked by:` frontier,
T4 commit-as-handoff, auditor `[x]` gate). The `oxl_afk-runner_1` BACKLOG entry is never created;
its 6 design elements ship in T5/T7.

**Consumer evidence (satisfies yesterday's "ship nothing without a consumer"):** user named
`my_mcp_rhino` as the first real AFK backlog; maiden voyage after the in-repo smoke run.

**Grill-2 [REFACTORED] — defects found + hardening accepted:**
- **HITL-exit semantics fixed**: frontier = AFK ∧ unblocked can never *contain* a HITL task;
  the correct pause is "frontier empty ∧ tasks remain → report gating HITL/blocked tasks."
- **Audit-output clobber fixed**: per-task auditor gates append sections to
  `Artifacts/Reports/afk-run-<date>.md`; `AUDIT_REPORT.md` reserved for standalone `/audit`.
- **Live-fire smoke gate added** (metric 8): one end-to-end `/afk` iteration + clean
  `model_routing_audit.py --violations-only` — proves Agent tool honors bindings at runtime.
- **Opus-tier hard-stop**: `/afk` refuses to run below Opus-tier (orchestrator IS the reviewer).
- **Fail-safe tagging**: untagged = HITL; strategist-only tagging authority.
- **Review depth (user-selected)**: orchestrator two-stage review AND auditor gate per task —
  highest-cost option, accepted knowingly.

**Status:** RESOLVED — plan files amended 2026-07-10; implementation pending user plan approval.

---

## 2026-07-09 — OXL grilled → [REFACTORED]: 3 phases → 2; ship nothing without a consumer [OXL]

**Decision:** `/grill` on the OXL blueprint (Skeptical Architect + recon) cut every element lacking
a day-one consumer or demand evidence. User accepted all three recommended cuts.

**What was cut (and why):**
- **AFK/HITL tag out of Phase 1** → folded into `oxl_afk-runner_1` BACKLOG spec. With the runner
  ruled spec-only, the tag had zero mechanical consumers — a no-op field by the imported taxonomy
  itself. Tag + runner ship together or not at all.
- **Phase 3 `/blueprint --foggy` (wayfinder mode)** → CUT to `oxl_wayfinder_1` with a revival
  trigger. Zero observed demand: no initiative in repo history was too foggy for /blueprint+/grill.
  The separable vertical-slice + expand–contract rules moved into Phase 1 (project-planner).
- **Blanket commit-as-handoff** → scoped to task-completion commits only. Ralph needs it on every
  commit because git log is its ONLY memory; we have Artifacts. The real gap is crash recovery
  between /handoffs — trivial commits are exempt.

**Recon corrections (evidence, not opinion):**
- `disable-model-invocation: true` verified real + doc-cited (removes description from context,
  stays user-invocable; `skillOverrides: "user-invocable-only"` = file-less alternative).
- `skill-creator` is an external plugin — Phase 2's checklist rehomed to a NEW on-demand
  `skills/skill-authoring-standards.md` (never always-loaded; references claude-md-standards).
- Hooks don't parse TODO line format (session-boot injects head verbatim; guard-paths matches
  basenames) → additive fields are safe.
- All hides require runtime verification (OSA lesson: config correct ≠ runtime honors it);
  phase gate after OXL-1 (LH lesson: token-diet wins can evaporate at small scale).

**Status:** RESOLVED — plan files written 2026-07-09; branch `phase-oxl-1-conventions`.

---

## 2026-07-09 — VSE-2 grilled → [REFACTORED]: cut library + generator + external seeding [VSE]

**Decision:** `/grill` on VSE-2 (Skeptical Architect) found ~70% speculative infrastructure. User
answers refactored it from a 10-task data phase to a lean refactor.

**What was cut (and why):**
- **Full palette/font library (≥8/≥6)** → replaced with a **tiny 2-3 profile seed**. A library
  for varied deck look-and-feel serves multiple decks; only the one GRI deck exists near-term.
  YAGNI until deck #2.
- **Draft-generator (D3, 4-question intake → LAYOUT_SPEC)** → CUT. Authoring a profile is a
  once-per-deck task creative-director already does; automating it is gold-plating.
- **External seeding from `ui-ux-pro-max-skill`** → CUT. A 2-3 profile seed is trivial to
  hand-author; scraping an external (unverified, assumed-MIT) repo bought curation, not data.
  Removing it eliminates the Blast-Radius dependency risk entirely.
- **Metric 3 was defective** (strategist pre-flag confirmed): "draft LAYOUT_SPEC passes both
  VSE-1 validators" — `validate_prompt.py` validates emitted 13-part *prompts*, not deck
  *profiles*; a LAYOUT_SPEC has no anatomy sections and would fail VP-01 nonsensically. Only
  `contrast_check.py` applies to a profile. Metric rewritten.

**What survives (the load-bearing part):** archetype extraction — lift the 7 layout archetypes
from `design-tokens.md` §6 into `data/archetypes.yaml`, repoint §6 (single-source de-dup, the
real deepening refactor) — plus a hand-authored, contrast-gated 2-3 profile seed.

**Next gate:** Interface-First `[user-approval]` on the (now smaller) YAML schemas before any
data authoring. No branch cut until approved.

---

## 2026-07-09 — VP-01 parts 2/8/9 archetype-conditional (HR1 residual closed) [VSE] — RESOLVED

**Decision:** Standalone MTP (`fix-vp01-archetype-conditional`, merged `44b1c41`), chosen by user
over folding into VSE-2 — independent validator logic shouldn't gate behind a data phase. Part 8
(flow devices) now required only for sequential layouts; parts 2/9 broadened off gold vocabulary.
+4 mutation-verified tests, suite 123/123. Closes the VSE-1 HR1 residual. Re-install needed for
installed sessions to pick it up (repo tests already exercise it).

---

## 2026-07-09 — VSE-1 post-audit rulings: VP-04 proxy, palette darken, HR1 residual → VSE-2 [VSE] — RESOLVED

**Decisions (all user-approved at the T6 gate):**
1. **VP-04 structural proxy accepted.** Plan D1's "contrast statement present" was unsatisfiable —
   neither user-authored gold prompt contains one. Validator accepts explicit ratio/keyword OR
   structural proxy (background colour + distinct text-ink colour) + `\d+pt` font floors. Recorded
   as plan amendment; ruled acceptable under "fix the validator, not the reference".
2. **Accent darkened `#C84A1E` → `#B8431B`** (4.18:1 → 4.83:1 on cream, now passes 4.5:1 body).
   Applied to `design-tokens.md`, `slide-prompt-templates.md`, `SKILL.md`. `reference-slides.md`
   deliberately untouched (historical record of the rendered deck). Residual: rendered slides
   still show the old accent until the next Copilot iteration.
3. **Scope extension over MTP-style deferral.** Worked-example VP-01/VP-02 failures (incl. a real
   `palette.neutrals` leak in Example 2) patched on the phase branch rather than deferred — a
   skill whose own exemplars fail its mandatory gate ships broken-by-default.
4. **HR1 residual formally deferred to VSE-2** (auditor: deferral, not waiver). `PART_CHECKERS`
   2/8/9 are gold-vocabulary-keyed; Part 8 is brief-conditional per the contract. **VSE-2 kickoff
   MUST carry archetype-conditional VP-01 logic as a named task.**

**Evidence:** `Artifacts/Reports/VSE-1-Report.md` (+ Phase Close Addendum). Merged `278270e`.

## 2026-07-08 — Re-scope LH-3 (terminal): drop prose-split, keep deploy-guard + telemetry + doc-sync [LH]

**Decision:** At LH-3 kickoff, recon of the two load-bearing assumptions failed both. Re-scoped the terminal phase to its real value and dropped the "prose payoff" that named it. User approved (Lean + valuable).

**Evidence that forced it:**
1. **Telemetry data source wrong.** `audit_trail.jsonl` logs `{ts,session,tool,input}` = tool invocations, not hook decisions; a *denied* action leaves no entry (blocked pre-exec → PostToolUse audit hook never fires). "How often did gate X block" is unanswerable from it. → Telemetry now requires instrumenting the hooks to emit their own decision events first (`hooks/lib/gate-log.js` → `gate_events.jsonl`).
2. **Prose payoff ≈ 0.** Delete-eligible prose (hard-blocking hooks only, per grill) = commit-trailer (`standards.md:128`, 1 line, fully enforced) + scratch-gate (`orchestration.md` §Scratch Strategy, ~3 lines but only *partially* hook-enforced — the hook doesn't cover the positive "MUST use Artifacts/Temp/" rule). Safely-removable ≈ 1 line, not the ≥20 the old M3 claimed (my metric error — unachievable once the grill killed blocking-lint + TODO-authority). Building `gemini-only.md` + registry-audit drift management to reclaim ~1 line is a bad trade.

**Kept:** deploy-guard (`enforced-rules.json` + deploy.sh FAILs on an unwired enforced hook — closes the exact "deployed .js but forgot settings.json" gap hit manually in LH-1 and LH-2); instrumented telemetry surfaced at `/handoff`; correctness doc-sync (stale auto-lint description + missing nudge-handoff/evidence-gate rows).

**Cut:** prose-split, `rules/gemini-only.md`, `/registry-audit` drift extension. The split-by-consumer decision from the grill is moot — with nothing worth deleting, there is no Claude/Gemini divergence to manage.

**Honesty note:** this drops the initiative's original headline (reclaim always-loaded prose via hook enforcement). That thesis held when 4 blocking hooks were planned; after the grill correctly reduced enforcement to 2 deny-hooks + 3 feedback-hooks, the reclaimable prose shrank below the cost of reclaiming it. The enforcement wins (LH-1/LH-2) stand; the token-diet win does not materialize at this scale, and pretending otherwise would be the rationalization the initiative exists to prevent.

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

*Older RESOLVED entries (3 × 2026-07-06, Phase OSA/OSA-2) rotated →
`Artifacts/History/DECISION_LOG-archive.md`.*
