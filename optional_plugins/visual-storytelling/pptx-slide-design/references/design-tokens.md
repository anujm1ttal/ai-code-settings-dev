# Design-Token Contract: `pptx-slide-design`

> **Purpose.** Defines the design tokens `pptx-slide-design` reads at prompt-generation time and the closed 7-type slide taxonomy those tokens feed. This is a **contract** (expected field shape), not a schema and not a token source. The token *values* come from a per-project `Artifacts/LAYOUT_SPEC.md` (emitted by `creative-director`, backed by `style_constants.py`); the token *vocabulary* is owned by `visual-composition`.

**Hard Rule (Plan §1.2):** `pptx-slide-design` **reads** tokens — it never redefines them. If a value is absent, apply the [Fallback](#4-fallback-no-layout_spec) — never invent hex, fonts, or sizes.

**Source of truth precedence:**
1. `Artifacts/LAYOUT_SPEC.md` (per-project, `creative-director`-authored) — wins.
2. `style_constants.py` (per-project literal token values, referenced by name from `LAYOUT_SPEC.md`).
3. `visual-composition/SKILL.md` (default vocabulary + named palettes/pairings) — fallback only.

---

## 1. Token Field Map

Five token groups. Each field lists its `LAYOUT_SPEC.md` origin and its `visual-composition` source section.

### 1.1 Palette

| Field | Shape | Source (`visual-composition`) |
|:---|:---|:---|
| `palette.name` | Named theme, e.g. `Midnight Executive` | §Concrete Palette Options |
| `palette.primary` | Named color + hex (`navy / 1E2761`) — titles, anchors | §Color Rules |
| `palette.secondary` | Named color + hex | §Concrete Palette Options |
| `palette.accent` | Named color + hex — **one accent element per slide max** | §Color Rules |
| `palette.neutrals` | 3–4 grays (body text, borders, backgrounds) | §Color Rules |
| `palette.semantic` | `red=negative`, `green=positive`, `amber=warning` | §Color Rules |
| `palette.chart_sequence` | Fixed ordered color list (never tool defaults) | §Color Rules |

Colors referenced **by name** in prompts; hex only where a renderer requires literal values. All values must resolve to `style_constants.py`.

### 1.2 Type Scale

| Field | Shape | Source (`visual-composition`) |
|:---|:---|:---|
| `type.heading_font` | 1 family (e.g. `Georgia`) — **not** a banned default | §Typography Pairings; §Anti-Slop Deny List |
| `type.body_font` | 1 family (e.g. `Calibri`) | §Typography Pairings |
| `type.scale.title` | Largest step — headlines, hero stats | §Typography Rules |
| `type.scale.subtitle` | Second step — section headers, shared compare headers | §Typography Rules |
| `type.scale.body` | Body copy step (≥12pt) | §Typography Rules; §Accessibility |
| `type.scale.caption` | Small labels, card captions | §Typography Rules |
| `type.scale.footnote` | Smallest step — sources, caveats (≥10pt) | §Typography Rules; §Accessibility |
| `type.line_height` | Body 1.3–1.5×; headings 1.1–1.2× | §Typography Rules |

`type.scale` is a 4–5-step scale; the five named sub-fields above are its individually addressable steps. No sizes outside the declared scale. Max **2 font families** per deck (`heading_font` + `body_font`). Font-size floors are body ≥12pt and footnote ≥10pt (§Accessibility). `18pt+` is **not** a font-size minimum — it is the threshold above which "large text" qualifies for the relaxed **3:1** contrast rule (see §3).

### 1.3 Grid & Margins

| Field | Shape | Source (`visual-composition`) |
|:---|:---|:---|
| `grid.columns` | Slides: 2–3 max (§Grid Rules). **Exception:** single-column/stacked (`columns=1`) is permitted for hero/full-bleed layouts where one focal element spans the slide | §Grid Rules |
| `grid.margins` | Consistent across all slides; defined once | §Grid Rules |
| `grid.reading_flow` | `F-pattern` (text-heavy) or `Z-pattern` (visual-heavy) | §Reading Flow |
| `grid.density_limit` | ≤5 content blocks, ≤2 charts, ≤6 body lines per slide | §Density Control |

### 1.4 Base Spacing Unit

| Field | Shape | Source (`visual-composition`) |
|:---|:---|:---|
| `spacing.unit` | Base unit, e.g. `0.25in` / `8px` | §Spacing |
| `spacing.rule` | All gaps = integer multiples of `spacing.unit` | §Spacing |
| `spacing.grouping` | Tight = related; wide = unrelated | §Spacing |

### 1.5 Archetype Set

| Field | Shape | Source (`visual-composition`) |
|:---|:---|:---|
| `archetypes.chosen` | 3–5 patterns selected from the closed 6 (§2) | §Repeating Patterns |
| `archetypes.pacing` | Alternate dense/sparse; no 3+ dense in a row | §Pacing |

Deviation from a chosen archetype requires justification (auditor gate).

---

## 2. Closed 7-Type Slide Taxonomy

**Title/Section opener** + the **6 `visual-composition` archetypes** (SKILL.md §Repeating Patterns). Closed set — a slide intent that fits none maps to the nearest type; the skill does not invent an eighth.

| # | Slide Type | Structure | Tokens Consumed |
|:--|:---|:---|:---|
| 1 | **Title / Section Opener** | Deck title or divider; minimal content | `palette.primary` (bg), `palette.accent`, `type.scale.title` + `type.scale.subtitle`, `grid.margins`, `spacing.unit` |
| 2 | **Hero + Evidence** | Large headline/stat top, supporting detail below | `type.scale.title` (hero), `palette.accent` (stat), `grid.columns=1` (stacked, per §1.3 exception), `spacing.rule` (vertical rhythm) |
| 3 | **Two-Column Compare** | Left vs. right under shared header | `grid.columns=2`, `type.scale.subtitle` (shared header) + `type.scale.body`, `palette.semantic` (optional), `spacing.grouping` (gutter) |
| 4 | **Grid of Cards** | Repeated small units in rows | `grid.columns=2–3`, `palette.neutrals` (card bg), `type.scale.body` + `type.scale.caption`, `spacing.unit` (inter-card) |
| 5 | **Top Summary + Detail** | KPI/headline strip, detail table or chart below | `grid.density_limit`, `type.scale.title` (KPI) + `type.scale.body`, `palette.accent` + `palette.chart_sequence`, `spacing.rule` |
| 6 | **Left Narrative + Right Visual** | Text left, chart/image right | `grid.columns=2`, `type.scale.body` (left), `grid.margins` (image right), `palette.chart_sequence`, `spacing.grouping` |
| 7 | **Full-Bleed Visual** | Single image/graphic, minimal text overlay | `palette.primary` (overlay), `type.scale.title` (overlay), `grid.margins=0` (`columns=1`, per §1.3 exception), `spacing.unit` (minimal), semantic overlay contrast ≥4.5:1 |

**Coverage:** Type 1 = title; Types 2–7 = the 6 `visual-composition` archetypes (Hero+Evidence, Two-Column Compare, Grid of Cards, Top Summary+Detail, Left Narrative+Right Visual, Full-Bleed Visual). **7 total.**

---

## 3. Accessibility Invariants (always enforced)

Independent of `LAYOUT_SPEC.md` — the skill applies these to every generated prompt (`visual-composition` §Accessibility):

- Contrast ≥ **4.5:1** body text, ≥ **3:1** large text (large text = **18pt+**).
- Font-size floors: body ≥12pt, footnote ≥10pt.
- No color-only meaning — pair with label/position/icon.
- No text on busy backgrounds without solid/semi-transparent overlay (esp. Type 7).
- Never emphasize more than 2 elements per slide.

---

## 4. Fallback (no `LAYOUT_SPEC.md`)

If a project has **no** `Artifacts/LAYOUT_SPEC.md`, the skill falls back to these `visual-composition` defaults (never ad-hoc values):

| Token Group | Fallback Default | Source (`visual-composition`) |
|:---|:---|:---|
| Palette | `Charcoal Minimal` — `36454F` / `F2F2F2` / `212121` | §Concrete Palette Options |
| Typography | `Editorial` — Georgia (heading) / Calibri (body) | §Typography Pairings |
| Type scale | 5 steps: title / subtitle / body / caption / footnote; body ≥12pt | §Typography Rules |
| Grid | 2 columns (chosen within the declared 2–3 range; no source-specified default — inference), consistent margins, F/Z reading flow | §Grid Rules |
| Spacing unit | `0.25in` / `8px`, all gaps as multiples | §Spacing |
| Archetypes | All 6 available; density ≤5 blocks / ≤2 charts / ≤6 lines | §Repeating Patterns, §Density Control |

**Fallback banner rule:** when defaults are used, the generated prompt states `[fallback: visual-composition defaults]` so the user can supply a `LAYOUT_SPEC.md` for brand-specific output. Banned defaults (Inter, Roboto, Arial, Segoe UI; centered-everything; accent-line-under-title) are rejected even in fallback (§Anti-Slop Deny List).
