# Trigger Optimization Guide

The description field in SKILL.md frontmatter is the primary mechanism that determines whether Claude invokes a skill.

## Optimization Workflow

### 1. Generate Eval Set
Create 20 eval queries (10 should-trigger, 10 should-not-trigger).
- **Should-trigger**: Use realistic, concrete scenarios with variety in phrasing.
- **Should-not-trigger**: Use "near-misses" (adjacent domains, keyword overlap) to test discrimination.

### 2. User Review
Present the eval set using `assets/eval_review.html`. User signs off on `eval_set.json`.

### 3. Optimization Loop
Run `scripts.run_loop` in the background.
- It splits train/test (60/40).
- Iteratively improves the description based on failure analysis.
- Selects `best_description` based on test score to avoid overfitting.

### 4. Application
Update SKILL.md frontmatter with the optimized description.

## Best Practices
- **Be "Pushy"**: Use phrases like "Make sure to use this skill whenever..."
- **Contrast**: Explicitly state what NOT to use the skill for.
- **Coverage**: Ensure descriptions cover the full scope of the skill's utility.
