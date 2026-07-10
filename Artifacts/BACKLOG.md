# Backlog — Deferred Work & Findings

Unscheduled deferred work, filed findings, and pending product decisions.
Reference-on-demand (not boot-loaded). ID format: `<phase>_<component>_<n>`.

---

## `oxl_routing-violations_1` — 21 historical model-routing violations in session transcripts

**Filed:** 2026-07-10 (OXL-1 T9 smoke run, routing audit) · **Severity:** MEDIUM

`python scripts/model_routing_audit.py --violations-only` (unscoped) reports 21 violations across
4 historical sessions: `0034d334` (13× coder/auditor/strategist ran on Haiku), `b0910c55`
(6× coder inherited the main-session model `claude-fable-5` instead of Sonnet binding),
`c265a752` (scribe on Sonnet), `550a42d0` (auditor on `qwen3.5-tuned` — non-Anthropic model,
investigate how). All predate OXL-1; today's session (`df244fcd`) is clean 13/13.
**Action when picked up:** determine whether these were deliberate alternate-model sessions
(then document + exclude via `--since` convention) or a real routing bypass (then root-cause).
The `/afk` runner's routing-audit metric is date-scoped (`--since <run date>`) precisely so this
historical noise cannot poison future gates.

---

## ~~`lh3_gate-log_1` — `logGateEvent(null)` throws before entering its own try/catch~~ — RESOLVED

**Filed:** 2026-07-08 (LH-3 audit) · **Resolved:** 2026-07-08 (LH-3, strategist ruled fix-now) · **Severity:** ~~MEDIUM~~ → none

**Resolution:** `logGateEvent(params)` now does `const { ... } = params || {}` INSIDE the try body — the
function is structurally incapable of throwing for any argument (`null`/`undefined`/`42`/`str`/array/
no-arg all verified no-throw). 2 regression tests added; suite 105 passed exit 0. The helper's
self-contained fail-open claim is now true in isolation, not just via call-site wrapping.

---

## ~~`vse1_palette_1` — Terracotta accent `#C84A1E` fails 4.5:1 body contrast on cream~~ — RESOLVED

**Filed:** 2026-07-09 (VSE-1 T2 verification) · **Resolved:** 2026-07-09 (user ruled: darken) · **Severity:** ~~LOW~~ → none

**Resolution:** Accent darkened `#C84A1E` → `#B8431B` (4.83:1 on cream, fresh `contrast_check.py`
PASS exit 0) in `design-tokens.md`, `slide-prompt-templates.md`, `SKILL.md`. `reference-slides.md`
deliberately untouched — it is the historical record of the rendered deck. **Residual:** existing
rendered slides still show `#C84A1E`; the next Copilot iteration of the deck carries the new accent.

`contrast_check.py` run against the real deck profile in `design-tokens.md` computes `#C84A1E` on
`#F5F1E8` at **4.18:1** — below the 4.5:1 body-text threshold (passes 3:1 large-text). Affected use:
the top-right badge label. If the badge label qualifies as large/label text, document that in
design-tokens.md so the checker's role heuristic classifies it accordingly; otherwise darken the
accent (~`#B8431B` region) and re-run the checker. Do NOT silently change the palette — it is
user-authored gold-slide fidelity.

---

## ~~`vse1_templates_1` — Worked examples in slide-prompt-templates.md fail VP-01~~ — RESOLVED (template patch); residual → VSE-2

**Filed:** 2026-07-09 (VSE-1 T5 live-fire) · **Severity:** ~~MEDIUM → HIGH~~ → residual MEDIUM · **Resolved:** 2026-07-09 (user-approved scope extension, same branch)

**Resolution (template half):** All 3 worked examples now exit 0 (fresh run). Example 3 gained its
3 missing markers (content-truth, flow device, `BOTTOM LINE`); Example 2 — found failing during the
fix, beyond the audit's scope — had a missing takeaway header AND a real `palette.neutrals` VP-02
token leak in teaching material, both fixed.

**Resolution (validator half — RESOLVED 2026-07-09, standalone MTP `fix-vp01-archetype-conditional`):**
The HR1 partial-violation is now closed. `validate_prompt.py` VP-01 made archetype-conditional:
- **Part 8 (flow devices)** — required ONLY for sequential layouts (storyboard / timeline / ordinal
  panels / stages, via `RE_SEQUENTIAL_LAYOUT`); static layouts (grid, hero, title, two-column,
  full-bleed) pass without one, matching `design-tokens.md` §13 (Part 8 = brief-sourced).
