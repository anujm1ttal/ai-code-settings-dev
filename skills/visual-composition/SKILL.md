---
name: visual-composition
description: Use this skill whenever you are planning or reviewing visual layouts, hierarchy, and brand governance across any medium (slides, reports, dashboards). It enforces "Hierarchy First" design, scannability, and accessibility standards (contrast, font size). Trigger when the creative-director is drafting a LAYOUT_SPEC.md or when an auditor is performing a visual quality check. Do NOT use for technical implementation details like python-pptx code or Power BI theme JSON; refer to specialized document skills for those implementations.
argument-hint: "<design requirement or layout constraint>"
model: claude-sonnet-5
metadata:
  version: "1.0.1"
  tags: ["design", "layout", "accessibility", "visual-design", "composition", "standards"]
  globs: ["Artifacts/LAYOUT_SPEC.md", "style_constants.py"]
  verbosity_control: "STRICT. Bullet-driven rules. No subjective language — every principle must be auditable."
---


# Skill: Visual Composition

## 🎯 Core Principles
- **Hierarchy First**: Every page/slide/screen has exactly one focal point. If everything is emphasized, nothing is.
- **One Idea Per View**: Each screen communicates one dominant takeaway. Supporting detail is subordinate.
- **Scannability Over Exhaustiveness**: Optimize for fast comprehension, not maximum content density.
- **Earned Space**: Every visual element (chart, icon, image) must clarify meaning. No decoration.
- **Systematic Alignment**: Objects align to a defined grid, not to convenience or visual "feel."
- **Functional White Space**: Empty space separates ideas, improves scanning, and reduces cognitive load. It is not wasted.

## 📐 Layout Systems

### Grid Rules
- Define a grid before placing content. Column count depends on medium:
  - **Slides**: 2–3 columns max. Simpler is better.
  - **Dashboards**: 4–6 column grid. Visuals snap to columns.
  - **Reports/Documents**: Single or two-column body. Sidebar optional.
- All elements align to grid edges. No free-floating objects.
- Consistent margins across all pages of a deliverable. Define once in `Artifacts/LAYOUT_SPEC.md`.

### Spacing
- Use a base spacing unit (e.g., 0.25in / 8px). All gaps are multiples of this unit.
- Vertical rhythm: consistent spacing between sections, headings, and body content.
- Group related items with tight spacing. Separate unrelated items with wider gaps.

### Reading Flow
- Default: top-left → right → down (F-pattern for text-heavy, Z-pattern for visual-heavy).
- Primary message occupies the top-left quadrant or full-width top band.
- Secondary content below or to the right of primary.
- Tertiary detail (footnotes, sources, caveats) anchored to bottom or margins.

## 🔤 Information Hierarchy

### Levels (apply to every screen)

| Level | Role | Visual Treatment |
|:---|:---|:---|
| **Primary** | Main takeaway or headline | Largest type, strongest contrast, top position |
| **Secondary** | Supporting evidence or context | Medium type, standard weight, mid-page |
| **Tertiary** | Detail, annotations, caveats | Smallest type, muted color, bottom or margins |
| **Remove** | Anything that doesn't support the message | Delete it. Don't shrink it — remove it. |

### Emphasis Tools (in order of preference)
1. **Position**: Top-left or center gets seen first.
2. **Size**: Larger elements dominate.
3. **Weight**: Bold or heavier font weight draws attention.
4. **Contrast**: High contrast against background signals importance.
5. **Color**: Use sparingly — accent color for one element per view, not many.
6. **Isolation**: Surrounding an element with white space elevates it.

- Never rely on color alone for emphasis. Combine with size or position.
- Never emphasize more than 2 elements on a single screen.

## 📊 Density Control

### Limits Per Screen Type

| Medium | Max Content Blocks | Max Charts | Max Text Lines (body) |
|:---|:---|:---|:---|
| Slide | 5 | 2 | 6 |
| Dashboard page | 8 visuals | 6 | Titles + labels only |
| Report page | 3 sections | 2 | 30 |

- **Content block** = one distinct unit: a chart, a text block, a table, an image, a KPI card.
- If a screen exceeds limits → split into two screens or demote content to appendix.
- Tables over 5 rows on a slide → move to appendix or use a detail page.

### Pacing
- Alternate between dense and sparse screens. Never stack 3+ dense screens in a row.
- Section dividers or transition slides reset cognitive load.
- Full-bleed images or single-stat screens act as visual breathing room.

## ♿ Accessibility

### Non-Negotiable
- **Contrast ratio**: Minimum 4.5:1 for body text, 3:1 for large text (18pt+). Test with a contrast checker.
- **Font size**: Minimum 12pt for body text, 10pt for footnotes. Nothing smaller.
- **Color independence**: Never use color as the sole differentiator. Pair with labels, patterns, or icons.
- **Alt text**: Every image and chart in final deliverables gets descriptive alt text.
- **Reading order**: Logical reading order must survive screen-reader or tab-navigation testing.

### Strongly Recommended
- Limit font families to 2 per deliverable (1 heading, 1 body).
- Limit color palette to 5–6 colors including neutrals. Define in `style_constants.py`.
- Avoid thin font weights (<400) for anything below 16pt.
- No text on busy image backgrounds without a solid or semi-transparent overlay.

## 🎨 Color & Typography Governance

