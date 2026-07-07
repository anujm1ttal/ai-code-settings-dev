---
name: youtube-scriptwriting
description: Use this skill whenever you are writing or expanding a YouTube script from an outline. It enforces Audio/Visual (A/V) formatting standards, active voice, and conversational tone designed for the spoken word. Trigger when the scribe is executing the /script command or when a user asks to "write a script for X." Do NOT use for script auditing (retention checks); use youtube-retention for that review phase.
argument-hint: "<outline or video topic>"
metadata:
  version: "1.0.1"
  tags: [youtube, scriptwriting, storytelling, creative-writing, production]
---


# YouTube Scriptwriting Skill

This skill defines the standards for writing high-performing YouTube scripts. It is utilized primarily by the `scribe` to transform outlines into a final shootable script.

## Core Principle: Writing for the Spoken Word
A YouTube script is not an essay. It is a performance document. It must be written exactly as it will be spoken by a human.

## 1. A/V Format (Audio/Visual)
All scripts must explicitly separate what is being *seen* from what is being *said*. We use a modified A/V format.

- Use a `[VISUAL CUE]` tag for all on-screen actions, B-roll, screen recordings, text pop-ups, or edits.
- The `[VISUAL CUE]` must directly precede the dialogue it corresponds to.
- Bold important words in the dialogue to indicate vocal emphasis to the presenter.

### Example Format:
```markdown
[VISUAL CUE]: Quick montage of 3 different AI agents failing (red X overlay).
**HOST**: I tried building five different AI agents this week. Four of them were total disasters.

[VISUAL CUE]: Cut to Host at desk, zooming in slightly.
**HOST**: But the fifth one? It completely changed my workflow.
```

## 2. Style and Tone Rules
- **Active Voice Only**: Never use passive voice. 
  - *Bad*: "The code was written by the AI."
  - *Good*: "The AI wrote the code."
- **Conversational Tone**: Use contractions (don't, aren't, it's). Start sentences with "And" or "But".
- **Short Sentences**: Keep sentences punchy. If a sentence requires taking a breath in the middle, it's too long.
- **Phonetic Spelling**: If a technical term, company name, or acronym is hard to pronounce, provide a phonetic spelling in parentheses `(like this)`.
- **Eliminate Fluff**: Remove throat-clearing intros ("In today's video I'm going to show you..."). Jump straight into the value.

## 3. Pacing and Structure
- **The Hook (0:00 - 0:30)**: The first 30 seconds must restate the premise of the title/thumbnail, establish the stakes, and promise a payoff.
- **Micro-Hooks**: Every 60-90 seconds, re-engage the viewer by teasing an upcoming reveal or shifting the topic slightly.
- **The Call to Action (CTA)**: Only put the CTA (subscribe/like) *after* you have delivered massive value. A quick, organic integration is better than a long, pleading speech.
- **The End Screen**: Do not say "thanks for watching" or "in conclusion", as viewers instantly click off. Point them directly to the next relevant video with a seamless transition.
