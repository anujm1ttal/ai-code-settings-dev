# Reference Slides — Canonical Gold-Standard Prompts

> These are **real, user-authored prompts** that produced high-quality slides via Copilot Premium (Opus) inside PowerPoint. They are the quality bar and the ground truth for what this skill emits. The skill's job is to expand a *slide brief* into a prompt at **this fidelity**, auto-injecting the shared deck profile (palette, fonts, furniture, tone, forbidden list).
>
> Both slides belong to the same deck ("GRI · KICK-OFF"). Note what is **identical** across them (the deck profile) vs. what **varies** (per-slide layout + content). That split is the contract between `creative-director` (owns the deck profile → `LAYOUT_SPEC.md`) and this skill (expands per-slide briefs).

---

## Deck Profile extracted from these slides (the FIXED layer)

| Element | Value (identical on every slide) |
|:---|:---|
| **Background** | Warm cream `#F5F1E8`, no photographic background, clean/diagrammatic |
| **Palette** | terracotta `#C84A1E` · charcoal `#2A2A2A` · muted grey `#888888` (+ `#666666`, `#555555`, rules/outlines `#D6D0C4`, close-out `#A8A29A`) · soft blue `#7BA7BC` · soft green `#8FAE6D` · soft yellow `#E8C547` |
| **Title** | Top-left, deck serif font, dark charcoal, **no full stop** |
| **Top-right badge** | `GRI · KICK-OFF` label + orange rule — "exactly as used on the other slides" |
| **Footer left** | Slide title, Cascadia Code Italic, muted grey |
| **Footer right** | Page number (`05`, `07`, …), Cascadia Code Regular, muted grey |
| **Section headings** | Cascadia Code, small caps, 10–11pt, muted grey |
| **Cards** | Rounded rectangle, light fill (30–40% opacity of the region colour), thin colour bar/accent, generous padding, thin outline `#D6D0C4`, subtle corner rounding |
| **Takeaway line** | Serif italic, ~18–22pt, dark charcoal `#2A2A2A`, centre-aligned, generous whitespace |
| **Fonts** | Serif → title / takeaway / body. Cascadia Code → labels, headings (small caps), footer/annotations (italic), page numbers (regular) |
| **Tone defaults** | clean · minimal · diagrammatic · architectural/editorial · honest · calm · research-oriented · clear at a glance |
| **Forbidden (deck-wide)** | metaphors (cake/car/recipe) · AI robot / brain / magic-wand icons · fake futuristic UI · heavy 3D render · dense technical diagrams · the term "DSL" · long paragraphs · bright saturated colours · decorative imagery · "software UI mockup" / "Jira dashboard" / "marketing graphic" feel |

Everything below the deck profile (layout zones, region content, visual devices, speaker note) is the **per-slide brief**.

---

## Reference Slide A — "The model can answer back" (Slide 05)

Rebuild Slide 5 completely.

This slide should no longer use a metaphor such as a cake, car, or recipe. It should show the actual research object: a small mixed-use gBlox-style model and the feedback loop between designer intent, structured model data, Rhino/gBlox massing, and live design metrics.

Slide title:
The model can answer back

Use the same serif title font, size, and dark charcoal colour as the rest of the deck. No full stop.

Keep the existing top-right GRI · KICK-OFF label and orange rule exactly as used on the other slides.

Footer:
- Lower-left: The model can answer back in Cascadia Code Italic, muted grey
- Lower-right: 05 in Cascadia Code Regular, muted grey

Background:
- Warm cream background #F5F1E8
- No photographic background
- Keep it clean and diagrammatic

OVERALL LAYOUT

Create a 4-panel horizontal storyboard across the centre of the slide.

The four panels should read left to right:

1. Designer intent
2. Structured model
3. gBlox massing
4. Data feedback + next move

The slide should feel like a clean research diagram, not a technical software screenshot.

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
- Colour: terracotta orange #C84A1E
- Simple arrowheads
- The return loop arrow should be lighter or dashed, showing iteration rather than a one-way pipeline

PANEL 1 — DESIGNER INTENT

Panel heading:
01 · Intent

Heading style:
- Cascadia Code, small caps, 10–11pt
- Muted grey #888888

Create a simple "brief card" visual.

Brief card:
- Rounded rectangle
- Fill: off-white / very light cream #FAF7EF
- Thin outline: muted grey #D6D0C4
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
- Dark charcoal #2A2A2A
- Keep line spacing generous

Also add a tiny simple napkin sketch beside or underneath the brief card:
- Loose pencil-style line drawing of a tower with a podium and stepped top
- Keep it very small and low contrast
- It should feel like a designer's quick idea, not a polished drawing

Purpose of this panel:
Show the human input: brief, intent, rough sketch.

PANEL 2 — STRUCTURED MODEL