### Color Rules
- All colors sourced from `style_constants.py`. No ad hoc hex values.
- **Primary brand color**: Used for titles, key accents, and anchoring elements.
- **Accent color**: Used sparingly — one accent element per screen max.
- **Neutral palette**: Grays for body text, borders, backgrounds. Define 3–4 shades.
- **Semantic colors**: Red = negative/alert, green = positive/success, amber = warning. Use consistently.
- **Chart colors**: Define a fixed sequence. Never rely on tool defaults.

### Typography Rules
- One font family for headings, one for body. Defined in `style_constants.py`.
- Type scale: Define 4–5 sizes (title, subtitle, body, caption, footnote). No sizes outside the scale.
- Line height: 1.3–1.5× font size for body text. Tighter for headings (1.1–1.2×).
- No underline for emphasis — reserve underline for hyperlinks only.
- No all-caps for body text. All-caps acceptable for short labels or section tags only.

## 🧩 Repeating Patterns

### Why Patterns Matter
- Repeating layout structures across pages build familiarity and reduce cognitive load.
- The audience learns the structure once, then focuses on content.

### Common Archetypes

| Pattern | Structure | Best For |
|:---|:---|:---|
| **Hero + Evidence** | Large headline/stat top, supporting detail below | Insight slides, KPI pages |
| **Two-Column Compare** | Left vs. right with shared header | Before/after, option comparison |
| **Grid of Cards** | Repeated small units in rows | Multi-item summaries, team bios |
| **Top Summary + Detail** | KPI bar or headline strip, detail table/chart below | Dashboard pages, exec summaries |
| **Left Narrative + Right Visual** | Text left, chart/image right | Analysis slides, case studies |
| **Full-Bleed Visual** | Single image or graphic, minimal text overlay | Section openers, impact moments |

- Choose 3–5 patterns per deliverable. Document in `Artifacts/LAYOUT_SPEC.md`.
- Deviations from established patterns require justification.

## 🚫 Anti-Slop Deny List (Explicit Rejection Criteria)

The `auditor` will REJECT any deliverable containing these low-effort "slop" patterns:

- **Banned Fonts (Display/Heading)**: Inter, Roboto, Arial, Segoe UI, or any browser/OS default. These signal "unstyled." Use the [Typography Pairings](#typography-pairings) below.
- **Banned Layouts**: 
  - Centered everything (titles, body, images all center-aligned).
  - Uniform rounded corners (every box having the same 8px radius).
  - Purple/Blue gradients on plain white backgrounds.
- **Banned Patterns**: 
  - Accent lines under titles (the hallmark of AI-generated content).
  - Cookie-cutter card grids (3 cards in a row with icons, no visual variety).
  - Generic hero sections with centered large text and no focal point.
- **Banned Spacing**: Random gaps, elements nearly touching (< 0.2in), inconsistent margins.

## 🌈 Concrete Palette Options

Use these named palettes to ensure a professional, designed feel. Reference them by name in `Artifacts/LAYOUT_SPEC.md`.

| Theme | Primary | Secondary | Accent |
|:---|:---|:---|:---|
| **Midnight Executive** | `1E2761` (navy) | `CADCFC` (ice blue) | `FFFFFF` (white) |
| **Forest & Moss** | `2C5F2D` (forest) | `97BC62` (moss) | `F5F5F5` (cream) |
| **Coral Energy** | `F96167` (coral) | `F9E795` (gold) | `2F3C7E` (navy) |
| **Warm Terracotta** | `B85042` (terracotta) | `E7E8D1` (sand) | `A7BEAE` (sage) |
| **Ocean Gradient** | `065A82` (deep blue) | `1C7293` (teal) | `21295C` (midnight) |
| **Charcoal Minimal** | `36454F` (charcoal) | `F2F2F2` (off-white) | `212121` (black) |

## 🔤 Typography Pairings

| Type | Header Font | Body Font | Rationale |
|:---|:---|:---|:---|
| **Editorial** | Georgia | Calibri | High contrast, professional, trustworthy. |
| **Tech/Clean** | Impact | Arial | Bold, aggressive, efficient. |
| **Modern Serif** | Palatino | Garamond | Elegant, high-end, sophisticated. |
| **Monospace** | Consolas | Calibri | Technical, analytical, precise. |

## 🔍 Audit Checklist
Used by Auditor agent to verify visual deliverables against this skill:

- [ ] Every screen has one identifiable focal point.
- [ ] Content blocks per screen within density limits.
- [ ] All elements align to defined grid.
- [ ] Contrast ratios meet minimums (4.5:1 body, 3:1 large).
- [ ] No font sizes below minimum thresholds.
- [ ] Colors sourced from `style_constants.py` only.
- [ ] Max 2 font families used.
- [ ] No color-only meaning encoding.
- [ ] Repeating patterns consistent across deliverable.
- [ ] Alt text present on images and charts.
- [ ] Spacing uses defined base unit multiples.

## 🔗 Relationships
- **Consumed by**: Creative Director (composition planning), Auditor (compliance checks), Coder (implementation guidance).
- **Complements**: `pptx` (PowerPoint-specific), `powerbi-report` (Power BI-specific).
- **Style tokens**: `style_constants.py` is the single source of truth for colors, fonts, and sizes.
- **Layout plans**: `Artifacts/LAYOUT_SPEC.md` is the per-deliverable application of these principles.