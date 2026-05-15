---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.
---

# Skill Creator

A skill for creating new skills and iteratively improving them.

## Deep-Load Protocol
Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/architecture-guide.md` | Before drafting SKILL.md or defining directory structure |
| `references/testing-protocol.md` | Before running test cases, grading, or aggregating benchmarks |
| `references/trigger-optimization.md` | Before optimizing the frontmatter description |

## Workflow Overview

1. **Intent Capture**: Understand what the skill should enable Claude to do and when it should trigger.
2. **Drafting**: Write the `SKILL.md` following [architecture-guide.md](references/architecture-guide.md).
3. **Evaluation**: Run test cases and evaluate with the user following [testing-protocol.md](references/testing-protocol.md).
4. **Iterative Improvement**: Refine the skill based on feedback.
5. **Trigger Optimization**: Optimize the frontmatter description following [trigger-optimization.md](references/trigger-optimization.md).

## Communicating with the user

- Tailor your language to the user's technical level.
- Briefly explain jargon (JSON, assertion, etc.) if unsure of user's familiarity.

## Creating a skill

### Capture Intent
Extract intent from the conversation history.
1. What should this skill enable Claude to do?
2. When should this skill trigger?
3. What's the expected output format?
4. Do we need test cases? (Verifiable outputs benefit from them).

### Write the SKILL.md
Follow the anatomy and patterns in [architecture-guide.md](references/architecture-guide.md).
- **Metadata**: Name + "pushy" description.
- **Body**: Imperative instructions under 500 lines.
- **Resources**: Scripts and references for deterministic tasks.

## Evaluation & Iteration
Follow the rigorous testing protocols in [testing-protocol.md](references/testing-protocol.md).
- Spawn parallel runs (with-skill vs. baseline).
- Generate the eval viewer for human feedback.
- Aggregate benchmarks (tokens, time, pass rate).

## Improving the skill
- **Generalize**: Avoid "overfitting" to specific test cases.
- **Lean Prompt**: Remove fluff; explain the "Why".
- **Bundled Scripts**: If subagents repeat the same manual code, move it to `scripts/`.

## Description Optimization
After the logic is solid, follow [trigger-optimization.md](references/trigger-optimization.md) to ensure Claude invokes the skill reliably.

## Packaging
Once satisfied, package the final skill:
```bash
python -m scripts.package_skill <path/to/skill-folder>
```
Give the user the `.skill` file path for installation.

**Primary Directive**: Create lean, imperative, and verifiable skills. If an instruction is static or complex, move it to a reference file.
