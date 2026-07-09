# Slide Prompt Templates: 13-Part Anatomy & 7 Archetypes

> **Purpose.** The **13-part skeleton** (slot-based prompt template) that maps to the anatomy table in `design-tokens.md` and `reference-slides.md`. Every slide prompt follows this same 13-part structure; the **layout archetype** (choice from the 7-menu in design-tokens.md §6) determines how zones and regions vary within the structure. Followed by 3 worked Input→Output examples showing exact copy-paste-ready prompts.
>
> **Critical principle:** Parts auto-injected from the deck profile (3–5, 9-styling, 10, 11, 12) use concrete hex and named fonts. User never sees abstract token names in the output prompt.

---

## The 13-Part Skeleton (Annotated)

Use this skeleton for every slide. Fill `{user_supplied}` slots with content from the slide brief; `[auto-inject from profile]` sections are populated by the skill.

### Part 1: Command & Purpose

```
Rebuild Slide {N}: "{slide_title}"

[The purpose of this slide is to: {user_supplied_purpose}. Keep this narrative intent throughout.]
```

**What goes here:** The slide number, title, and the user's stated purpose. Example: "Rebuild Slide 5: 'The model can answer back.' The purpose is to show the feedback loop between designer intent, structured model, massing, and data."

---

### Part 2: Content-Truth Directive

```
This slide should show {user_supplied_real_object}, not {user_supplied_metaphor_to_avoid}.
```

**What goes here:** Ground the slide in reality. Example: "This slide should show the actual research object: a small mixed-use gBlox-style model and the feedback loop between designer intent, structured model data, Rhino/gBlox massing, and live design metrics. Do not use metaphors such as a cake, car, or recipe."

---

### Part 3: Title + Styling

```
Slide title:
{user_supplied_title_text}

Use the same serif title font, size, and dark charcoal colour (#2A2A2A) as the rest of the deck. No full stop.
```

**What goes here:** The actual slide title text (user supplied). The **styling is auto-injected from the deck profile:** serif font family, dark charcoal `#2A2A2A`, no full stop. Example: "The model can answer back"

---

### Part 4: Deck Furniture

```
Keep the existing top-right GRI · KICK-OFF label and orange rule (#B8431B) exactly as used on the other slides.

Footer:
- Lower-left: {user_supplied_slide_title} in Cascadia Code Italic, muted grey (#888888)
- Lower-right: {user_supplied_page_number} in Cascadia Code Regular, muted grey (#888888)
```

**What goes here:** Auto-injected from the deck profile. This ensures the slide looks like a sibling. The exact badge label, footer format, fonts (Cascadia Code), and colour (`#888888`) come from the profile. User supplies only the slide title and page number.

---

### Part 5: Background

```
Background:
- Warm cream background (#F5F1E8)
- No photographic background
- Keep it clean and diagrammatic
```

**What goes here:** Auto-injected from the deck profile. Same background on every slide ensures visual continuity.

---

### Part 6: Overall Layout

```
OVERALL LAYOUT

{user_supplied_layout_archetype_choice}

{user_supplied_zones_proportions_reading_order}

{user_supplied_connector_devices}
```

**What goes here:** This is the user's slide brief. Example for a 4-panel storyboard (Slide A):
```
OVERALL LAYOUT

Create a 4-panel horizontal storyboard across the centre of the slide.

The four panels should read left to right:
1. Designer intent
2. Structured model
3. gBlox massing
4. Data feedback + next move

Panel widths:
- Panel 1: 22%
- Panel 2: 26%
- Panel 3: 28%
- Panel 4: 24%

Add thin arrows between the panels:
Panel 1 -> Panel 2 -> Panel 3 -> Panel 4

Then add a subtle looping arrow from Panel 4 back to Panel 1 to show iteration.

Arrow style:
- Thin line, 1.25pt
- Colour: terracotta orange (#B8431B)
- Simple arrowheads
- The return loop arrow should be lighter or dashed, showing iteration rather than a one-way pipeline
```

