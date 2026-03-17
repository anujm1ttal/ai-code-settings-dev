---
description: Triggers the strategist to ideate YouTube video concepts. Generates Title, Thumbnail, and Angle packages.
---

# Command: /ideate

**Strategist** takes control to conceptualize a new YouTube video, ensuring the "Right to Exist" before any scripting begins.

## Pre-requisites
1. The project type must be `youtube`.
2. Equip the `youtube-strategy` skill.

## Workflow Execution

1. **Analyze Request**: Review the user's initial idea, topic, or target audience.
2. **Concept Generation**: Develop exactly 3 distinct video concepts based on the target audience.
3. **Packaging Rules**: For each concept, explicitly follow the "Packaging First" rules from the `youtube-strategy` skill.
   - Title must be optimized for CTR (under 60 chars).
   - Thumbnail must have a clear visual description and minimal text.
   - Angle must explain the emotional payoff for the viewer.
4. **Output Format**: Present the 3 options to the user clearly. Ask the user to select one or request modifications.
5. **Next Steps**: Once the user approves a concept, create a `VIDEO_PLAN.md` file documenting the approved Title, Thumbnail description, Target Audience, and a bulleted outline of the video flow. Prompt the user to run `/script` when ready.
