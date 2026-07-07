# VSE-2 TODO — Design-Data Library + Draft Generator

**Plan:** `Artifacts/Plans/VSE-2-Plan.md` · **Status:** PLANNED (blocked on VSE-1)
**Branch (when executed):** `phase-vse-2-design-data`

- [ ] [strategist] Run `/grill` on VSE-2-Plan — Success: risks addressed or plan amended; user go-ahead recorded
- [ ] [strategist] `[user-approval]` Interface-First: YAML schemas for palettes/font-pairs/archetypes — Success: explicit approval label received before any data authored
- [ ] [coder] Author `data/archetypes.yaml` (lift 7 archetypes from design-tokens.md §6); repoint §6 — Success: archetype definitions exist in exactly 1 file (grep-verified)
- [ ] [coder] Seed `data/palettes.yaml` + `data/font-pairs.yaml` from ui-ux-pro-max (MIT, attributed), all entries `unvetted` — Success: 100% entries carry source attribution
- [ ] [auditor] Vet seeded entries: contrast_check pass + human spot-check → flip to `vetted` — Success: ≥8 vetted palettes, ≥6 vetted font pairs, 0 vetted without evidence
- [ ] [coder] Author `references/profile-mapping.md` (type+tone+audience → candidate ids) — Success: deterministic lookup, no scoring engine
- [ ] [scribe] Creative-director intake flow (4 questions → DRAFT LAYOUT_SPEC) + ≤5-line pointer in `agents/creative-director.md` — Success: dry-run draft passes both VSE-1 validators first try
- [ ] [scribe] SKILL.md Deep-Load update + version bumps → 2.2.0 (SKILL.md + plugin.json) — Success: data files on-demand loaded; no search engine added
- [ ] [coder] Extend validator tests with data-file schema sanity checks — Success: `pytest tests/` exit 0
- [ ] [auditor] Gate: all VSE-2-Plan §Success metrics met with fresh evidence — Success: mark phase `[x]`, authorize merge

## Hard Rules
1. Generator output always bannered DRAFT
2. No `vetted` without contrast_check evidence
3. No search/lookup engine this phase
4. LAYOUT_SPEC.md stays single source of truth for deck profiles