Panel heading:
02 · Structured model

Create a simplified data card that looks like a lightweight JSON / structured model block.

Card:
- Rounded rectangle
- Fill: dark charcoal #2A2A2A or very dark warm grey
- Text: Cascadia Code, 8.5–9pt, off-white #F5F1E8
- Add a thin terracotta accent line on the left edge of the card

Use this simplified JSON-like content:

{
  "floors": 20,
  "retail": "base",
  "office": "middle",
  "residential": "top",
  "terraces": "upper_floors",
  "live_metrics": true
}

Keep it legible.

Purpose of this panel:
Show that the language is translated into a structured model, not directly into arbitrary geometry.

Do not overuse technical terms like DSL. Keep the heading as "Structured model."

PANEL 3 — GBLOX MASSING

Panel heading:
03 · gBlox massing

Create a clean axonometric mixed-use massing diagram.

The massing should show:
- A podium/base volume for retail
- A middle tower volume for office
- An upper tower volume for residential
- Stepped terraces at the upper levels

Style:
- Simple axonometric blocks
- No photorealism
- No detailed façade
- No people
- No trees unless very minimal
- Clean architectural massing style

Use three muted colours:
- Retail base: muted terracotta / orange #C84A1E at 65–75% opacity
- Office middle: soft blue #7BA7BC at 65–75% opacity
- Residential top: soft green #8FAE6D at 65–75% opacity
- Terraces: slightly lighter cream or pale green surfaces

Add tiny labels beside the massing:
- Retail
- Office
- Residential
- Terraces

Label style:
- Cascadia Code, 8–9pt
- Dark grey
- Thin leader lines if needed

Purpose of this panel:
Show the model becoming visible as geometry, but clearly driven by structured intent.

PANEL 4 — DATA FEEDBACK + NEXT MOVE

Panel heading:
04 · Feedback

Create a dashboard-style feedback card.

Card:
- Rounded rectangle
- Fill: off-white #FAF7EF
- Thin outline: muted grey #D6D0C4

Inside the card, show 5–6 metric callouts:

GFA: 32,400 m²
FAR: 6.2
Residential: 42%
Office: 46%
Retail: 12%
Terrace area: 1,180 m²

Make these appear as small metric pills or rows.

Each metric row:
- Metric label in Cascadia Code, 8–9pt
- Placeholder value in muted grey
- The exact values do not need to be accurate. They are illustrative.

Below the metric card, add a small prompt bubble:

"Try a courtyard version."

Prompt bubble style:
- Rounded speech bubble
- Fill: warm cream or pale orange tint
- Outline: terracotta orange #C84A1E
- Text: serif italic or Cascadia Code, 10–11pt

Purpose of this panel:
Show that the model does not just appear. It answers back with data, and that data supports the next design move.

ITERATION LOOP

Add a subtle curved arrow from the prompt bubble in Panel 4 back toward Panel 1.

Label the loop very lightly:
iterate

Style:
- Cascadia Code Italic, 8pt
- Muted grey
- Arrow line: terracotta orange at 40–50% opacity
- Dashed or lightly curved

This loop is important. It shows that the project is not about one-shot generation. It is about conversational iteration.

BOTTOM LINE

Add a short italic line centred near the bottom of the slide, above the footer:

The model is not just geometry. It carries the data designers need to decide what comes next.

Style:
- Serif italic
- 18–20pt
- Dark charcoal #2A2A2A
- Centre aligned

This is the slide takeaway.

VISUAL TONE

The slide should feel:
- clean
- minimal
- diagrammatic
- architectural
- confident
- not overly technical
- not like a software UI mockup
- not like a marketing graphic

Use the existing deck palette:
- Cream background #F5F1E8
- Terracotta orange #C84A1E
- Dark charcoal #2A2A2A
- Muted grey #888888
- Soft blue #7BA7BC
- Soft green #8FAE6D
- Soft yellow only if needed, but avoid adding too many colours

WHAT TO AVOID

Do not use:
- cake metaphor
- car metaphor
- recipe metaphor
- generic AI robot imagery
- brain icons
- magic wand icons
- fake futuristic interface
- heavy 3D rendering
- dense technical diagrams
- the term DSL
- long paragraphs

This slide should show a small mixed-use gBlox workflow:
designer intent -> structured model -> massing -> data feedback -> iteration.

SPEAKER NOTE INTENT

This slide should support the following verbal explanation:

"The point is not just that language can produce geometry. The important thing about gBlox is that the model carries structured data. A designer can describe an intent, that intent becomes a structured model, the structured model creates the massing, and the massing gives data back: GFA, FAR, program mix, units, parking, terraces. That feedback is what lets the designer keep iterating. The model can answer back."

---

## Reference Slide B — "The year ahead" (Slide 07)