---

### Part 7: Per-Region Spec

Repeat this block for each zone/region in the layout:

```
REGION {N} — {REGION_NAME}

Region heading:
{user_supplied_heading_text}

Heading style:
- Cascadia Code, small caps, 10–11pt
- Muted grey (#888888)
[This styling is auto-injected from the deck profile.]

Visual device:
{user_supplied_visual_device_description}

Content:
{user_supplied_content_text}

Purpose of this region:
{user_supplied_purpose_statement}
```

**What goes here:** The user supplies all variable content (heading text, visual device, content, purpose). The **heading style is auto-injected from the profile** (Cascadia Code, small caps, 10–11pt, muted grey). The **Purpose statement is CRITICAL** — it proves the region's narrative intent (see reference-slides.md Slide A, Panels 1–4).

**Example (Slide A, Panel 1):**
```
PANEL 1 — DESIGNER INTENT

Panel heading:
01 · Intent

Heading style:
- Cascadia Code, small caps, 10–11pt
- Muted grey (#888888)

Visual device:
Create a simple "brief card" visual.

Brief card:
- Rounded rectangle
- Fill: off-white / very light cream (#FAF7EF)
- Thin outline: muted grey (#D6D0C4)
- Slight soft shadow if consistent with deck style

Inside the card, show this text:

20-storey mixed-use tower

Retail base
Office middle
Residential above

Add terraces to upper floors

Text style:
- Cascadia Code or clean sans-serif
- 10–11pt
- Dark charcoal (#2A2A2A)
- Keep line spacing generous

Also add a tiny simple napkin sketch beside or underneath the brief card:
- Loose pencil-style line drawing of a tower with a podium and stepped top
- Keep it very small and low contrast
- It should feel like a designer's quick idea, not a polished drawing

Purpose of this region:
Show the human input: brief, intent, rough sketch.
```

---

### Part 8: Flow / Iteration Devices

```
ITERATION LOOP

{user_supplied_flow_devices_description}

Arrow/connector style:
- Line weight, colour, dashing, directionality
- Example: terracotta orange (#B8431B), dashed or lightly curved for iteration

Label:
{user_supplied_label_text}

Style:
- Cascadia Code Italic, 8pt
- Muted grey (#888888)
```

**What goes here:** The user describes arrows, loops, connectors, heatmap logic, etc. This is optional and layout-specific. Example (Slide A, return loop):
```
ITERATION LOOP

Add a subtle curved arrow from the prompt bubble in Panel 4 back toward Panel 1.

Label the loop very lightly:
iterate

Style:
- Cascadia Code Italic, 8pt
- Muted grey (#888888)
- Arrow line: terracotta orange (#B8431B) at 40–50% opacity
- Dashed or lightly curved
```

---

### Part 9: Bottom-Line Takeaway

```
Add a short italic line centred near the bottom of the slide, above the footer:

{user_supplied_takeaway_text}

Style:
- Serif italic
- 18–20pt
- Dark charcoal (#2A2A2A)
- Centre aligned
[Styling is auto-injected from the deck profile.]

This is the slide takeaway.
```

**What goes here:** User supplies the takeaway text (Part 9-text); the **styling is auto-injected from the profile** (serif italic, specific size, charcoal, centre-aligned). Example (Slide A): "The model is not just geometry. It carries the data designers need to decide what comes next."

---

### Part 10: Visual Tone

```
VISUAL TONE

The slide should feel:
[auto-inject from profile: clean · minimal · diagrammatic · architectural · honest · calm · research-oriented · clear at a glance]

{user_supplied_slide_specific_tone_notes}

Not:
[auto-inject from profile: not overly technical, not like a software UI mockup, not like a marketing graphic]
```

**What goes here:** The deck-wide tone defaults are auto-injected from the profile. The user can add slide-specific nuances. Example (Slide A): "The slide should feel like a clean research diagram, not a technical software screenshot."

---

### Part 11: What to Avoid