- **Parts 2 & 9** — regexes broadened to phrasing-agnostic signals (no longer keyed to the two
  golds' exact words).
Tests: +4 (static-passes-without-flow, sequential-missing-flow-still-fails guard, broadened 2/9);
mutation-verified non-hollow; full suite 123/123. Note: keyword signals still have theoretical
edge cases (a sequential layout not naming storyboard/timeline/panel), acceptable — the check now
errs toward not-blocking, and the guard test locks the common sequential case.

A prompt emitted faithfully from **Example 3 (Grid of Cards)** fails `validate_prompt.py` with 3
VP-01 violations: missing part 2 (content-truth directive), part 8 (flow device), part 9 (takeaway
header). The validator's markers are tuned to the two gold prompts in `reference-slides.md` (correct
per plan — golds are the fidelity bar), but SKILL.md now mandates Step 5 on EVERY emission, so
prompts modeled on the worked examples fail out of the box. Live-fire evidence: fresh emission
exit 1 → 3 additions (one line each) → exit 0. Fix: patch the 3 worked examples to carry the
missing invariant markers (content-truth line, flow-device line, `BOTTOM LINE` header). Templates
were already flagged "user to refine via Copilot iteration" — fold this in there.

**Auditor addendum (2026-07-09, VSE-1 gate, independently re-derived — not taken on claim):**
Re-extracted Example 3's own worked output verbatim from `slide-prompt-templates.md` (the
coder's original claim is accurate) and confirmed the same 3 violations fresh:
`VP-01: missing section 2 (Content-truth directive)`, `... section 8 (Flow / iteration devices)`,
`... section 9 (Takeaway line)`, exit 1. Root cause is deeper than "3 missing lines": this is a
**Hard Rule 1 (invariant-only) partial violation**, not just a template gap —
`design-tokens.md:98` itself documents Part 8 ("Flow devices") as sourced from **Brief**, i.e.
conditional on the slide's narrative, not a universal invariant; a static Grid-of-Cards slide has
no legitimate reason to carry an iteration loop. `PART_CHECKERS[2]` and `PART_CHECKERS[9]` are
similarly keyed to the two golds' specific vocabulary (`"show the actual"`, `"metaphor"`,
`"bottom line"/"closing line"/"takeaway"`) rather than a general "content-truth directive exists"
or "takeaway line exists" structural signal. Re-classified MEDIUM → HIGH because: (1) Step 5 is
now mandatory and synchronous per SKILL.md — this is a live, reproducible production blocker for
at least 1 of 7 layout archetypes today, not a hypothetical; (2) "fold into templates refinement"
risks indefinite deferral of a Hard-Rule-relevant gap. Recommend: schedule as an MTP-eligible
micro-task (single file, <30 lines) promptly — either a VSE-1 fast-follow or the first VSE-2 task —
and treat it as a prompt to reconsider whether VP-01 parts 2/8/9 need archetype-conditional logic
(not just literal missing lines) rather than a pure template patch. Full detail:
`Artifacts/Reports/VSE-1-Report.md` §Hard Rule 1.

---

## `oxl_wayfinder_1` — `/blueprint --foggy` (wayfinder decision-ticket mode) deferred

**Filed:** 2026-07-09 (OXL grill cut) · **Severity:** LOW · **Needs:** demand evidence, then Step 0

Wayfinder pattern (mattpocock/skills): for initiatives whose destination can't be named, chart a
map (Destination / Decisions-so-far / Not-yet-specified fog / Out-of-scope) + child decision
tickets (research/prototype/grilling/task) sized to one session — "tickets resolve decisions, not
deliverables." Cut at OXL grill: zero observed demand (every past initiative's fog was burned off
by /blueprint + one /grill session). **Revival trigger:** an initiative arrives whose destination
still can't be named after one grill session. Design as a `/blueprint` MODE, not a new command;
map reuses existing artifact types.

---

## `vse2_yaml-dep_1` — PyYAML undeclared; YAML schema tests skip silently without it

**Filed:** 2026-07-09 (VSE-2 audit ruling) · **Severity:** LOW · **Needs:** small dep-declaration pass

