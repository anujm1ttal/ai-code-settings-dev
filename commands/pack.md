---
description: Triggers the scribe to generate all required YouTube upload metadata (Title options, Description, Tags, Pinned Comment).
argument-hint: ""
model: claude-haiku-4-5
---

# Command: /pack

**Scribe** takes control to finalize the video for upload, generating SEO-optimized metadata.

## Pre-requisites
1. The project type must be `youtube`.
2. A finalized `Artifacts/SCRIPT.md` and `Artifacts/VIDEO_PLAN.md` must exist.

## Workflow Execution

1. **Context Intake**: Read the finalized `Artifacts/SCRIPT.md` and `Artifacts/VIDEO_PLAN.md`.
2. **Title Variations**: Generate 3 alternative Title options similar to the approved title, just in case A/B testing is desired.
3. **Description Generation**:
   - The first two lines must be highly compelling and summarize the value (these show up in search results).
   - Include a brief synopsis of the video.
   - If applicable, generate Chapter Markers (formatting: `00:00 - Intro`).
4. **SEO Tags**: Generate a comma-separated list of highly relevant, specific tags (both broad and niche).
5. **Community Engagement**: 
   - Write a draft for a Pinned Comment that asks a specific question to drive engagement.
   - Write a draft for a YouTube Community Post promoting the new video.
6. **Output**: Save all of this into a new file called `Artifacts/METADATA.md`.
