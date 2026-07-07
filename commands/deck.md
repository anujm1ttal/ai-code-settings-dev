---
description: PowerPoint deck lifecycle — scaffold projects, build slides, audit compliance, and discover template layouts. Routes to concierge (init), coder (build), auditor (audit).
argument-hint: "<init|build|audit|layouts> [options]"
model: claude-sonnet-5
---

# Command: /deck

**Target**: `$1` → action (`init`|`build`|`audit`|`layouts`); remaining args are action-specific `[options]`.

Manages PowerPoint deck generation via `python-pptx`. All actions follow `pptx` conventions.

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
3. Generate `style_constants.py` with brand defaults from `pptx`.
4. Generate `main.py` skeleton with template validation, layout lookup, and save-to-output pattern.
5. Run `/deck layouts` on the default template to populate placeholder mappings.

### `/deck build [--template PATH] [--data PATH] [--output PATH] [--team]`
**Agent**: Coder

1. Read `Artifacts/LAYOUT_SPEC.md` for composition plan (if exists).
2. If `--team` is passed and slide count > 5, spawn multiple **coder teammates** to implement different sections in parallel. If token context limits are hit, fallback to standard execution.
3. Import style tokens from `style_constants.py`.
4. Run `main.py` (or specified script).
5. Validate output `.pptx` exists and has slides.
6. Report: slide count, file size, output path.

Defaults:
- `--template`: `templates/` first `.pptx` found.
- `--data`: none (script handles its own data).
- `--output`: `output/<project_name>.pptx`.

### /deck audit [--team]

**Agent**: Auditor

Runs two-pass audit against source files and generated output. If `--team` is passed, spawn a `creative-director` teammate to perform Pass 2 (visual compliance) simultaneously while the lead `auditor` computes Pass 1. If token context limits are hit, fallback to standard execution.

**Pass 1 — Source code** (per `pptx`):
- Raw EMU values instead of `Inches()` / `Pt()`.
- Magic layout indices instead of name lookup.
- Inline `RGBColor()` instead of `style_constants.py`.
- Missing template validation.
- Template overwrite risk.

**Pass 2 — Visual compliance** (per `visual-composition`):
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
4. Output as table for quick reference and `Artifacts/LAYOUT_SPEC.md` population.

## File Dependencies

| File | Role | Created By |
|:---|:---|:---|
| `templates/*.pptx` | Source templates (read-only) | `/deck init` |
| `style_constants.py` | Colors, fonts, sizes | `/deck init` |
| `Artifacts/LAYOUT_SPEC.md` | Composition plan | Creative Director (optional) |
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
- All script code follows `python-patterns`.
- Visual rules flow from `visual-composition` → `Artifacts/LAYOUT_SPEC.md` → script.