```
WHAT TO AVOID

Do not use:
[auto-inject from profile: metaphors (cake/car/recipe) · AI robot imagery · brain icons · magic wand icons · fake futuristic interface · heavy 3D rendering · dense technical diagrams · the term DSL · long paragraphs · bright saturated colours · decorative imagery]

{user_supplied_slide_specific_avoidances}

This slide should show:
{user_supplied_content_truth_summary}
```

**What goes here:** The deck-wide forbidden list is auto-injected from the profile. The user can add slide-specific avoidances. Example (Slide A): "Do not use cake metaphor, car metaphor, recipe metaphor, generic AI robot imagery, brain icons, magic wand icons, fake futuristic interface, heavy 3D rendering, dense technical diagrams, the term DSL, long paragraphs."

---

### Part 12: Palette (With Concrete Hex)

```
PALETTE (Hex Values)

Use the existing deck palette:
- Cream background: #F5F1E8
- Terracotta accent: #B8431B
- Dark charcoal (text): #2A2A2A
- Muted grey (secondary): #888888
- Muted greys (rules/outlines/close-out): #D6D0C4, #A8A29A, #666666, #555555
- Soft blue (categorical): #7BA7BC
- Soft green (categorical): #8FAE6D
- Soft yellow (categorical): #E8C547

Opacity guidance:
- Card/region backgrounds: 30–40% opacity of the region colour
- Active data/heatmap: 65–75% opacity
- Muted/close-out: 45–55% opacity
```

**What goes here:** Auto-injected from the deck profile. **All hex values are concrete** — Copilot doesn't need to resolve anything. No abstract names like `palette.primary`.

---

### Part 13: Speaker-Note Intent

```
SPEAKER NOTE INTENT

This slide should support the following verbal explanation:

{user_supplied_speaker_note_narrative}
```

**What goes here:** The user supplies the narrative that the visual should reinforce. Example (Slide A):
```
SPEAKER NOTE INTENT

This slide should support the following verbal explanation:

"The point is not just that language can produce geometry. The important thing about gBlox is that the model carries structured data. A designer can describe an intent, that intent becomes a structured model, the structured model creates the massing, and the massing gives data back: GFA, FAR, program mix, units, parking, terraces. That feedback is what lets the designer keep iterating. The model can answer back."
```

---

## Layout Menu & How Part 6 Varies

The **Overall Layout (Part 6)** varies by the 7 archetypes (from design-tokens.md §6). The other 12 parts remain structurally identical across all layouts. Here are the 7 options:

| # | Layout | Part 6 Structure |
|:---|:---|:---|
| 1 | **Title / Section** | Centred vertical stack; title top-third; optional subtitle; minimal content; full-slide background as emphasis |
| 2 | **Hero + Evidence** | Single-column stacked; hero ~40% top (large stat/headline), evidence ~60% below (4–5 bullets max) |
| 3 | **Two-Column Compare** | Shared header row; left column ~50%, right column ~50%; gutter between; labels + content per column |
| 4 | **Grid of Cards** | 2–3 column grid; repeated card units; 3–5 cards total; consistent card style (rounded rect, light fill, accent bar, outline) |
| 5 | **Top Summary + Detail** | KPI/summary band ~25% top; detail section ~75% below; headline + content (chart/table/bullets) in detail |
| 6 | **Left Narrative + Right Visual** | Left column ~55% (text narrative); right column ~45% (chart/image); optional shared header above both |
| 7 | **Full-Bleed Visual** | Single image full-slide; optional text overlay bottom/centre on semi-transparent background |

Each archetype consumes the 13-part skeleton the same way; only Part 6 (zones, proportions, reading order) changes.

---

## Worked Examples: Input → Output

### Example 1: Hero + Evidence (Slide 05 "The model can answer back" — Simplified)

