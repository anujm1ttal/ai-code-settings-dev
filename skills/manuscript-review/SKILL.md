---
name: manuscript-review
description: Senior developmental editor standards for narrative structure, character agency, and market-readiness. Used by the auditor for structural audits. Activated only when project type is "manuscript."
tags: ["editing", "narrative-design", "publishing", "review"]
verbosity_control: "STRICT. Use telegraphic feedback. Prioritize structural logic over prose style."
---

# Skill: Developmental Manuscript Review

**Activation**: This skill is loaded only when the `strategist` has classified the project as `manuscript` type during Step 0. The `coder` agent is inactive during manuscript projects.

## ⚖️ Step 0: Market Alignment
Before analysis, the `auditor` must validate:

### 1. Category & Genre
- Classify precisely: (e.g., YA Thriller, Adult Literary Fiction, Middle Grade Fantasy, Adult Non-Fiction).
- Identify subgenre expectations that affect structural analysis (e.g., dual timeline, unreliable narrator, epistolary).
- Flag genre-blending — note which genre's conventions take priority.

### 2. Target Word Count
Compare against industry standards:

| Category | Expected Range |
| :--- | :--- |
| Adult Literary / Commercial Fiction | 80,000 – 100,000 |
| Adult Sci-Fi / Fantasy | 90,000 – 120,000 |
| YA Fiction | 60,000 – 90,000 |
| Middle Grade | 30,000 – 55,000 |
| Adult Non-Fiction (Narrative) | 70,000 – 90,000 |
| Memoir | 70,000 – 90,000 |

- Flag manuscripts more than 15% above or below range with a **HIGH** severity note.
- Word count issues alone don't block — but they signal potential pacing or scope problems.

### 3. The North Star
- Single sentence defining the core promise/premise.
- This is the lens through which every structural decision is evaluated.
- If the North Star cannot be articulated clearly, the manuscript has a foundational problem.

## 🏗 Structural Rigor (Phase 1)

### The Hook (First 500 Words)
- Evaluate for immediate conflict, tension, or compelling question.
- **Red Flags** (flag as HIGH):
  - Opening with waking up, weather description, or looking in a mirror.
  - Info-dumps or worldbuilding exposition before the reader cares.
  - Passive scene-setting with no character agency or stakes.
- **Green Flags**:
  - Character in motion (physical or emotional).
  - Immediate tension or unanswered question.
  - Voice that establishes tone and genre within the first paragraph.

### Pacing & Structure
- Map tension against the manuscript's structural model:
  - **3-Act Structure**: Setup (0–25%) → Confrontation (25–75%) → Resolution (75–100%).
  - **Fichtean Curve**: In medias res → Rising crises → Climax → Falling action.
  - **Non-Linear**: Identify the emotional throughline that substitutes for chronological momentum.
- Identify the **Saggy Middle** — the section (typically 30–60%) where:
  - Stakes plateau or feel repetitive.
  - Subplots don't advance the main arc.
  - The protagonist is reactive rather than proactive.

### Key Structural Beats
- **Inciting Incident** (10–15%): Confirm it disrupts the protagonist's status quo irreversibly.
- **First Plot Point** (20–25%): Confirm the protagonist commits to the central conflict (no going back).
- **Midpoint** (50%): Confirm the transition from **Reaction** to **Action** — the protagonist stops responding to events and starts driving them.
- **Dark Night / All Is Lost** (75%): Confirm the protagonist faces their lowest point — internal wound exposed.
- **Climax** (85–95%): Confirm the climax resolves both the external conflict AND the internal wound.
- **Resolution**: Confirm the new status quo reflects character growth.

### Chapter-Level Checks
- Every chapter must have:
  - A clear micro-goal (what does the POV character want in this scene?).
  - A state change (something is different by the end).
  - A hook into the next chapter (question, tension, or reversal).
- Flag chapters that end in resolution without forward momentum.

## 👤 Character & Agency (Phase 2)

### Protagonist Agency Check
- **Active**: Protagonist makes choices that drive the plot. Consequences follow from their decisions.
- **Passive** (flag as HIGH): Plot happens *to* the protagonist. They are moved by external forces without meaningful choice.
- **Reactive** (flag as MEDIUM): Protagonist responds to events but doesn't initiate. Acceptable in Act 1 only — must transition to Active by Midpoint.

### Want vs. Need
- **Want** (External goal): What the protagonist is consciously pursuing. Visible to the reader.
- **Need** (Internal wound): What the protagonist must learn or overcome. Often invisible to the protagonist.
- **Conflict**: The Want and Need must be in tension — pursuing the Want without addressing the Need leads to failure. Addressing the Need requires sacrificing or redefining the Want.
- Flag manuscripts where Want and Need are identical (no internal arc) or completely unrelated (no thematic unity).

