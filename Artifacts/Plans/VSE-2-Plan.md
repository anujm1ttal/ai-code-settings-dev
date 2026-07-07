# VSE-2 Plan — Design-Data Library + Draft LAYOUT_SPEC Generator

**Initiative:** VSE — Visual Storytelling Enhancement (Step 0 approved 2026-07-07)
**Status:** PLANNED — blocked on VSE-1 completion; **mandatory `/grill` before kickoff**
**Branch (when executed):** `phase-vse-2-design-data`
**Mode:** Standard orchestration

## Objective

Replace prose-embedded design knowledge with a tagged, queryable YAML library
(palettes / font pairs / layout archetypes), seeded from ui-ux-pro-max-skill (MIT),
and give the creative-director a deterministic intake → **draft** `LAYOUT_SPEC.md` flow.
Human curates; the generator never publishes an authoritative spec.

## Pre-kickoff gates

1. **`/grill`** — phase spec exceeds 50 lines; stress-test mandatory before execution.
2. **`[user-approval]` Interface-First** — YAML schemas approved before any data entry
   is authored. No data work until the contract is signed off.

## Deliverables

### D1 — Data schemas + files (Interface-First, `[user-approval]`)
Location: `optional_plugins/visual-storytelling/skills/pptx-slide-design/data/`
- `palettes.yaml` — per entry: id, name, role→hex map (background/ink/accent/muted/categorical),
  tags (tone[], audience[], medium[]), `status: vetted|unvetted`, `source` (attribution), license
- `font-pairs.yaml` — id, heading family, body family, mono family, fallbacks, tags, status, source
- `archetypes.yaml` — the existing 7 layout archetypes lifted from `design-tokens.md` §6
  into structured form (id, name, intent, zones, when-to-use, tags)
- Schema documented at top of each file (comment block); no JSON Schema file unless
  `/grill` demands one (Minimalism).

### D2 — Seeding pass (ui-ux-pro-max, MIT)
- Cherry-pick candidate palettes + font pairings from
  `github.com/nextlevelbuilder/ui-ux-pro-max-skill` data files.
- Filter for projection/slide suitability (no low-contrast web-pastel sets; no fonts
  absent from standard Windows/Office installs unless flagged).
- Every seeded palette runs through VSE-1 `contrast_check.py`; only passing entries may
  be marked `vetted`, and only after human spot-check. All else stays `unvetted`.
- Attribution: `source: ui-ux-pro-max-skill (MIT)` per seeded entry; repo-level credit
  line in the skill's references.

### D3 — Mapping table + intake procedure
- `references/profile-mapping.md` — (project type + tone + audience) → candidate palette
  ids / font-pair ids / archetype emphasis. Deterministic lookup, no scoring engine.
- Creative-director flow addition: 4-question intake (industry/domain, audience,
  tone, deck length) → emit **draft** `Artifacts/LAYOUT_SPEC.md` assembled from vetted
  entries, clearly bannered `[DRAFT — creative-director/user must review]`.
- Touchpoint: `agents/creative-director.md` gets a pointer to the flow (≤5 lines);
  the procedure itself lives in the skill reference (keeps agent file thin).

### D4 — SKILL.md + design-tokens.md updates
- `design-tokens.md` §6 archetype table becomes a pointer to `data/archetypes.yaml`
  (single source; no duplication).
- Deep-Load Protocol updated: data files loaded on demand (library is small enough to
  load whole; **no search engine** — explicitly deferred until >25–30 entries).
- Version bumps: SKILL.md metadata + plugin.json → 2.2.0.

## Approved file list (scope lockdown)

| File | Action |
|:---|:---|
| `…/pptx-slide-design/data/palettes.yaml` | CREATE |
| `…/pptx-slide-design/data/font-pairs.yaml` | CREATE |
| `…/pptx-slide-design/data/archetypes.yaml` | CREATE |
| `…/pptx-slide-design/references/profile-mapping.md` | CREATE |
| `…/pptx-slide-design/references/design-tokens.md` | EDIT (§6 → pointer) |
| `…/pptx-slide-design/SKILL.md` | EDIT (Deep-Load, version) |
| `optional_plugins/visual-storytelling/.claude-plugin/plugin.json` | EDIT (version) |
| `agents/creative-director.md` | EDIT (≤5-line pointer) |
| `tests/test_pptx_slide_design_validators.py` | EDIT (data-file schema sanity tests) |
| `Artifacts/Plans/VSE-2-TODO.md` | status tracking |

## Success metrics (numeric)

1. ≥8 palettes with `status: vetted` (each passed contrast_check + human spot-check); ≥6 vetted font pairs
2. 100% of seeded entries carry `source` attribution; 0 entries vetted without a contrast_check pass
3. Draft-generator dry run: 4-answer intake produces a LAYOUT_SPEC draft that passes both VSE-1 validators on first try
4. 0 duplicated archetype definitions (grep: archetype table exists in exactly one file)
5. `pytest tests/` exit 0

## Hard Rules (auditor rejects on violation)

1. Generator output is always bannered DRAFT — never presented as final spec
2. No entry marked `vetted` without contrast_check evidence
3. No search/lookup engine in this phase (Decision Ladder rung 1 — revisit at >25 entries)
4. `LAYOUT_SPEC.md` remains the single deck-profile source of truth; data library feeds
   drafts only (design-tokens.md precedence order unchanged)

## Risks

- **R3** web-origin palettes unsuited to projection → mitigated by contrast gate + `unvetted` default
- **Upstream churn** — ui-ux-pro-max is v0.9.x; seeding is a one-time copy, no live dependency
- **R1 carry-over** — if the Copilot render test (parked pptx Phase 3) forces anatomy changes,
  data library is unaffected (palette/font data is anatomy-independent)
