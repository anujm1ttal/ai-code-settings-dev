# VSE-1 Plan — Executable Quality Gates for `pptx-slide-design`

**Initiative:** VSE — Visual Storytelling Enhancement (Step 0 approved 2026-07-07)
**Status:** PLANNED — do not execute until OSH initiative closes (user directive 2026-07-07)
**Branch (when executed):** `phase-vse-1-quality-gates` (cut from `main` post-OSH merge)
**Mode:** Standard orchestration (not high-rigor)
**Origin:** Architecture pattern borrowed from `ui-ux-pro-max-skill` (executable validation of output against anti-patterns); see DECISION_LOG 2026-07-07 context in TODO index.

## Objective

Convert the skill's self-assessed Hard Rules / anti-patterns into deterministic, runnable
validators, so an emitted Copilot prompt is machine-checked instead of model-graded
(inspection-as-verification eliminated at the skill's output boundary).

## Design constraint (R1 — unproven core)

Phase 3 of the parked pptx project (Copilot Premium render test) has NOT run. Validators
must therefore check only **invariants expected to survive anatomy tweaks**:
section presence, token leakage, hex well-formedness, accessibility statements, fallback
banner. No checks on section *content wording* or ordering beyond the 13 numbered parts.

## Deliverables

### D1 — `scripts/validate_prompt.py` (new)
Location: `optional_plugins/visual-storytelling/skills/pptx-slide-design/scripts/`
Contract (Interface-First):
- **Input:** emitted prompt text via file arg or stdin; optional `--no-layout-spec` flag
  (asserts fallback banner must be present).
- **Output:** violation list to stdout (one line per violation, `RULE-ID: message`);
  exit 0 = clean, exit 1 = violations.
- **Checks (rule IDs):**
  - `VP-01` all 13 anatomy sections present (per design-tokens.md §13-Part table)
  - `VP-02` zero abstract token leakage — regex `palette\.\w+|type\.scale\.\w+`
  - `VP-03` all hex values well-formed (`#[0-9A-Fa-f]{6}`) and ≥1 palette hex present
  - `VP-04` contrast statement present (≥4.5:1 body / ≥3:1 large) and font-size floors stated
    - *Amendment (2026-07-09, T6 audit ruling A): gold prompts contain no genuine contrast
      statement, making the literal check unsatisfiable. VP-04 accepts an explicit
      ratio/keyword statement OR the structural proxy both golds carry (explicit background
      colour + distinct text-ink colour), plus `\d+pt` font-size floors. Ruled acceptable
      under "fix the validator, not the reference".*
  - `VP-05` fallback banner `[fallback: visual-composition defaults]` present iff `--no-layout-spec`
  - `VP-06` single copy-paste block (no multi-step "first…, then…" interaction markers)
- Python 3.12+, stdlib only. No new dependencies.

### D2 — `scripts/contrast_check.py` (new)
Same location. Contract:
- **Input:** path to a `LAYOUT_SPEC.md` (or any md/yaml containing role→hex pairs);
  parses background + text-role hexes.
- **Output:** WCAG 2.1 relative-luminance contrast ratio for every text/background pair;
  flags `FAIL` below 4.5:1 (body) / 3:1 (large). Exit 1 on any FAIL.
- Stdlib only (~60 lines).

### D3 — SKILL.md wiring (edit)
Add an **Enforcement** step to the 4-step pipeline (becomes step 5): run `validate_prompt.py`
on every emitted prompt before presenting; run `contrast_check.py` when a LAYOUT_SPEC is
loaded. Update Hard Rules + Success Metrics to reference the scripts as the verification
mechanism. Bump `metadata.version` → 2.1.0; bump plugin.json → 2.1.0.

### D4 — Tests (new)
`tests/test_pptx_slide_design_validators.py` (pytest):
- Both gold-standard prompts from `references/reference-slides.md` pass `validate_prompt.py` (exit 0)
- ≥3 seeded-bad prompts each trip their intended rule (missing section, token leakage, bad hex)
- Known-fail palette pair (e.g., `#888888` on `#F5F1E8`) flagged by `contrast_check.py`;
  known-pass pair (`#2A2A2A` on `#F5F1E8`) passes

## Approved file list (scope lockdown)

| File | Action |
|:---|:---|
| `optional_plugins/visual-storytelling/skills/pptx-slide-design/scripts/validate_prompt.py` | CREATE |
| `optional_plugins/visual-storytelling/skills/pptx-slide-design/scripts/contrast_check.py` | CREATE |
| `optional_plugins/visual-storytelling/skills/pptx-slide-design/SKILL.md` | EDIT (pipeline step 5, Hard Rules, metrics, version) |
| `optional_plugins/visual-storytelling/.claude-plugin/plugin.json` | EDIT (version bump) |
| `tests/test_pptx_slide_design_validators.py` | CREATE |
| `Artifacts/Plans/VSE-1-TODO.md` | status tracking |

## Success metrics (numeric)

1. `validate_prompt.py`: 2/2 gold-standard prompts exit 0; 3/3 seeded-bad prompts exit 1 with correct rule ID
2. `contrast_check.py`: 1 known-fail pair flagged, 1 known-pass pair clean
3. `pytest tests/test_pptx_slide_design_validators.py` exit 0; full `pytest tests/` still exit 0
4. Zero new pip dependencies (stdlib-only verified by import scan)

## Hard Rules (auditor rejects on violation)

1. Validators check invariants only — no coupling to section wording/ordering (R1 guard)
2. Skill still never generates files or invokes renderers; scripts validate text only
3. No edits outside the approved file list (banana-prompt untouched)

## Risks

- **R1** unproven core → mitigated by invariant-only checks (above)
- **R4** plugin scripts don't deploy via `deploy.sh` — they ship via plugin re-install.
  Phase close requires plugin re-install + live verification, not a deploy.sh run.

## Dependencies

None on the blocked Copilot test. None on OSH files (zero overlap). Can start immediately
after OSH closes.

## Post-audit amendments (2026-07-09, user-approved)

Scope extension beyond the original approved file list, ruled at the T6 gate + user decision:

| File | Action | Why |
|:---|:---|:---|
| `references/slide-prompt-templates.md` | EDIT | `vse1_templates_1` fix: Example 3 markers (parts 2/8/9), Example 2 takeaway header + `palette.neutrals` VP-02 leak; accent hex swap |
| `references/design-tokens.md` | EDIT | `vse1_palette_1` fix: accent `#C84A1E` → `#B8431B` (4.83:1, contrast_check exit 0) |
| `SKILL.md` | EDIT | Accent hex consistency in 2 illustrative examples; VP-04 comment references |
| `scripts/validate_prompt.py` | EDIT | Audit item 4: VP-04 comment overclaim corrected |

`reference-slides.md` untouched (historical record of the rendered deck). Evidence: all 3 worked
examples validate exit 0; design-tokens contrast exit 0; suite 119/119. Residual to VSE-2:
archetype-conditional VP-01 logic (HR1).