**Input (User Brief):**
```
Layout archetype: Hero + Evidence (simplified for this example; the full slide is a 4-panel storyboard, but here's a reduced version)

Slide title: "The model can answer back"

Hero headline: "The model can answer back"
Hero stat: None (title serves as hero)

Evidence bullets:
- The model is not just geometry
- It carries the data designers need to decide what comes next
- Feedback loop: intent → structured model → massing → data → next iteration

Purpose: Show that the model carries structured data and supports iterative design decisions.

Slide-specific tone: Like a clean research diagram, not a technical software screenshot.

Avoiding: Metaphors, AI icons, fake UI, dense diagrams, DSL term.

Speaker note: "The important thing about gBlox is that the model carries structured data. That feedback is what lets the designer keep iterating."

Design system: Deck profile from reference-slides.md (GRI · KICK-OFF deck).
```

**Output (Copy-Paste Ready Prompt):**

```
Rebuild Slide 05: "The model can answer back"

The purpose of this slide is to show the feedback loop between designer intent, structured model data, Rhino/gBlox massing, and live design metrics. The key insight is that the model is not just geometry — it carries data that lets designers iterate.

This slide should show the actual research object: a small mixed-use gBlox-style model and the feedback loop. Do not use metaphors such as a cake, car, or recipe.

TITLE

Slide title:
The model can answer back

Use the same serif title font, size, and dark charcoal colour (#2A2A2A) as the rest of the deck. No full stop.

DECK FURNITURE

Keep the existing top-right GRI · KICK-OFF label and orange rule (#B8431B) exactly as used on the other slides.

Footer:
- Lower-left: The model can answer back in Cascadia Code Italic, muted grey (#888888)
- Lower-right: 05 in Cascadia Code Regular, muted grey (#888888)

BACKGROUND

Warm cream background (#F5F1E8), no photographic background, keep it clean and diagrammatic.

OVERALL LAYOUT

Create a 4-panel horizontal storyboard across the centre of the slide. The four panels show left to right: Designer intent → Structured model → gBlox massing → Data feedback + next move.

Panel widths: 22%, 26%, 28%, 24%. Add thin arrows (#B8431B, 1.25pt) between panels; add a subtle looping arrow back to Panel 1 (dashed, lighter opacity) to show iteration.

PANEL 1 — DESIGNER INTENT

Panel heading:
01 · Intent

Heading style: Cascadia Code, small caps, 10–11pt, muted grey (#888888)

Visual device: A simple rounded rectangle card (light cream #FAF7EF, thin outline #D6D0C4) with brief text inside.

Content:
20-storey mixed-use tower
Retail base
Office middle
Residential above
Add terraces to upper floors

Also add a tiny pencil-sketch drawing of a tower (very small, low contrast, not polished).

Text inside card: Cascadia Code or clean sans-serif, 10–11pt, dark charcoal (#2A2A2A), generous line spacing.

Purpose of this region: Show the human input: brief, intent, rough sketch.

PANEL 2 — STRUCTURED MODEL

Panel heading:
02 · Structured model

Heading style: Cascadia Code, small caps, 10–11pt, muted grey (#888888)

Visual device: A simplified data card (dark charcoal background #2A2A2A, Cascadia Code 8.5–9pt text in off-white #F5F1E8, thin terracotta accent bar on left edge).

Content:
{
  "floors": 20,
  "retail": "base",
  "office": "middle",
  "residential": "top",
  "terraces": "upper_floors",
  "live_metrics": true
}

Purpose of this region: Show that language is translated into structured model, not arbitrary geometry.

PANEL 3 — GBLOX MASSING

Panel heading:
03 · gBlox massing

Heading style: Cascadia Code, small caps, 10–11pt, muted grey (#888888)

Visual device: Clean axonometric mixed-use massing diagram (no photorealism, no façade detail, no people).

Massing layers:
- Retail base: muted terracotta/orange (#B8431B) at 65–75% opacity
- Office middle: soft blue (#7BA7BC) at 65–75% opacity
- Residential top: soft green (#8FAE6D) at 65–75% opacity
- Terraces: pale cream or pale green surfaces

Add tiny labels beside massing (Cascadia Code, 8–9pt, dark grey) for Retail, Office, Residential, Terraces.

Purpose of this region: Show the model becoming visible as geometry, clearly driven by structured intent.

PANEL 4 — DATA FEEDBACK + NEXT MOVE

Panel heading:
04 · Feedback

Heading style: Cascadia Code, small caps, 10–11pt, muted grey (#888888)

Visual device: Dashboard-style feedback card (rounded rectangle, light fill #FAF7EF, thin outline #D6D0C4).

Metric callouts:
GFA: 32,400 m²
FAR: 6.2
Residential: 42%
Office: 46%
Retail: 12%
Terrace area: 1,180 m²

Below metrics, add a small rounded speech bubble:
"Try a courtyard version."

Bubble style: Warm cream or pale orange tint, thin terracotta outline (#B8431B), serif italic or Cascadia Code, 10–11pt.

Purpose of this region: Show that the model answers back with data, supporting the next design move.

ITERATION LOOP

Add a subtle curved arrow from the prompt bubble (Panel 4) back to Panel 1. Label lightly:
iterate

Style: Cascadia Code Italic, 8pt, muted grey (#888888); arrow line terracotta (#B8431B) at 40–50% opacity, dashed or lightly curved.

BOTTOM-LINE TAKEAWAY

Add a short italic line centred near the bottom of the slide, above the footer:

The model is not just geometry. It carries the data designers need to decide what comes next.

Style: Serif italic, 18–20pt, dark charcoal (#2A2A2A), centre aligned.

VISUAL TONE

The slide should feel clean, minimal, diagrammatic, architectural, confident, not overly technical, not like a software UI mockup, not like a marketing graphic. Use the existing deck palette (cream, terracotta, charcoal, greys, soft blue, soft green).

WHAT TO AVOID

Do not use: metaphors (cake/car/recipe), AI robot imagery, brain icons, magic wand icons, fake futuristic interface, heavy 3D rendering, dense technical diagrams, the term DSL, long paragraphs, bright saturated colours, decorative imagery.

This slide shows a small mixed-use gBlox workflow: designer intent → structured model → massing → data feedback → iteration.

PALETTE

Use the existing deck palette:
- Cream background: #F5F1E8
- Terracotta accent: #B8431B
- Dark charcoal (text): #2A2A2A
- Muted grey (text/outlines): #888888, #D6D0C4, #666666
- Soft blue: #7BA7BC (65–75% opacity for massing)
- Soft green: #8FAE6D (65–75% opacity for massing)
- Off-white for card/text: #FAF7EF (backgrounds), #F5F1E8 (text on dark)

SPEAKER NOTE INTENT

"The point is not just that language can produce geometry. The important thing about gBlox is that the model carries structured data. A designer can describe an intent, that intent becomes a structured model, the structured model creates the massing, and the massing gives data back: GFA, FAR, program mix, units, parking, terraces. That feedback is what lets the designer keep iterating. The model can answer back."
```

