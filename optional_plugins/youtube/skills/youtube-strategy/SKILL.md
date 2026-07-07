---
name: youtube-strategy
description: Use this skill whenever you are ideating video concepts, packaging (Title/Thumbnail), or performing SEO/audience analysis for YouTube. It enforces a "Packaging First" approach where no script is written until the Title and Thumbnail Concept are approved. Trigger when the strategist is executing the /ideate command or when a user asks "How can I grow my YouTube channel?" Do NOT use for scriptwriting or retention audits; use specialized script skills for those production phases.
argument-hint: "<video concept or target audience description>"
metadata:
  version: "1.0.1"
  tags: [youtube, strategy, growth, seo, packaging]
---


# YouTube Strategy Skill

This skill defines the standards for packaging YouTube videos. It is utilized primarily by the `strategist` to evaluate the "Right to Exist" of a video concept before a script is written.

## Core Principle: Packaging First
No script can be written until the **Title** and **Thumbnail Concept** are explicitly approved and locked. The packaging determines the entire angle and outline of the video.

## 1. Title Rules
Titles must be optimized for Click-Through Rate (CTR) and human curiosity, not just search algorithms.

- **Length**: Target 40-50 characters. Hard maximum is 60 characters (to avoid truncation on mobile).
- **Structure**: 
  - Use extreme clarity.
  - Provoke curiosity (create an "open loop" that the video answers).
  - Use familiar, high-leverage words (e.g., "The Truth About...", "I Tried...", "Why I Quit...").
- **Avoid**:
  - Clickbait that the video doesn't deliver on (this kills retention).
  - Academic or overly technical phrasing unless it's a specific tutorial.
  - Putting the channel name in the title.

## 2. Thumbnail Conceptualization
Thumbnails must be visually striking and instantly understandable.

- **Visual Hierarchy**: 1 or 2 focal points maximum. The viewer must understand the image in less than 1 second.
- **Text**: Maximum 3 words. The text should complement the title, NOT repeat it. (e.g., Title: "I Survived 50 Hours in Antarctica", Thumbnail Text: "It was a mistake").
- **Emotion**: Faces (if used) must show strong, clear emotion (shock, concentration, joy).
- **Contrast/Color**: Describe high contrast elements and color schemes that pop against YouTube's dark/light modes.

## 3. The Package (Title + Thumb + Angle)
When ideating, concepts must always be presented as a cohesive package:

```markdown
### Concept Option A
**Title**: [The Title Idea]
**Thumbnail**: [Detailed visual description: Foreground subject, Background setting, Text overlay, Core emotion]
**Angle/Hook**: [2-sentence explanation of why the viewer cares and what emotional payoff they get]
```

## 4. Audience Fit & SEO Constraints
- **Target Avatar**: Clearly define who this video is for (e.g., "Beginner AI developers", "Senior Python engineers").
- **Search vs. Browse**: Determine if the video is targeting search traffic (tutorials/how-to) or browse/suggested traffic (entertainment/story-driven). Titles for search should be more descriptive; titles for browse should be more emotional/curiosity-driven.
- **Competitor Analysis**: Provide 1-2 examples of similar successful videos to benchmark the concept against.
