# VSE-1 TODO — Executable Quality Gates

**Plan:** `Artifacts/Plans/VSE-1-Plan.md` · **Status:** PLANNED (execute after OSH closes)
**Branch (when executed):** `phase-vse-1-quality-gates`

- [x] [coder] Write `scripts/validate_prompt.py` (rules VP-01..VP-06, stdlib only) — Success: 2/2 gold prompts exit 0; 3/3 seeded-bad exit 1 with correct rule ID · **2026-07-09 auditor-verified (fresh re-run): gold_slide_a.txt exit 0, gold_slide_b.txt exit 0, bad_missing_section.txt exit 1 (VP-01), bad_token_leak.txt exit 1 (VP-02), bad_hex.txt exit 1 (VP-03). See `Artifacts/Reports/VSE-1-Report.md` for Hard Rule 1 partial-violation finding (HIGH).**
- [x] [coder] Write `scripts/contrast_check.py` (WCAG 2.1 ratios from LAYOUT_SPEC hexes) — Success: known-fail pair flagged, known-pass pair clean, exit codes correct · **2026-07-09 auditor-verified: fail fixture 3.14:1 exit 1, pass fixture 12.73:1 exit 0 (exact match to claim).**
- [x] [coder] Write `tests/test_pptx_slide_design_validators.py` — Success: pytest exit 0; covers gold-pass, seeded-fail, contrast pass/fail · **2026-07-09 auditor-verified: 14/14 passed (fresh run); full `pytest tests/` 119/119 passed; stdlib-guard test confirmed non-hollow; mutation-check on VP-01 checker confirms the seeded-bad test is a real regression guard (not vacuous).**
- [x] [scribe] Wire enforcement step 5 into SKILL.md; update Hard Rules + Success Metrics; version → 2.1.0 (SKILL.md + plugin.json) — Success: pipeline references both scripts; no other SKILL.md sections altered · **2026-07-09 auditor-verified: `git diff main -- SKILL.md` confirms only pipeline-step-5/Hard-Rules/metrics/version/footer touched; plugin.json 2.0.0→2.1.0 confirmed.**
- [-] [coder] Re-install plugin + live-verify scripts run from a session — Success: `validate_prompt.py` executes against a freshly emitted prompt in a live session, exit code observed · **2026-07-09 live-fire DONE: fresh emission → exit 1 (3 real VP-01 hits) → fixed → exit 0 (`Artifacts/Temp/live_fire_emitted_prompt.txt`). Install half PENDING USER: `visual-storytelling` was never installed (`/plugin install visual-storytelling@ai-code-settings`) — findings `vse1_palette_1`, `vse1_templates_1` filed to BACKLOG. AUDITOR (2026-07-09): live-fire half re-verified fresh (exit 1 without `--no-layout-spec`, exit 0 with it — correct contract). Checkbox stays open pending the install half per plan R4 — NOT phase-closing.**
- [-] [auditor] Gate: all metrics in VSE-1-Plan §Success met with fresh evidence; Hard Rules clean — Success: mark phase `[x]`, authorize merge · **2026-07-09: M1-M4 PASS with fresh evidence; Hard Rules 2/3 clean, Hard Rule 1 PARTIAL (HIGH finding, see report); scope lockdown clean. Phase gate NOT closed — blocked on plugin install + live verification (plan R4) and BACKLOG severity/plan-amendment follow-ups. See `Artifacts/Reports/VSE-1-Report.md`.**

## Hard Rules
1. Invariant-only checks (no coupling to section wording/order)
2. No renderer invocation; text validation only
3. No files touched outside VSE-1-Plan approved list
