---
name: manuscript-review
description: Use this skill whenever you are auditing narrative structure, character agency, or market-readiness of a manuscript. Trigger when the auditor is performing a structural audit and the project has been classified as "manuscript" type during Step 0. Do NOT use for business/ROI justification or non-narrative technical review — use business-analyst for requirement/ROI work instead.
argument-hint: "<narrative premise or chapter snippet>"
model: claude-sonnet-5
metadata:
  version: "1.0.1"
  tags: ["editing", "narrative-design", "publishing", "review", "manuscript-analysis"]
  verbosity_control: "STRICT. Use telegraphic feedback. Prioritize structural logic over prose style."
---


# Skill: Developmental Manuscript Review

**Activation**: This skill is loaded only when the `strategist` has classified the project as `manuscript` type during Step 0. The `coder` agent is inactive during manuscript projects.

## Deep-Load Protocol
Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/market-standards.md` | Before validating genre, word count, or market alignment |
| `references/editorial-standards.md` | Before generating the EDITORIAL_LETTER or validating completion metrics |

## ⚖️ Step 0: Market Alignment
Before analysis, the `auditor` must validate category, genre, and word count standards defined in [market-standards.md](references/market-standards.md).

### The North Star
- Single sentence defining the core promise/premise.
- This is the lens through which every structural decision is evaluated.
- If the North Star cannot be articulated clearly, the manuscript has a foundational problem.

## 🏗 Structural Rigor (Phase 1)

### The Hook (First 500 Words)
- Evaluate for immediate conflict, tension, or compelling question.
- **Red Flags**: Opening with waking up, weather, mirror, or info-dumps.
- **Green Flags**: Character in motion, immediate tension, establishing voice.

### Pacing & Structure
- Map tension against the manuscript's structural model (3-Act, Fichtean, Non-Linear).
- Identify the **Saggy Middle** (30–60%) where stakes plateau or characters become reactive.

### Key Structural Beats
- **Inciting Incident** (10–15%): Disrupts status quo irreversibly.
- **First Plot Point** (20–25%): Commitment to conflict.
- **Midpoint** (50%): Transition from Reaction to Action.
- **Dark Night** (75%): Lowest point, wound exposed.
- **Climax** (85–95%): Resolves external conflict AND internal wound.

### Chapter-Level Checks
- Every chapter must have a micro-goal, a state change, and a hook.

## 👤 Character & Agency (Phase 2)

### Protagonist Agency Check
- **Active**: Choices drive plot. Reactive is only acceptable in Act 1.
- **Want vs. Need**: pursue Want (external) while addressing Need (internal).

### Secondary Cast Audit
- Every character must be a Mirror, Catalyst, Obstacle, or Subplot carrier.
- Flag exposition-only or convenience characters.

## 🌍 Worldbuilding & Setting (Phase 3)

### Integration
- Worldbuilding must be woven into action ("Need to Know" rule).
- Consistency: Track internal rules for contradictions.
- Sensory Grounding: Engage at least 2 senses beyond visual.

## 🖋 Editorial Output (The Artifact)
Standardized output requirements and beat mapping are defined in [editorial-standards.md](references/editorial-standards.md).

**Primary Directive**: The single most critical revision the author must complete before the next session. This must be actionable, specific, and structural — not a prose note.