Rebuild Slide 7: The year ahead.

Keep the purpose of the slide: explain the basis of the project timeline, while also showing that the work is not strictly linear. The primary phases give structure, but the work will intermix across the year.

Do not make this a simple linear Gantt chart only. Keep the structured timeline and task phases, but add a GitHub-style activity heatmap underneath to show that listening, building, evaluation, and synthesis overlap.

SLIDE TITLE

Top-left title:
The year ahead

Use the same serif title font, size, and dark charcoal colour as the rest of the deck. No full stop.

Keep the existing top-right GRI · KICK-OFF label and orange rule exactly as used on the other slides.

Footer:
- Lower-left: The year ahead in Cascadia Code Italic, muted grey
- Lower-right: 07 in Cascadia Code Regular, muted grey

Background:
- Warm cream background #F5F1E8
- No photographic background
- Keep it clean and diagrammatic

OVERALL LAYOUT

The slide should have five horizontal zones from top to bottom:

1. Title and GRI label
2. Month timeline with GRI milestone markers
3. Four primary task cards
4. GitHub-style activity heatmap
5. Closing discipline line and footer

The structured task cards explain the plan.
The heatmap explains that the plan is not perfectly linear.
Both should be visible.

MONTH TIMELINE

Create a horizontal month axis across the upper-middle of the slide.

Months:
JUL · AUG · SEP · OCT · NOV · DEC · JAN · FEB · MAR · APR

Use:
- Cascadia Code, 9–10pt
- Muted grey #888888
- All caps
- Even spacing across the slide

Add a thin horizontal rule beneath the months:
- Colour: muted grey #D6D0C4
- Weight: 0.5pt

GRI MILESTONE MARKERS

Add five terracotta milestone markers above the month axis.

Use small terracotta circles or dots:
- Fill: #C84A1E
- Size: 6–8pt diameter
- Thin vertical hairline down to the month axis
- Label above each dot in Cascadia Code, 8–9pt, terracotta #C84A1E

Markers:
1. TODAY — positioned at JUL
2. IN-PROGRESS — positioned at AUG
3. PEER REVIEW — positioned around NOV, centred over OCT–DEC
4. FINAL REVIEW — positioned around FEB, centred over JAN–MAR
5. PUBLICATION — positioned at APR

PRIMARY TASK CARDS

Below the month timeline, create four primary task cards.

These cards show the main phase of work. They should be clear, but not imply the whole project is perfectly linear.

Use four horizontal cards placed side by side.

Each card:
- Rounded rectangle
- Light fill matching task colour at 30–40% opacity
- Thin top colour bar at full opacity
- Generous internal padding
- No heavy outline

Task colours:
- T1 Mockups + feedback: soft yellow #E8C547
- T2 Build: soft blue #7BA7BC
- T3 Evaluation: soft green #8FAE6D
- T4 Synthesis: terracotta #C84A1E

Card 1:
Title:
T1 · MOCKUPS + FEEDBACK

Body:
Create high-level mockups from what we already know.
Show them to designers.
Capture how they want to create, interrogate, and manipulate models.

Deliverable line:
Mockup feedback + test scenarios.

Card 2:
Title:
T2 · BUILD

Body:
Build the first working version around the strongest mockup patterns.

Deliverable line:
Working prototype.

Card 3:
Title:
T3 · EVALUATION

Body:
Designers test real tasks against the prototype.
Measure preference, friction, and failure modes.

Deliverable line:
Evaluation findings.

Card 4:
Title:
T4 · SYNTHESIS

Body:
Synthesize findings.
Record demo.
Draft grant paper and handoff.

Deliverable line:
Paper + demo video.

Card title style:
- Cascadia Code, small caps, 10pt
- Dark charcoal #2A2A2A

Card body style:
- Serif or clean sans-serif, 10–11pt
- Dark charcoal #2A2A2A
- Keep text concise

Deliverable line style:
- Serif italic, 9–10pt
- Muted grey #666666

HEATMAP ANNOTATION

Below the four primary task cards, add a small annotation:

Each square is one week. The colours mix because the work mixes.

Style:
- Cascadia Code Italic
- 9pt
- Muted grey #888888
- Centre aligned

GITHUB-STYLE ACTIVITY HEATMAP

Below the annotation, create a GitHub contribution-style heatmap.

Purpose:
Show that even though the tasks have a primary sequence, the actual work is interleaved. Listening continues during build. Build overlaps with evaluation. Evaluation overlaps with synthesis.

Heatmap structure:
- 10 month groups, one group per month JUL through APR
- Each month group contains a 3×3 block of small rounded squares
- Total: 10 groups × 9 squares = 90 squares
- Align each month group directly under the month label above
- Square size: approximately 0.12–0.16 inches
- Gap between squares within a month group: very small, about 0.03 inches
- Gap between month groups: slightly larger, about 0.12–0.15 inches
- No outlines, or very thin outline #D6D0C4
- Rounded corners, about 1–2pt

