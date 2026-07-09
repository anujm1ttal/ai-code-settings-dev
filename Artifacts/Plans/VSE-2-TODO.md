# VSE-2 TODO (REFACTORED) — Archetype Extraction + Tiny Profile Seed

**Plan:** `Artifacts/Plans/VSE-2-Plan.md` · **Status:** REFACTORED 2026-07-09 (grill [REFACTORED]);
awaiting Interface-First `[user-approval]` on YAML schemas
**Branch (when approved):** `phase-vse-2-archetype-data`

- [x] [strategist] `[user-approval]` Interface-First: YAML schemas for `archetypes.yaml` +
      `profiles.yaml` — Success: explicit approval label before any data authored
      (**2026-07-09 auditor: user approval recorded in conversation — "Approve as-is" =
      `[APPROVED] · [SAFE]`. No separate DECISION_LOG entry for this specific approval line;
      accepted per dispatch instruction as the basis for this mark.**)
- [x] [coder] Author `data/archetypes.yaml` (lift 7 archetypes from design-tokens.md §6); repoint
      §6 to the data file — Success: 7 archetypes; definitions in exactly 1 file (grep-verified)
      (**2026-07-09 auditor: `yaml.safe_load` confirms 7 entries, all 6 required keys present;
      spot-checked 3 entries (title-section, hero-plus-evidence, full-bleed-visual) against
      `git show main:.../design-tokens.md` §6 — intent/zones/when_to_use wording verbatim match.
      grep for "Hero + Evidence" across the plugin found one other hit in
      `references/slide-prompt-templates.md` (pre-existing VSE-1-era "Part 6 varies" table, not
      touched by this diff, not in the approved file list, distinct schema — Part-6-structure
      mechanics, not id/intent/zones/when_to_use/tags). Filed as a LOW backlog item, not a Hard
      Rule 4 violation — HR4/M1 scope is the §6 table this phase owns.**)
- [x] [coder] Author `data/profiles.yaml` (2-3 profiles; #1 = GRI, hand-authored, all `unvetted`
      initially) — Success: 100% carry `source` attribution
      (**2026-07-09 auditor: 3 profiles parsed, 100% carry non-empty `source`. Note: plan/TODO
      specified profiles start `unvetted` pending auditor vetting; coder shipped all 3 already
      `status: vetted` inline per explicit dispatch instruction — see next line for independent
      re-verification of that shortcut.**)
- [x] [auditor] Vet profiles: `contrast_check.py` pass + human spot-check → flip to `vetted` —
      Success: 0 vetted without contrast evidence; every vetted palette exits 0
      (**2026-07-09 auditor: independently re-verified, NOT taken on the coder's claim. Wrote
      3 fresh temp spec files (`Artifacts/Temp/audit_contrast_*.md`, deleted after use — not
      reused from coder's evidence) and ran `contrast_check.py` directly:
      gri-kickoff ink/bg 12.73:1 PASS, accent/bg 4.83:1 PASS, exit 0;
      boardroom-dark ink/bg 14.79:1 PASS, accent/bg 6.73:1 PASS, exit 0;
      editorial-light ink/bg 12.82:1 PASS, accent/bg 7.67:1 PASS, exit 0.
      All three match the header-comment claims exactly. Font pairs (Georgia, Cascadia Code,
      Segoe UI/Segoe UI Semibold, Consolas, Cambria, Calibri) are all standard Windows/Office
      fonts — sanity-judged fine. Role-crossover note: coder performed vetting inline per
      dispatch instruction (auditor-owned task); this line records the auditor's independent
      re-run as the actual gate, per orchestration.md verification discipline.**)
- [x] [coder] Extend `tests/` with YAML schema sanity + per-profile contrast-gate checks —
      Success: `pytest tests/` exit 0
      (**2026-07-09 auditor: fresh `python -m pytest tests/ -v` → 131 passed, 0 skipped, 0
      failed, exit 0. New YAML tests confirmed to have actually RUN (not silently skipped) in
      this environment — PyYAML 6.0.3 present. See Phase-Close Report for the skipif-guard
      ruling (acceptable, with a noted env-dependency caveat filed to BACKLOG).**)
- [x] [scribe] SKILL.md Deep-Load pointer (data files on demand) + version → 2.2.0 (SKILL.md +
      plugin.json) — Success: no search engine added; §6 pointer in place
      (**2026-07-09 auditor: confirmed. SKILL.md frontmatter `version: "2.2.0"` + footer
      "Version: 2.2", `plugin.json` `"version": "2.2.0"` — all three match. Deep-Load table adds
      both data files as on-demand whole-file loads, explicitly "no search engine" in both rows.
      Role-crossover note: scribe-owned task done inline by coder per dispatch scope; auditor
      confirms on this review per dispatch instruction.**)
- [-] [auditor] Gate: all VSE-2-Plan §Success metrics met with fresh evidence — Success: mark
      phase `[x]`, authorize merge; re-install + live-verify (plugin scripts ship via install)
      (**2026-07-09 auditor: all 4 success metrics + all 4 Hard Rules PASS with fresh evidence —
      see `Artifacts/Reports/VSE-2-Report.md`. Merge to `main` is AUTHORIZED. Left `[-]` per this
      line's own success condition: phase close still pends plugin re-install + live-verify since
      plugin scripts ship via install, not repo-tree execution alone.**)

## Hard Rules
1. No profile `vetted` without contrast_check evidence
2. LAYOUT_SPEC.md stays single source of truth; profiles.yaml is a seed only
3. No generator, no search engine, no external scraping this phase
4. Archetype definitions in exactly 1 file after §6 repoint

## Cut by grill (2026-07-09) — do NOT re-add without a new Step 0
Full ≥8/≥6 library · 4-question draft generator · profile-mapping.md · creative-director.md edit ·
external ui-ux-pro-max seeding. Rationale: DECISION_LOG 2026-07-09.
