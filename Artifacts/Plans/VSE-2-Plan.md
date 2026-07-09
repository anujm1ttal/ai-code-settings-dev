# VSE-2 Plan (REFACTORED) — Archetype Extraction + Tiny Profile Seed

**Initiative:** VSE — Visual Storytelling Enhancement
**Status:** REFACTORED 2026-07-09 via `/grill` → [REFACTORED] (see DECISION_LOG). Awaiting
Interface-First `[user-approval]` on YAML schemas before data authoring.
**Branch (when approved):** `phase-vse-2-archetype-data`
**Mode:** Standard orchestration · lean single-session scope

## What changed (grill outcome)

Cut from the original 10-task plan: the ≥8-palette/≥6-font library, the 4-question draft
generator (D3), `profile-mapping.md`, the `creative-director.md` edit, and all external
`ui-ux-pro-max` seeding. See DECISION_LOG 2026-07-09. Metric 3 (defective) rewritten.

## Objective

1. **Single-source the 7 layout archetypes** — lift them from `design-tokens.md` §6 prose table
   into structured `data/archetypes.yaml`; repoint §6 to the data file (de-dup — the deepening
   refactor).
2. **Seed 2-3 vetted deck profiles** (hand-authored, contrast-gated) so future decks have a
   starting choice. The existing GRI profile is entry #1; 1-2 additional hand-picked profiles.
   No external scraping.

## Deliverables

### D1 — `data/archetypes.yaml` (CREATE) + §6 repoint (Interface-First, `[user-approval]`)
Location: `optional_plugins/visual-storytelling/skills/pptx-slide-design/data/`
- 7 entries, each: `id`, `name`, `intent`, `zones`, `when_to_use`, `tags[]` — lifted 1:1 from
  `design-tokens.md` §6 (no new archetypes).
- `design-tokens.md` §6 table becomes a pointer to `data/archetypes.yaml` (single source).
- Schema documented in a header comment block; no JSON Schema file (Minimalism).

### D2 — `data/profiles.yaml` (CREATE, tiny seed) (Interface-First, `[user-approval]`)
- 2-3 deck profiles. Each: `id`, `name`, `palette` (role→hex: background/ink/accent/muted/
  categorical), `font_pair` (heading/body/mono families), `tags[]` (tone/audience/medium),
  `status: vetted|unvetted`, `source` (hand-authored, or attribution if borrowed).
- Entry #1 = the GRI · KICK-OFF profile, extracted from the existing design-tokens/LAYOUT_SPEC
  (cream `#F5F1E8`, accent `#B8431B`, charcoal `#2A2A2A`, Georgia/serif + Cascadia Code).
- Additional 1-2 profiles hand-authored; each palette runs through VSE-1 `contrast_check.py`;
  only passing profiles may be `vetted` (after human spot-check).

### D3 — Tests (EDIT `tests/test_pptx_slide_design_validators.py`)
- Schema sanity: both YAML files parse; required keys present per entry; archetypes count == 7.
- Contrast gate: every `vetted` profile's text/background pairs pass `contrast_check.py` (exit 0).

### D4 — SKILL.md deep-load pointer + version (EDIT)
- Deep-Load Protocol: `data/archetypes.yaml` + `data/profiles.yaml` loaded on demand (small,
  whole-file load; no search engine).
- `design-tokens.md` §6 pointer (see D1).
- Version bump: SKILL.md metadata + plugin.json → 2.2.0.

## Approved file list (scope lockdown)

| File | Action |
|:---|:---|
| `…/pptx-slide-design/data/archetypes.yaml` | CREATE |
| `…/pptx-slide-design/data/profiles.yaml` | CREATE |
| `…/pptx-slide-design/references/design-tokens.md` | EDIT (§6 → pointer) |
| `…/pptx-slide-design/SKILL.md` | EDIT (Deep-Load, version) |
| `optional_plugins/visual-storytelling/.claude-plugin/plugin.json` | EDIT (version) |
| `tests/test_pptx_slide_design_validators.py` | EDIT (YAML schema + contrast-gate tests) |
| `Artifacts/Plans/VSE-2-TODO.md` | status tracking |

## Success metrics (numeric, corrected)

1. `data/archetypes.yaml` has exactly 7 archetypes; archetype definitions exist in exactly 1 file
   (grep: §6 no longer contains the table, only a pointer).
2. `data/profiles.yaml` has 2-3 profiles; 100% carry `source`; 0 marked `vetted` without a
   `contrast_check.py` pass.
3. Every `vetted` profile's palette passes `contrast_check.py` (exit 0) — fresh evidence.
4. `pytest tests/` exit 0.

*(Removed the original metric 3: "draft LAYOUT_SPEC passes both VSE-1 validators" — the generator
is cut, and `validate_prompt.py` does not apply to deck profiles.)*

## Hard Rules (auditor rejects on violation)

1. No profile marked `vetted` without `contrast_check.py` evidence.
2. `LAYOUT_SPEC.md` remains the single deck-profile source of truth; `profiles.yaml` is a
   starting-choice seed, never authoritative for a live deck.
3. No generator, no search/lookup engine, no external scraping this phase (Decision Ladder rung 1
   — revisit a real library only when deck #2 exists).
4. Archetype definitions exist in exactly 1 file after the §6 repoint.

## Risks

- **Anatomy churn (R1 carry-over):** if the parked Copilot render test forces anatomy changes,
  archetype/profile data is unaffected (palette/font/archetype data is anatomy-independent).
- **Profile authority confusion:** mitigated by Hard Rule 2 — `profiles.yaml` feeds starting
  choices only; the live deck's `LAYOUT_SPEC.md` still wins.

## Dependencies

None external (seeding dependency removed by grill). Depends only on VSE-1's shipped
`contrast_check.py` for the vetting gate.