Heatmap colour palette:
- Listening: yellow #E8C547
- Building: blue #7BA7BC
- Evaluation: green #8FAE6D
- Synthesis: terracotta #C84A1E
- Close-out / publication: muted grey #A8A29A

Use 65–75% opacity for active colours.
Use 45–55% opacity for close-out grey.

Colour mapping by month group:

JUL:
- 9 yellow squares

AUG:
- 8 yellow squares
- 1 blue square in the bottom-right corner

SEP:
- 6 yellow squares
- 3 blue squares in the bottom row

OCT:
- 2 yellow squares in the top-left and top-centre
- 7 blue squares

NOV:
- 1 yellow square in the top-left
- 7 blue squares
- 1 green square in the bottom-right

DEC:
- 5 blue squares
- 4 green squares, mostly in the bottom row and right side

JAN:
- 1 yellow square in the top-left
- 1 blue square in the top-centre
- 6 green squares
- 1 orange square in the bottom-right

FEB:
- 4 green squares
- 5 orange squares, especially in the lower and right side of the month group

MAR:
- 2 green squares in the top row
- 7 orange squares

APR:
- 9 grey squares

The heatmap should visually transition:
yellow -> blue -> green -> orange -> grey

But it should not transition too cleanly. The mixed months are important. They show overlap.

LEGEND

Add a small horizontal legend below or beside the heatmap.

Legend items:
- yellow square: Listening
- blue square: Build
- green square: Evaluation
- orange square: Synthesis
- grey square: Close-out

Style:
- Small coloured square followed by label
- Cascadia Code, 8–9pt
- Muted grey #555555
- Items separated by middle dots

Example:
Listening · Build · Evaluation · Synthesis · Close-out

CLOSING LINE

Near the bottom of the slide, above the footer, add:

If we're behind, we say so in August — not in March.

Style:
- Serif italic
- 20–22pt
- Dark charcoal #2A2A2A
- Centre aligned
- Generous whitespace above and below

This line is important. It should feel like the slide takeaway.

VISUAL TONE

The slide should feel:
- structured
- honest
- not overly linear
- calm
- research-oriented
- clear at a glance

The task cards show the planned sequence.
The heatmap shows the real intermixing of work.
The milestone markers show GRI accountability.

WHAT TO AVOID

Do not:
- make this a simple linear Gantt only
- remove the task cards
- make the heatmap so large that it dominates the slide
- use bright saturated colours
- add icons
- add decorative imagery
- add long paragraphs
- make the slide feel like a project-management dashboard

The slide should feel like an editorial research timeline, not a Jira dashboard.

SPEAKER NOTE INTENT

This slide should support the following explanation:

"The task cards show the primary focus of each phase. But the work will not be perfectly linear. The heatmap is there to show the reality underneath the plan. Listening continues into build. Build overlaps with evaluation. Evaluation overlaps with synthesis. The colours mix because the work mixes.

The GRI check-ins give us accountability points. August is especially important. If the scope is wrong, or if we are behind, we say so in August — not in March."

---

## What to notice (skeleton derived from A + B)

Every strong slide prompt in this deck follows the same **13-part anatomy**. The FIXED parts come from the deck profile; the VARIABLE parts come from the slide brief:

| # | Section | Source |
|:--|:---|:---|
| 1 | Command ("Rebuild Slide N…") + keep-purpose | brief |
| 2 | Content-truth directive (real object, not metaphor) | brief |
| 3 | Title + styling (deck serif, charcoal, no full stop) | **profile** (styling) + brief (text) |
| 4 | Deck furniture — top-right badge + rule, footer L/R | **profile** (identical every slide) |
| 5 | Background (cream, no photo, diagrammatic) | **profile** |
| 6 | Overall layout — zones/panels, proportions, reading order, connectors | brief |
| 7 | Per-region spec — heading, visual device, exact content, **+ Purpose** | brief (content) + **profile** (heading/card styling) |
| 8 | Flow / iteration devices — arrows, loops, heatmap logic | brief |
| 9 | Bottom-line takeaway (serif italic, centred) | brief (text) + **profile** (styling) |
| 10 | Visual tone — adjective list | **profile** defaults + brief nuance |
| 11 | What to avoid — negative list | **profile** deck-wide + brief specifics |
| 12 | Palette — named colours with hex | **profile** |
| 13 | Speaker-note intent — the verbal narrative | brief |

The skill fills 3, 4, 5, 9-styling, 10, 11, 12 automatically from the deck profile so **every slide stays consistent**; the user supplies 1, 2, 6, 7-content, 8, 9-text, 13.