### Secondary Cast Audit
- Every named character must serve at least one of:
  - **Mirror**: Reflects or contrasts the protagonist's arc.
  - **Catalyst**: Forces the protagonist to change or make difficult choices.
  - **Obstacle**: Actively opposes the protagonist's Want (antagonist function).
  - **Subplot carrier**: Owns an independent arc that thematically reinforces the main story.
- Flag characters who exist only for:
  - Exposition delivery ("As you know, Bob...").
  - Convenience (solve problems the protagonist should solve).
  - Representation without agency (present but don't affect the story).

### Dialogue Check
- Every dialogue exchange should accomplish at least two of:
  - Reveal character (voice, values, relationships).
  - Advance plot (new information, decisions, conflict).
  - Build tension (subtext, misdirection, power dynamics).
- Flag dialogue that serves only one purpose or is purely expositional.

## 🌍 Worldbuilding & Setting (Phase 3)

### Integration
- Worldbuilding must be woven into action and character experience — never delivered as standalone exposition blocks.
- **The "Need to Know" Rule**: Only introduce world details when the character needs them or the reader needs them to understand the current scene.
- Flag worldbuilding passages longer than 2 paragraphs that aren't anchored in a character's immediate experience.

### Consistency
- Track internal rules (magic systems, technology, social structures) for contradictions.
- Flag violations of established rules without in-story justification.

### Sensory Grounding
- Setting descriptions should engage at least 2 senses beyond visual.
- Flag scenes that rely exclusively on visual description.

## 🖋 Editorial Output (The Artifact)

Generate an `EDITORIAL_LETTER.md` using these headers:

### MANUSCRIPT OVERVIEW
- **Title**: [title]
- **Category/Genre**: [classification]
- **Word Count**: [count] — [within range / over / under]
- **North Star**: [core premise in one sentence]
- **Structural Model**: [3-Act / Fichtean / Non-Linear / Other]

### THE GLOW
List 3 high-impact strengths. Be specific — not "great voice" but "the narrator's dry humor in Chapter 3 creates immediate intimacy and sets the tone for the genre." Categories to consider:
- Voice & Tone
- Concept & Premise
- Character Depth
- Worldbuilding
- Pacing (specific sections)
- Emotional Resonance

### THE GROW
The single most critical structural issue — the "Showstopper" that requires priority attention before anything else. This is not a list. It is ONE issue with:
- **What**: Clear description of the problem.
- **Where**: Specific chapters or percentage range.
- **Why it matters**: Impact on reader experience or market readiness.
- **How to approach**: High-level revision strategy (not line edits).

### REVISION ROADMAP
Prioritized revision tasks:

**High-Impact (Structural)**:
- Changes that affect the overall architecture: merging characters, shifting the midpoint, restructuring act breaks, redefining the protagonist's Need.

**Medium-Impact (Character & Arc)**:
- Character arc adjustments, relationship dynamics, subplot pruning or strengthening.

**Low-Impact (Scene & Prose)**:
- Prose polish, logic gaps, continuity errors, sensory grounding, dialogue tightening.

### BEAT MAP
Summary of structural beats with status:

| Beat | Expected Position | Actual Position | Status |
| :--- | :--- | :--- | :--- |
| Inciting Incident | 10–15% | [actual] | [Hit / Missed / Late / Early] |
| First Plot Point | 20–25% | [actual] | [Hit / Missed / Late / Early] |
| Midpoint | 50% | [actual] | [Hit / Missed / Late / Early] |
| Dark Night | 75% | [actual] | [Hit / Missed / Late / Early] |
| Climax | 85–95% | [actual] | [Hit / Missed / Late / Early] |

## 🏁 Completion Metrics

| Metric | Rating | Criteria |
| :--- | :--- | :--- |
| **Structural Integrity** | Solid / Needs Work / Major Rebuild | Are all major beats present and correctly positioned? |
| **Character Agency** | High / Passive / Inconsistent | Does the protagonist drive the plot from the Midpoint onward? |
| **Pacing** | Tight / Saggy Middle / Front-Loaded / Back-Loaded | Is tension sustained across all three acts? |
| **Market Readiness** | Query-Ready / One Revision Away / Significant Work | Could this be submitted to agents after this revision pass? |

**Primary Directive**: The single most critical revision the author must complete before the next session. This must be actionable, specific, and structural — not a prose note.