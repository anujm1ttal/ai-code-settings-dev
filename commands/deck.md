---
description: PowerPoint deck lifecycle — scaffold projects, build slides, audit compliance, and discover template layouts. Routes to concierge (init), coder (build), auditor (audit).
---

# Command: /deck

Manages PowerPoint deck generation via `python-pptx`. All actions follow `skill-powerpoint-patterns.md` conventions.

## Actions

### `/deck init <project_name>`
**Agent**: Concierge

1. Scaffold project structure:
       <project_name>/
       ├── templates/          # Source .pptx (read-only)
       ├── assets/             # Images, logos, icons
       ├── output/             # Generated decks (gitignored)
       ├── style_constants.py  # Colors, fonts, sizes
       └── main.py             # Generation script skeleton
2. Copy default template to `templates/`.
3. Generate `style_constants.py` with brand defaults from `skill-powerpoint-patterns.md`.
4. Generate `main.py` skeleton with template validation, layout lookup, and save-to-output pattern.
5. Run `/deck layouts` on the default template to populate placeholder mappings.

### `/deck build [--template PATH] [--data PATH] [--output PATH]`
**Agent**: Coder

1. Read `LAYOUT_SPEC.md` for composition plan (if exists).
2. Import style tokens from `style_constants.py`.
3. Run `main.py` (or specified script).
4. Validate output `.pptx` exists and has slides.
5. Report: slide count, file size, output path.

Defaults:
- `--template`: `templates/` first `.pptx` found.
- `--data`: none (script handles its own data).
- `--output`: `output/<project_name>.pptx`.

### `/deck audit [--file PATH]`
**Agent**: Auditor (domain: `pptx`)

Runs two-pass audit against source files and generated output.

**Pass 1 — Source code** (per `skill-powerpoint-patterns.md`):
- Raw EMU values instead of `Inches()` / `Pt()`.
- Magic layout indices instead of name lookup.
- Inline `RGBColor()` instead of `style_constants.py`.
- Missing template validation.
- Template overwrite risk.

**Pass 2 — Visual compliance** (per `skill-visual-composition.md`):
- Content blocks per slide ≤5.
- Font sizes above minimums.
- Consistent alignment and spacing.

Report: pass/fail per check, standard severity format (CRITICAL / HIGH / MEDIUM).

### `/deck layouts [--template PATH]`
**Agent**: Concierge

1. Load template (default: `templates/` first `.pptx`).
2. Iterate all slide layouts.
3. For each layout, print:
   - Layout index and name.
   - Placeholder index, name, type, and dimensions.
4. Output as table for quick reference and `LAYOUT_SPEC.md` population.

## File Dependencies

| File | Role | Created By |
|:---|:---|:---|
| `templates/*.pptx` | Source templates (read-only) | `/deck init` |
| `style_constants.py` | Colors, fonts, sizes | `/deck init` |
| `LAYOUT_SPEC.md` | Composition plan | Creative Director (optional) |
| `main.py` | Generation script | `/deck init` scaffold, Coder extends |
| `output/*.pptx` | Generated decks (gitignored) | `/deck build` |

## Typical Workflow

1. `/deck init quarterly_report` — scaffold project.
2. `/deck layouts` — discover template structure.
3. Coder builds out `main.py` using discovered placeholders.
4. `/deck build` — generate slides.
5. `/deck audit` — check compliance.

## Integration
- `/deck audit` follows the same severity format as `/audit`.
- All script code follows `skill-python-patterns.md`.
- Visual rules flow from `skill-visual-composition.md` → `LAYOUT_SPEC.md` → script.