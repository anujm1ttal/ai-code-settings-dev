# Deck Profile Contract: `pptx-slide-design`

> **Purpose.** Defines the **FIXED LAYER** (deck-wide constants) that this skill reads from `Artifacts/LAYOUT_SPEC.md` (authored by `creative-director`) and auto-injects into every slide prompt. The skill resolves all token values (hex, fonts, sizes) and emits them **concrete** into the Copilot prompt — never abstract names. This ensures deck consistency and makes Copilot's rendering job unambiguous.
>
> **Core principle:** The skill is a bridge from deck profile + slide brief → slide-ready Copilot prompt at the **exact fidelity of the reference slides** (see `reference-slides.md`).

**Source of truth precedence:**
1. `Artifacts/LAYOUT_SPEC.md` (per-project, `creative-director`-authored) — wins.
2. `style_constants.py` (per-project literal token values) — values live here.
3. `visual-composition/SKILL.md` (fallback defaults only) — used only if LAYOUT_SPEC.md absent.

---

## Deck Profile Structure

The profile is a **fixed contract** — same fields on every slide in the deck. The user supplies this once per deck via `LAYOUT_SPEC.md`; the skill reads it and auto-injects it into every prompt.

### 1. Palette (Color Layer)

| Role | Name & Hex | Usage |
|:---|:---|:---|
| **Background** | Warm cream `#F5F1E8` | Full-slide background; clean, diagrammatic, no photo |
| **Primary (Ink)** | Charcoal `#2A2A2A` | Titles, body text, strong contrast elements |
| **Accent** | Terracotta `#B8431B` | Highlights, badges, arrows, connectors; use sparingly |
| **Muted greys** | `#888888` (text), `#666666` (secondary), `#555555` (labels), `#D6D0C4` (rules/outlines), `#A8A29A` (close-out) | Section headings, footer, muted annotations |
| **Categorical** | Soft blue `#7BA7BC`, soft green `#8FAE6D`, soft yellow `#E8C547` | Card/region fills, heatmap colours, data visualization; use at 30–40% opacity for backgrounds, 65–75% for active data |

**Auto-inject rule:** Every emitted prompt includes these exact hex values and usage guidance, so Copilot renders slides that match their siblings.

### 2. Fonts (Typography Layer)

| Role | Family | Usage | Example |
|:---|:---|:---|:---|
| **Serif (Heading/Takeaway)** | Deck serif (e.g., Georgia, Palatino) | Titles (no full stop), takeaway lines, body text | "The model can answer back" (title) |
| **Monospace (Labels/Headings)** | Cascadia Code | Section headings (small caps, 10–11pt), footer, page numbers (italic), annotations | "01 · Intent" (section); "Cascadia Code Italic" (footer L) |

**Font rules:**
- Titles: serif family, dark charcoal `#2A2A2A`, **no full stop**, size inherited per region
- Section headings: Cascadia Code, small caps, 10–11pt, muted grey `#888888`
- Footer left: Slide title in Cascadia Code Italic, muted grey, smaller size
- Footer right: Page number in Cascadia Code Regular, muted grey
- Body: Serif or clean sans, 10–11pt, dark charcoal or muted grey per context

### 3. Furniture (Deck-Wide Layout Constants)

**Top-left:** Slide title (serif, dark charcoal, no full stop)  
**Top-right badge:** "GRI · KICK-OFF" label + thin terracotta rule `#B8431B` — **keep exactly as on other slides**  
**Footer left:** Slide title in Cascadia Code Italic, muted grey `#888888`  
**Footer right:** Page number in Cascadia Code Regular, muted grey `#888888`  
**Background:** Warm cream `#F5F1E8`, no photographic background, clean/diagrammatic style

### 4. Card Convention (Repeating Pattern)

All cards/regions follow this standard:
- **Shape:** Rounded rectangle (4–6pt corner rounding)
- **Background:** Light fill at 30–40% opacity of the region's primary colour (e.g., soft blue @ 35% opacity for a blue region)
- **Accent bar:** Thin colour bar on top or left edge (full opacity, matching region colour)
- **Outline:** Thin line, muted grey `#D6D0C4`
- **Padding:** Generous internal spacing (1× base unit minimum)
- **Text inside:** Cascadia Code or serif body, dark charcoal, 10–11pt

### 5. Tone Defaults (Deck-Wide Style)

- Clean · minimal · diagrammatic · architectural/editorial · honest · calm · research-oriented · clear at a glance
- Avoid: metaphors (cake/car/recipe) · AI robot/brain/magic-wand icons · fake futuristic UI · heavy 3D render · dense technical diagrams · long paragraphs · bright saturated colours · decorative imagery · the term "DSL"