The VSE-2 schema-sanity tests guard on `pytest.mark.skipif(yaml is None)`. PyYAML 6.0.3 is present
in the current env (tests ran, 0 skipped — audit-verified) but the repo declares NO dependencies at
all (no `pyproject.toml`/`requirements.txt`) — a pre-existing gap, not introduced by VSE-2. In a
PyYAML-less env the schema gate vanishes silently. The safety-critical gate (`contrast_check.py`,
stdlib-only) is unaffected. **Fix:** declare PyYAML as a dev dependency when the repo gains a
`pyproject.toml` (fits the uv workflow in `python-patterns` §uv Workflow: `uv add --dev pyyaml`).

---

## `vse2_layout-menu-dup_1` — templates' "Layout Menu" table partially repeats archetype data

**Filed:** 2026-07-09 (VSE-2 audit, LOW, non-blocking) · **Severity:** LOW · **Needs:** doc pass

`references/slide-prompt-templates.md` §"Layout Menu & How Part 6 Varies" (pre-existing, VSE-1-era)
repeats archetype names + short zone text now single-sourced in `data/archetypes.yaml`. Different
schema (no intent/when_to_use) and outside VSE-2's approved file list, so not an HR4 violation for
that phase — but it's residual duplication. Fix: repoint that table to `data/archetypes.yaml` in a
future doc pass (batch with `osh_docs-count_1`).

---

## `lh3_telemetry-deploy_1` — Gate telemetry reader is repo-local; hooks log everywhere

**Filed:** 2026-07-08 (LH-3 ship) · **Severity:** LOW · **Needs:** product decision

`hooks/lib/gate-log.js` deploys with the hooks, so `gate_events.jsonl` is written in EVERY project.
But `scripts/gate_telemetry.py` (the reader) is not deployed (`deploy.sh` excludes `scripts/` by
design; see repo CLAUDE.md). So `/handoff`'s telemetry step only produces a table inside the
ai-code-settings repo. Made graceful in LH-3 (`commands/handoff.md:50` now skips the sub-step when
the script is absent rather than erroring). **Enhancement (deferred):** to close the telemetry loop
globally, either deploy `gate_telemetry.py` to `~/.claude/` (policy change — scripts currently not
deployed) or fold a minimal reader into a deployed location. Product call: is per-project gate
telemetry worth the deploy-policy change, or is repo-local dev observability sufficient?

---

## `cmd_gemini-parity_1` — GEMINI.md holds old combined (pre-split) content

**Filed:** 2026-07-06 (CMD, deferred out of scope) · **Severity:** LOW · **Needs:** product decision

When CLAUDE.md was split into `CLAUDE-global.md` (deployable) + lean repo `CLAUDE.md` (CMD
initiative, `a393e2b`), `GEMINI.md` was left holding the old combined content — it is a manual
parallel mirror for Gemini/Antigravity and is **not** deployed. Out of scope per CMD Step 0.
Also surfaced by LH closure ("Deferred: GEMINI.md parity"). **Decision needed:** is Gemini
parity still wanted? If yes, re-sync GEMINI.md to the split structure; if no, close this and
note GEMINI.md as intentionally-divergent/unmaintained.

---

## `osa_subagent-tier_1` — Subagents may run on the wrong model tier

**Filed:** 2026-07-06 (OSA B5) · **Severity:** MEDIUM · **Needs:** separate Step 0 + runtime probe

OSA finding: subagents appeared to run on a default tier (haiku) rather than the tier their
`model:` frontmatter declares (sonnet/opus) — i.e. the runtime may ignore per-agent `model:`.
Not fixed in OSA (needs its own Step 0). Related: `rules/common/model-routing.md` §Verification
(`scripts/model_routing_audit.py --violations-only`) and the `statusline-model-visibility`
memory (subagentStatusLine schema pending post-restart verify). **Next:** run the routing audit
from live subagent transcripts to confirm/refute before scoping a fix — config being correct
does not prove the runtime honors it.

---

## `osh_docs-count_1` — Stale "17 skills" count in out-of-scope docs

**Filed:** 2026-07-07 (OSH-4) · **Severity:** LOW · **Needs:** doc pass

OSH-4 moved `business-analyst` from the manuscript plugin to core, dropping the
optional-plugin skill count 17 → 16. Two files still say "17 skills" but were
**not** in OSH-4's approved file list, so they were left untouched per Hard Rule 2
(deletions/edits enumerated-only):

