---
name: youtube-retention
description: Use this skill whenever you are auditing or refining a YouTube script for viewer retention, pacing, and hook strength. It mandates a strict rubric (Hook, Micro-Hooks, Visual Variety, Content Density) to prevent audience drop-off. Trigger when the auditor is reviewing a script draft or when the scribe is performing a self-audit before submission. Do NOT use for keyword research or metadata optimization; use youtube-strategy for those marketing tasks.
argument-hint: "<script draft or retention concern>"
metadata:
  version: "1.0.1"
  tags: [youtube, retention, pacing, hooks, auditing]
---


# YouTube Retention Skill

This skill defines the mathematical pacing and retention standards for grading YouTube scripts. It is exclusively used by the `auditor` during the script review `/audit` phase.

## Score / Rubric
The auditor must grade the script draft across 4 categories (Hook, Micro-Hooks/Pacing, Visual Variety, Content Density) on a Pass/Fail basis.

### 1. Hook (0:00 - 0:30)
**Goal:** Prove to the user immediately that clicking the video was a good decision.
- **Fail:** Introduction is longer than 5 seconds ("Hey everyone, welcome back..."). The stakes are low, or the promise doesn't match the title.
- **Pass:** The dialogue immediately re-establishes the title/thumbnail premise, creates a curiosity gap ("open loop"), and promises a payoff later in the video.

### 2. Micro-Hooks and Pacing
**Goal:** Prevent dips in the retention graph by varying the tempo of the script.
- **Fail:** Long, unbroken monologues explaining complex topics. Same conversational pace for pages. Missing structure.
- **Pass:** Every ~60 seconds, the script must:
  - Introduce a new complication or problem.
  - Tease a payoff arriving later.
  - Or explicitly transition into a new topic/chapter clearly.

### 3. Visual Variety (The B-roll Ratio)
**Goal:** If a viewer looks away from the screen, they are more likely to click away. We must give them visual treats.
- **Metric:** The script MUST have a `[VISUAL CUE]` every 3 to 4 sentences of dialogue.
- **Fail:** Large blocks of `**HOST**` dialogue without any visual direction, B-roll overlay, text pop-up, zooming instruction, or camera cut.
- **Pass:** Consistent visual variety mapped to the dialogue rhythm. B-roll ideas feel achievable and distinct.

### 4. Content Density (No Fluff)
**Goal:** Maximum signal-to-noise ratio.
- **Fail:** Sentences that add word-count but no new information, emotion, or entertainment. Clichés, throat-clearing, or over-explaining a simple point.
- **Pass:** Every sentence advances the narrative or teaches a specific, valuable insight.

## Rejection Process
- If the script fails in any of the above categories, the `auditor` must log a **HIGH** severity flag and reject the draft, returning it to the `scribe` for revision with explicit line notes.
