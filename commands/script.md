---
description: Triggers the scribe to write or expand a YouTube script based on an approved video plan.
argument-hint: ""
model: claude-haiku-4-5
---

# Command: /script

**Scribe** takes control to transform an outline into a fully formatted A/V (Audio/Visual) YouTube script.

## Pre-requisites
1. The project type must be `youtube`.
2. A `Artifacts/VIDEO_PLAN.md` must exist with an approved title, thumbnail, and outline.
3. Equip the `youtube-scriptwriting` skill.

## Workflow Execution

1. **Context Intake**: Read the `Artifacts/VIDEO_PLAN.md` to understand the pacing, angle, and core message.
2. **Drafting the Script**: 
   - Create or update `Artifacts/SCRIPT.md`.
   - Write exactly as it will be spoken (active voice, short punchy sentences, conversational tone).
   - Apply the A/V format using `[VISUAL CUE]` tags for every visual change (B-roll, text, cuts).
   - Ensure the Hook (first 30 seconds) immediately pays off the title/thumbnail promise.
3. **Review Recommendation**: Once the draft is complete, prompt the user to run `/audit` to have the Auditor grade the script against retention metrics.
