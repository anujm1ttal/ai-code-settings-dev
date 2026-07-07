# VSE-1 TODO — Executable Quality Gates

**Plan:** `Artifacts/Plans/VSE-1-Plan.md` · **Status:** PLANNED (execute after OSH closes)
**Branch (when executed):** `phase-vse-1-quality-gates`

- [ ] [coder] Write `scripts/validate_prompt.py` (rules VP-01..VP-06, stdlib only) — Success: 2/2 gold prompts exit 0; 3/3 seeded-bad exit 1 with correct rule ID
- [ ] [coder] Write `scripts/contrast_check.py` (WCAG 2.1 ratios from LAYOUT_SPEC hexes) — Success: known-fail pair flagged, known-pass pair clean, exit codes correct
- [ ] [coder] Write `tests/test_pptx_slide_design_validators.py` — Success: pytest exit 0; covers gold-pass, seeded-fail, contrast pass/fail
- [ ] [scribe] Wire enforcement step 5 into SKILL.md; update Hard Rules + Success Metrics; version → 2.1.0 (SKILL.md + plugin.json) — Success: pipeline references both scripts; no other SKILL.md sections altered
- [ ] [coder] Re-install plugin + live-verify scripts run from a session — Success: `validate_prompt.py` executes against a freshly emitted prompt in a live session, exit code observed
- [ ] [auditor] Gate: all metrics in VSE-1-Plan §Success met with fresh evidence; Hard Rules clean — Success: mark phase `[x]`, authorize merge

## Hard Rules
1. Invariant-only checks (no coupling to section wording/order)
2. No renderer invocation; text validation only
3. No files touched outside VSE-1-Plan approved list