- `README.md` (3 occurrences)
- `Artifacts/MEMORY_ANCHORS.md` (2 occurrences)

Fix: update both to 16 (or point them at `optional_plugins/index.md` as the single
source of truth for the count, matching the `skills.overview.md:5` DRY fix applied
in OSH-4). Trivial; batch into any future doc-sync pass.

---

## ~~`osh_hooks-gaps_1..4` — New hook features (deferred from OSH-1)~~ — GRADUATED to LH (3 of 4)

**Filed:** 2026-07-07 (OSH-1) · **Graduated:** 2026-07-08 → LH initiative (`Plans/LH-1-Plan.md`)

Separate Step 0 completed 2026-07-08 (LH blueprint + grill). Disposition:

1. **`osh_hooks-gaps_1` — Stop/SubagentStop handoff nudge** → **LH-1 T4** (nudge-only;
   additionalContext, never blocks).
2. **`osh_hooks-gaps_2` — PreCompact hook** → **STRUCK — unimplementable.** PreCompact
   is absent from the current hook-events list (SessionStart, SessionEnd,
   UserPromptSubmit, Stop, StopFailure, PreToolUse, PostToolUse — official docs check
   2026-07-08 via claude-code-guide). Re-file only if the event returns to the harness.
3. **`osh_hooks-gaps_3` — Scratch-dir hard-gate** → **LH-1 T2** (state-basename deny
   under shadow paths; memory/ allowlisted).
4. **`osh_hooks-gaps_4` — Commit-trailer guard** → **LH-1 T3** (Bash + PowerShell forms).

---

## ~~`osa_model-routing_1` — Runtime bypasses assigned model tiers~~ — RESOLVED (not a bug)

**Filed:** 2026-07-06 · **Resolved:** 2026-07-06 · **Severity:** ~~HIGH~~ → none

**Original claim:** the audit showed 15 honored / 21 violated / 45 runs — agents
apparently downgraded to Haiku at runtime.

**Resolution:** false positive from historical data. Model routing was set up on
July 3; the audit was scanning transcripts back to June against the new config.
Scoping to post-config transcripts (`--since 2026-07-05`) yields **0 violations /
3 honored**. The 21 "violations" decompose as: 2 Qwen (June experiments, not even
Claude models), 6 Fable (one deliberate July-4 Fable session — main thread was
213 msgs of `claude-fable-5`), 13 Haiku (one July-3 setup-day session). **No
post-config downgrades exist — routing is honored.**

**Outcome:** added `--since YYYY-MM-DD` to the audit tool so historical/alt-model
sessions no longer register as false positives; corrected `model-routing.md`.

---

## ~~`osa_plugin-docs_2` — Reconcile/retire the bespoke plugin manifest~~ — RESOLVED

**Filed:** 2026-07-06 · **Resolved:** 2026-07-06 (Phase OSA-2) · **Severity:** ~~MEDIUM~~

**Decision:** Option 3 (full retire). The entire bespoke manifest system was
deleted — `manifest_validator.py`, root `project.json` + 9 templates + schema,
`/manifest` command, 7 `plugin.yaml` sidecars, `plugin_manifest_schema.json`, the
2 manifest test files, 4 dead migration scripts, and the dormant
`guard-commit-evidence.js` hook. Native `.claude-plugin/` + `enabledPlugins` is
now the single plugin registry. Docs pruned across ~14 files; `skill_graph_analyzer`
made self-contained; `MEMORY_ANCHORS.md` updated to native architecture.

**Residual (accepted):** one illustrative `project.json type` mention in
`skills/receiving-code-review/SKILL.md` left untouched per Hard Rule 1 (no skill
content edits).

---

## ~~`osa_plugin-scope_3` — Permanent per-plugin enable scope~~ — CLOSED (by design)

**Filed:** 2026-07-06 · **Closed:** 2026-07-06 · **Severity:** LOW

**Resolution:** no blanket decision needed — decide per project. Per-project
`enabledPlugins` in `.claude/settings.json` already delivers the "only load what
the project needs" goal, and the mechanism is in place + documented
(`optional_plugins/index.md`). Forcing a global default now would re-create the
global-install anti-pattern that was explicitly rejected. Each project enables the
plugins it needs as it adopts them.
