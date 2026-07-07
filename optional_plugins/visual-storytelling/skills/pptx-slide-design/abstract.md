# Skill Abstract: PowerPoint Slide Design via Copilot Premium (L0)

**Purpose**: Emit copy-paste-ready 13-part prompts for Copilot Premium to render slides matching a deck profile.

**Core Logic**:
- **Two-layer input**: Fixed deck profile (`Artifacts/LAYOUT_SPEC.md` — palette, fonts, furniture) + per-slide brief (purpose, layout, content).
- **Concrete over abstract**: Emitted prompts use concrete hex/font values, never token names — Copilot needs literal values.
- Load `references/design-tokens.md`, `reference-slides.md`, `slide-prompt-templates.md` before every prompt.

**Constraint**: Do NOT use to author slide content, generate `.pptx` files, or invoke a renderer — text prompts only.
