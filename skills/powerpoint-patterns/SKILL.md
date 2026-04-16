---
name: powerpoint-patterns
description: Conventions and patterns for generating and modifying PowerPoint decks using python-pptx. Template-first workflow, unit system, style constants, and shape creation.
argument-hint: "<slide composition requirement or placeholder discovery>"
metadata:
  version: "1.0.0"
tags: ["python", "powerpoint", "pptx", "presentations"]
globs: ["*.pptx", "style_constants.py", "scripts/deck_*.py"]
verbosity_control: "TECHNICAL. Prioritize code blocks over prose. Use high-density bullet points for logic rules."
---

# Skill: PowerPoint Patterns

## 📐 Core Principles
- **Template-First**: Always load an existing `.pptx` template. Never `Presentation()` with no argument.
- **Save-to-New**: Never overwrite the source template. Always save to a separate output path.
- **Discover, Don't Assume**: Look up layouts by name and placeholders by iteration — never hardcode indices.
- **Centralize Style**: All colors, fonts, and sizes live in `style_constants.py`. No inline `RGBColor()` in slide-building code.
- **One Idea Per Slide**: Follow `Artifacts/LAYOUT_SPEC.md` from Creative Director. Max 5 content blocks per slide.
- **EMU Helpers Only**: Never raw integers for measurements. Always `Inches()`, `Pt()`, `Emu()`.

## 📦 Imports & Constants

Standard imports for all deck scripts:

    from pptx import Presentation
    from pptx.util import Inches, Pt, Emu
    from pptx.dml.color import RGBColor
    from pptx.enum.text import PP_ALIGN

Define all measurements and style tokens at module top or import from `style_constants.py`:

    # style_constants.py
    BRAND_PRIMARY   = RGBColor(0x00, 0x2A, 0x5C)
    BRAND_ACCENT    = RGBColor(0xE8, 0x4D, 0x0E)
    BRAND_FONT      = "Arial"
    TITLE_FONT_SIZE = Pt(28)
    BODY_FONT_SIZE  = Pt(14)
    MARGIN          = Inches(0.5)
    CONTENT_WIDTH   = Inches(9.0)

## 🔍 Layout & Placeholder Discovery

- **Layout lookup**: Always by name, never by index.

    def get_layout(prs, name):
        for layout in prs.slide_layouts:
            if layout.name == name:
                return layout
        raise ValueError(f"Layout '{name}' not found in template")

- **Placeholder discovery**: Print before building. Indices vary across templates.

    for ph in slide.placeholders:
        print(ph.placeholder_format.idx, ph.name, ph.shape_id)

- Cache discovered indices as named constants per template. Document them in `Artifacts/LAYOUT_SPEC.md`.

## 🛠 Shape Creation Patterns

### Text Box

    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = "Content"
    p.font.size = BODY_FONT_SIZE
    p.font.name = BRAND_FONT

### Table

    shape = slide.shapes.add_table(rows, cols, left, top, width, height)
    table = shape.table
    table.cell(0, 0).text = "Header"

### Image

    slide.shapes.add_picture("image.png", left, top, width, height)

- Always constrain both `width` and `height`. Never let images scale unbounded.
- Source images go in `assets/`. Never embed paths to user-local directories.

### Chart
- Use `python-pptx` `ChartData` API. Prefer simple types: bar, line, column.
- Complex or interactive visuals belong in dedicated tools (Power BI), not generated slides.

## ✅ Template Validation

Run at script start, before any slide creation. Fail fast if template doesn't match assumptions.

    def validate_template(prs, required_layouts):
        available = {layout.name for layout in prs.slide_layouts}
        missing = set(required_layouts) - available
        if missing:
            raise ValueError(f"Template missing layouts: {missing}")

- Verify expected layouts exist by name.
- Verify expected placeholders exist by index.

## 📂 File Conventions

| Path | Purpose | Rules |
|:---|:---|:---|
| `templates/` | Source `.pptx` templates | Read-only. Never overwrite. |
| `style_constants.py` | Colors, fonts, sizes | Single source of truth for all decks. |
| `scripts/deck_*.py` | Deck generation scripts | One script per deck type. |
| `assets/` | Images, logos, icons | Referenced by scripts. Relative paths only. |
| `output/` | Generated decks | Never committed to repo. Gitignored. |
| `Artifacts/LAYOUT_SPEC.md` | Composition plan | From Creative Director. Consumed, not edited. |

## 🚫 Anti-Patterns (Explicit Deny List)
- No `Presentation()` without a template argument.
- No `prs.slide_layouts[1]` — look up by name.
- No inline `RGBColor()` in slide-building code — use `style_constants.py`.
- No raw EMU values (`914400`) — use `Inches(1)`.
- No overwriting the source template — save to `output/`.
- No assumed placeholder indices — discover from template.
- No slides with >5 distinct content blocks — split or simplify.
- No hardcoded absolute image paths — use relative paths from `assets/`.
- No `print()` for logging — use `loguru` per `python-patterns.md`.

## 🔨 Toolchain
- **Library**: `python-pptx` — native `.pptx` manipulation. No COM automation, no LibreOffice.
- **Style**: All rules from `python-patterns.md` apply (type hints, ruff, pytest, loguru).
- **Composition**: Visual direction from `Artifacts/LAYOUT_SPEC.md` produced by Creative Director.
- **Validation**: Auditor checks via `pptx` audit domain — see `agent-auditor.md`.