### 6. Layout Menu — Per-Slide Archetype Options

The skill picks one of these 7 layouts based on the user's slide brief (§3 below):

**Single source of truth:** `data/archetypes.yaml` (VSE-2 D1) — the 7 archetype definitions
(`id`, `name`, `intent`, `zones`, `when_to_use`, `tags`) live there, not here. Load that file
whole (Deep-Load Protocol) rather than duplicating the table in prose.

**Fallback mapping:** If no LAYOUT_SPEC.md, use visual-composition defaults (Charcoal Minimal palette, Editorial fonts, 2–3 column grid, 0.25in spacing unit).

---

## 13-Part Prompt Anatomy (Skill Output Structure)

Every emitted prompt follows this structure, with parts 3, 4, 5, 9-styling, 10, 11, 12 **auto-injected** from the profile; the user supplies 1, 2, 6, 7-content, 8, 9-text, 13.

| # | Section | Source | Role |
|:--|:---|:---|:---|
| 1 | Command + purpose | Brief | "Rebuild Slide N... keep the purpose..." |
| 2 | Content-truth directive | Brief | "Show the actual object, not metaphor" |
| 3 | Title + styling | Profile + brief | Serif font, charcoal, no full stop (from profile; text from brief) |
| 4 | Furniture (badge, footer) | **Profile ONLY** | "Keep the top-right GRI · KICK-OFF badge exactly as other slides" |
| 5 | Background | **Profile ONLY** | Cream `#F5F1E8`, no photo, diagrammatic |
| 6 | Overall layout | Brief | Zones, panels, proportions, reading order, connectors |
| 7 | Per-region spec | Brief + profile | Region heading (Cascadia Code, small caps, 10–11pt, muted grey), visual device, exact content, **+ Purpose line** |
| 8 | Flow devices | Brief | Arrows, loops, heatmap logic |
| 9 | Takeaway line | Brief + profile | Text from brief; styling from profile (serif italic, ~20pt, charcoal, centre-aligned) |
| 10 | Visual tone | Profile + brief | Adjectives: clean, minimal, diagrammatic, architectural, honest, calm, research-oriented, clear at a glance |
| 11 | Forbidden list | Profile + brief | Deck-wide anti-cliché (metaphors, AI icons, fake UI, dense diagrams, DSL term, long paragraphs); slide-specific specifics |
| 12 | Palette (with hex) | **Profile ONLY** | Exact hex values resolved from deck profile: `#F5F1E8` (background), `#B8431B` (accent), `#2A2A2A` (charcoal), muted greys, categorical colours with opacities |
| 13 | Speaker-note intent | Brief | The verbal narrative this visual should support |

**Critical inversion (v1 mistake fixed):** Parts 3–5, 9-styling, 10, 11, 12 use **concrete hex and named fonts** (e.g., "Cascadia Code", "#B8431B", "18–20pt"), NOT abstract token names like `palette.primary` or `type.scale.title`. Token names live only in this contract prose (what the skill reads); the emitted prompt is user-facing and must render without external resolution.

---

## Fallback Defaults (if no LAYOUT_SPEC.md)

If a project has no `Artifacts/LAYOUT_SPEC.md`, the skill uses these fallback values:

| Element | Fallback | Source |
|:---|:---|:---|
| **Palette** | Charcoal Minimal: `#36454F` (primary), `#F2F2F2` (secondary), `#212121` (accent) | visual-composition defaults |
| **Fonts** | Editorial: Georgia (serif, heading), Calibri (body) | visual-composition defaults |
| **Type scale** | 5 steps: title ~40pt, subtitle ~24pt, body ≥12pt, caption ~10pt, footnote ≥10pt | visual-composition §Typography Rules |
| **Grid** | 2–3 columns (2 typical; 3 for multi-card layouts), consistent margins, F/Z reading flow | visual-composition §Grid Rules |
| **Spacing unit** | 0.25in / 8px, all gaps as integer multiples | visual-composition defaults |
| **Archetypes** | All 7 available; density ≤5 blocks per slide, ≤2 charts, ≤6 body lines | visual-composition §Repeating Patterns |

When fallback is used, the emitted prompt includes: `[fallback: visual-composition defaults]` so the user knows to supply a project-specific `LAYOUT_SPEC.md` for branded output.

---

**Last updated:** 2026-07-04  
**Serves:** `pptx-slide-design` skill output generation  
**Worked examples:** See `reference-slides.md` (Slide A "The model can answer back", Slide B "The year ahead")  
**Dependency:** `visual-composition/SKILL.md` (fallback source), `creative-director` (LAYOUT_SPEC.md author)
