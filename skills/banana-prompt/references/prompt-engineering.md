# AI Image Prompt Engineering Guide

> Follow these structural rules when formulating the final prompt in Step 3 of the Banana-Prompt pipeline.

## Structure of a Perfect Prompt
The most effective prompts follow a strict grammatical structure. Do not use conversational language like "Please draw a..." or "I would like an image of..."

**Formula**: 
`[Subject/Action] + [Setting/Context] + [Lighting/Mood] + [Camera/Medium] + [Aspect Ratio/Parameters]`

## Explicit Details
- **Subject**: Be incredibly specific about the subject. If it's a person, define their expression (e.g., "shocked expression", "hyper-focused").
- **Lighting**: Lighting defines the quality of an AI image. Use terms like:
  - *Cinematic lighting, volumetric rays, Rembrandt lighting, soft studio box light, neon synthwave glow, golden hour.*
- **Medium**: Explicitly define what the image *is*.
  - *Macro photography, 35mm lens, flat vector illustration, corporate isometric graphic, 3D octane render.*

## Negative Constraints (What NOT to do)
- Do not overload the prompt with contradictory terms (e.g., "photorealistic flat vector").
- Avoid complex multiple-subject interactions. AI struggles with specific relationships (e.g., "A dog handing a red balloon to a cat while balancing on a ball"). Keep the focal point central and singular.
- Text: AI struggles with long text. Do not prompt for whole paragraphs of text. If text is needed, restrict it to 1-3 simple words in quotes (e.g., `holding a sign that says "WOW"`).

## Aspect Ratios
- For Midjourney: Append `--ar [width]:[height]`. 
- For Gemini/DALL-E: Explicitly state the orientation in the prompt (e.g., "Wide 16:9 aspect ratio").