**Rationale:** This prompt shows a 4-panel storyboard feedback loop with concrete hex values (#B8431B, #2A2A2A, #7BA7BC, #8FAE6D), named fonts (serif, Cascadia Code), explicit Purpose lines per panel, and furniture continuity (GRI badge, footer style). It mirrors reference-slides.md Slide A's fidelity and structure.

---

### Example 2: Two-Column Compare (Timeline + Heatmap, Slide 07 "The year ahead" — Task Cards Simplified)

**Input (User Brief):**
```
Layout archetype: Two-Column Compare (or a variant with top card section + bottom heatmap; simplified here)

Slide title: "The year ahead"

Shared header: "Four primary task phases"

Left column:
- Label: "T1 · MOCKUPS + FEEDBACK"
- Content:
  Create high-level mockups from what we already know.
  Show them to designers.
  Capture how they want to create, interrogate, and manipulate models.
  Deliverable: Mockup feedback + test scenarios.

Right column:
- Label: "T2 · BUILD"
- Content:
  Build the first working version around the strongest mockup patterns.
  Deliverable: Working prototype.

Purpose: Show the primary phases of work with clear deliverables, while acknowledging work will overlap.

Speaker note: "The task cards show the primary focus of each phase. But the work will not be perfectly linear."

Design system: GRI · KICK-OFF deck.
```

**Output (Copy-Paste Ready Prompt):**

```
Rebuild Slide 07 (simplified): "The year ahead"

The purpose is to explain the task phases and timeline, showing both the structured plan (task cards) and the reality underneath (work overlaps, intermixing). This is an editorial research timeline, not a project-management dashboard.

TITLE

Slide title:
The year ahead

Use the same serif title font, size, and dark charcoal colour (#2A2A2A) as the rest of the deck. No full stop.

DECK FURNITURE

Keep the existing top-right GRI · KICK-OFF label and orange rule (#B8431B) exactly as used on the other slides.

Footer:
- Lower-left: The year ahead in Cascadia Code Italic, muted grey (#888888)
- Lower-right: 07 in Cascadia Code Regular, muted grey (#888888)

BACKGROUND

Warm cream background (#F5F1E8), no photographic background, keep it clean and diagrammatic.

OVERALL LAYOUT

Two-column layout with optional shared header. Left column ~50%, right column ~50%. Gutter between columns: 0.375in (1.5× base spacing unit).

SHARED HEADER

Headline:
Four primary task phases

Style: Subtitle size (~24pt), serif font, charcoal (#2A2A2A), bold. Bottom margin: 0.375in.

LEFT COLUMN — T1 MOCKUPS + FEEDBACK

Column label:
T1 · MOCKUPS + FEEDBACK

Label style: Cascadia Code, small caps, 10–11pt, terracotta (#B8431B), bold

Column content:
- Create high-level mockups from what we already know
- Show them to designers
- Capture how they want to create, interrogate, and manipulate models

Content style: Serif or clean sans, 10–11pt, dark charcoal (#2A2A2A), bullet spacing 0.1875in

Column background: Very light grey (#F5F5F5) for visual separation, thin outline (#D6D0C4), padding 0.25in

Deliverable line:
Mockup feedback + test scenarios.

Deliverable style: Serif italic, 9–10pt, muted grey (#666666)

Purpose of this region: Show the primary focus and deliverable of Phase 1 (Mockups & Feedback).

RIGHT COLUMN — T2 BUILD

Column label:
T2 · BUILD

Label style: Same as left (Cascadia Code, small caps, 10–11pt, soft blue #7BA7BC, bold)

Column content:
- Build the first working version around the strongest mockup patterns

Content style: Serif or clean sans, 10–11pt, dark charcoal (#2A2A2A), bullet spacing 0.1875in

Column background: Light blue tint (soft blue #7BA7BC at 20–30% opacity) for semantic differentiation, OR same light grey as left for consistency

Deliverable line:
Working prototype.

Deliverable style: Serif italic, 9–10pt, muted grey (#666666)

Purpose of this region: Show the primary focus and deliverable of Phase 2 (Build).

VISUAL TONE

The slide should feel structured, honest, not overly linear, calm, research-oriented, clear at a glance. The task cards show the planned sequence; context (visuals, flow) shows the real intermixing of work.

WHAT TO AVOID

Do not make this a simple linear Gantt only. Do not remove task cards. Do not use bright saturated colours. Do not add icons or decorative imagery. Do not add long paragraphs. Do not make it feel like a project-management dashboard (e.g., Jira-style).

BOTTOM LINE

This slide explains the basis of the project timeline, while showing that work is not strictly linear. The primary phases give structure, but listening, building, evaluation, and synthesis will overlap.

PALETTE

Use the existing deck palette:
- Cream background: #F5F1E8
- Terracotta: #B8431B (emphasis, deliverable accent)
- Dark charcoal (text): #2A2A2A
- Muted grey (text/outlines): #888888, #D6D0C4, #666666
- Soft yellow: #E8C547 (optional for T1 card accent, 30–40% opacity)
- Soft blue: #7BA7BC (optional for T2 card accent, 30–40% opacity)
- Soft green: #8FAE6D (optional for later phases, 30–40% opacity)

SPEAKER NOTE INTENT

"The task cards show the primary focus of each phase. But the work will not be perfectly linear. Listening continues into build. Build overlaps with evaluation. Evaluation overlaps with synthesis. The real work intermixes because the research demands it."
```

**Rationale:** This prompt demonstrates a two-column comparison with concrete hex values (#B8431B for labels, #7BA7BC for T2 semantic colour), named fonts (Cascadia Code small caps, serif body), explicit Purpose lines per column, and accessibility checks (contrast ≥4.5:1, font-size ≥10pt for labels). It shows how Part 6 (layout) varies while the 13-part structure remains constant.

---

### Example 3: Grid of Cards (Minimal Example)

**Input (User Brief):**
```
Layout archetype: Grid of Cards

Slide title: "Three research methods"

Slide headline: "Our approach combines three methods"

Three cards:

Card 1:
- Title: "Observational Study"
- Description: "Field observations of designers working in real projects"

Card 2:
- Title: "Interview Cohort"
- Description: "Structured interviews with 12 lead designers"

Card 3:
- Title: "Iterative Testing"
- Description: "Prototype testing with feedback loops"

Purpose: Show the three pillars of the research methodology.

Speaker note: "Our approach combines three methods to ensure the system reflects real design practice."

Design system: GRI · KICK-OFF deck.
```

**Output (Copy-Paste Ready Prompt):**

```
Rebuild Slide XX: "Three research methods"

The purpose of this slide is to introduce the three pillars of the research methodology — observational study, interviews, and iterative testing — and show how they combine to ground the project in real design practice.

Do not make this a metaphor — show the actual three methods as concrete, labelled cards.

TITLE

Slide title:
Three research methods

Use the same serif title font, size, and dark charcoal colour (#2A2A2A) as the rest of the deck. No full stop.

DECK FURNITURE

Keep the existing top-right GRI · KICK-OFF label and orange rule (#B8431B) exactly as used on the other slides.

Footer:
- Lower-left: Three research methods in Cascadia Code Italic, muted grey (#888888)
- Lower-right: [XX] in Cascadia Code Regular, muted grey (#888888)

BACKGROUND

Warm cream background (#F5F1E8), no photographic background, keep it clean and diagrammatic.

OVERALL LAYOUT

3-column grid. Three equal-width cards arranged left-to-right. Full-slide margins: 0.75in.

SLIDE HEADLINE

Text:
Our approach combines three methods

Style: Subtitle size (~24pt), serif font, charcoal (#2A2A2A), bold. Bottom margin: 0.375in.

CARD 1 — OBSERVATIONAL STUDY

Card background: White with subtle border (1px, muted grey #D6D0C4), rounded corners (4px)

Card headline:
Observational Study

Headline style: Body size (~12pt), serif font, charcoal (#2A2A2A), bold, top-left aligned

Card description:
Field observations of designers working in real projects

Description style: Caption size (~10pt), sans-serif, muted grey (#888888), max 2 lines

Optional accent: Small badge (soft blue #7BA7BC, 30% opacity) on top-right corner (visual consistency across cards)

Card padding: 0.25in on all sides

Purpose of this card: Establish observational grounding.

CARD 2 — INTERVIEW COHORT

Card background: White with subtle border (1px, muted grey #D6D0C4), rounded corners (4px)

Card headline:
Interview Cohort

Headline style: Body size (~12pt), serif font, charcoal (#2A2A2A), bold

Card description:
Structured interviews with 12 lead designers

Description style: Caption size (~10pt), sans-serif, muted grey (#888888), max 2 lines

Optional accent: Small badge (soft green #8FAE6D, 30% opacity) on top-right corner

Card padding: 0.25in on all sides

Purpose of this card: Establish interview-based validation.

CARD 3 — ITERATIVE TESTING

Card background: White with subtle border (1px, muted grey #D6D0C4), rounded corners (4px)

Card headline:
Iterative Testing

Headline style: Body size (~12pt), serif font, charcoal (#2A2A2A), bold

Card description:
Prototype testing with feedback loops

Description style: Caption size (~10pt), sans-serif, muted grey (#888888), max 2 lines

Optional accent: Small badge (soft yellow #E8C547, 30% opacity) on top-right corner

Card padding: 0.25in on all sides

Purpose of this card: Establish feedback-driven refinement.

INTER-CARD SPACING

Horizontal gutter (between columns): 0.25in (1× base spacing unit)

Vertical gutter (if multiple rows): 0.375in (1.5× base spacing unit)

FLOW DEVICE

A thin terracotta (#B8431B) connector line runs left-to-right beneath the three cards, suggesting the methods flow into one another rather than standing alone.

VISUAL TONE

The slide should feel clean, minimal, research-oriented, clear at a glance. Cards are uniform, scannable, and consistent in structure.

WHAT TO AVOID

Do not use: generic icons, decorative imagery, centered text, uniform rounded corners everywhere (only these cards), purple/blue gradients, long descriptions.

BOTTOM LINE

This slide introduces three research methods that ground the project in real design practice.

PALETTE

Use the existing deck palette:
- Cream background: #F5F1E8
- Card background: White
- Card border: Muted grey (#D6D0C4)
- Text (headline): Dark charcoal (#2A2A2A)
- Text (description): Muted grey (#888888)
- Badges (accents): Soft blue (#7BA7BC), soft green (#8FAE6D), soft yellow (#E8C547), all at 30% opacity

SPEAKER NOTE INTENT

"Our approach combines three methods to ensure the system reflects real design practice. Observational studies ground us in real workflows. Interviews let us hear directly from designers about what they want. And iterative testing lets us refine based on feedback. Together, these three pillars build confidence that the system will actually work in practice."
```

**Rationale:** This grid-of-cards prompt demonstrates 3-column layout with uniform card styling, concrete hex values for badges (soft blue, green, yellow at specified opacities), named fonts (serif headlines, sans body text), and Purpose lines for each card. It shows how Part 6 (grid structure) and Part 7 (repeated card pattern) vary while the 13-part skeleton remains constant across all archetypes.

---

## Verification Checklist

Before emitting any prompt, verify:

- [ ] Anatomy section identified (all 13 parts present)
- [ ] Layout archetype chosen (one of 7 types)
- [ ] Deck profile loaded (palette hex, fonts, furniture, tone, forbidden list)
- [ ] All {user_supplied_} slots filled (no placeholder text remains)
- [ ] All design references are **concrete hex and named fonts** (e.g., `#B8431B`, "Cascadia Code", "18–20pt"), never abstract tokens (e.g., `palette.primary`, `type.scale.body`)
- [ ] Per-region **Purpose** lines included (every region has explicit narrative intent)
- [ ] Deck furniture explicitly referenced (badge, footer style) for continuity with siblings
- [ ] Accessibility rules explicit (contrast ≥4.5:1 body / ≥3:1 large ≥18pt, font-size ≥12pt body / ≥10pt footnote, no color-only meaning)
- [ ] Single copy-paste block in markdown backticks (no multi-step prompts)
- [ ] Fallback banner added if defaults used: `[fallback: visual-composition defaults]`
- [ ] 1–2 sentence rationale provided

**Success:** All checks pass. Emit the prompt to the user.

---

**Last updated:** 2026-07-04  
**Anatomy version:** 13-part skeleton (reference-slides.md §What to notice)  
**Layout archetypes:** 7 (Title/Section, Hero+Evidence, Two-Column Compare, Grid of Cards, Top Summary+Detail, Left Narrative+Right Visual, Full-Bleed Visual)  
**Worked examples:** 3 (Hero+Evidence, Two-Column Compare, Grid of Cards)  
**All output prompts:** Concrete hex + named fonts only (zero abstract token names)
