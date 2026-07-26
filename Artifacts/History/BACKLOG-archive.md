# BACKLOG Archive — Rotated Entries

Rotated out of `Artifacts/BACKLOG.md` per `rules/common/orchestration.md` §BACKLOG Lifecycle.
**Append-only — entries are never deleted, only moved here.** Newest-first.

Only `RESOLVED` entries rotate. `OPEN` entries never rotate regardless of age.

---

## ~~`vse1_palette_1` — Terracotta accent `#C84A1E` fails 4.5:1 body contrast on cream~~ — RESOLVED

**Filed:** 2026-07-09 (VSE-1 T2 verification) · **Resolved:** 2026-07-09 (user ruled: darken) · **Severity:** ~~LOW~~ → none
**Rotated:** 2026-07-26 (BLR-1)

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
**Rotated:** 2026-07-26 (BLR-1)

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

## ~~`lh3_gate-log_1` — `logGateEvent(null)` throws before entering its own try/catch~~ — RESOLVED

**Filed:** 2026-07-08 (LH-3 audit) · **Resolved:** 2026-07-08 (LH-3, strategist ruled fix-now) · **Severity:** ~~MEDIUM~~ → none
**Rotated:** 2026-07-26 (BLR-1)

**Resolution:** `logGateEvent(params)` now does `const { ... } = params || {}` INSIDE the try body — the
function is structurally incapable of throwing for any argument (`null`/`undefined`/`42`/`str`/array/
no-arg all verified no-throw). 2 regression tests added; suite 105 passed exit 0. The helper's
self-contained fail-open claim is now true in isolation, not just via call-site wrapping.

---

## ~~`osh_hooks-gaps_1..4` — New hook features (deferred from OSH-1)~~ — GRADUATED to LH (3 of 4)

**Filed:** 2026-07-07 (OSH-1) · **Graduated:** 2026-07-08 → LH initiative (`Plans/LH-1-Plan.md`)
**Rotated:** 2026-07-26 (BLR-1)

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
**Rotated:** 2026-07-26 (BLR-1)

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
**Rotated:** 2026-07-26 (BLR-1)

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
**Rotated:** 2026-07-26 (BLR-1)

**Resolution:** no blanket decision needed — decide per project. Per-project
`enabledPlugins` in `.claude/settings.json` already delivers the "only load what
the project needs" goal, and the mechanism is in place + documented
(`optional_plugins/index.md`). Forcing a global default now would re-create the
global-install anti-pattern that was explicitly rejected. Each project enables the
plugins it needs as it adopts them.
