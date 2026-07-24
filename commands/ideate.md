---
description: Triggers the strategist to ideate YouTube video concepts. Generates Title, Thumbnail, and Angle packages.
argument-hint: "[--team] <topic-or-audience>"
model: claude-opus-5
---

# Command: /ideate

**Target**: `$ARGUMENTS` → optional `--team` flag + required `<topic-or-audience>`.

**Strategist** takes control to conceptualize a new YouTube video, ensuring the "Right to Exist" before any scripting begins.

## Pre-requisites
1. The project type must be `youtube`.
2. Equip the `youtube-strategy` skill.

## Workflow Execution (Default)

1. **Analyze Request**: Review the user's initial idea, topic, or target audience.
2. **Concept Generation**: Develop exactly 3 distinct video concepts based on the target audience.
3. **Packaging Rules**: For each concept, explicitly follow the "Packaging First" rules from the `youtube-strategy` skill.
   - Title must be optimized for CTR (under 60 chars).
   - Thumbnail must have a clear visual description and minimal text.
   - Angle must explain the emotional payoff for the viewer.
4. **Output Format**: Present the 3 options to the user clearly. Ask the user to select one or request modifications.
5. **Next Steps**: Once the user approves a concept, create a `Artifacts/VIDEO_PLAN.md` file documenting the approved Title, Thumbnail description, Target Audience, and a bulleted outline of the video flow. Prompt the user to run `/script` when ready.

## Workflow Execution (`/ideate --team`)

Leverages Claude Agent Teams to test ideas against competing hypotheses. If token context limits are hit, automatically fall back to standard execution.
1. **Spawn Team**: The `strategist` spawns a team of 3 specialized teammates:
   - **Audience Advocate**: Angles the concept strictly on retention desires and audience emotional payoff.
   - **Click-Through Specialist**: Pitches purely on Title/Thumbnail clickability.
   - **Devil's Advocate**: Pushes back and critiques the first two, challenging weak hooks.
2. **Synthesis**: The `strategist` observes the debate and formulates 3 incredibly distinct and hardened video hooks.
3. **Follow Standard Next Steps**: Prompts user for selection and creates the `Artifacts/VIDEO_PLAN.md`.
