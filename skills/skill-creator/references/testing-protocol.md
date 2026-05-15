# Skill Testing & Evaluation Protocol

## Running Test Cases

Rely on independent subagents for parallel execution. Do NOT use `/skill-test`.

### Step 1: Spawn Runs
Spawn both "with-skill" and "baseline" runs in the same turn.
- **Creating new skill**: Baseline = no skill.
- **Improving skill**: Baseline = snapshot of old version.

### Step 2: Evaluation (Reviewer)
Use `eval-viewer/generate_review.py` to create a human-in-the-loop review interface.
- Generate the viewer BEFORE evaluating inputs yourself.
- Focus on qualitative feedback.

### Step 3: Benchmarking (Quantitative)
1. **Timing data**: Capture `total_tokens` and `duration_ms` from task notifications.
2. **Grading**: Use `agents/grader.md` to evaluate assertions.
3. **Aggregation**: Run `scripts.aggregate_benchmark` to produce `benchmark.json`.
4. **Analyst pass**: Surface patterns, non-discriminating assertions, or high variance.

## The Iteration Loop
1. Apply improvements to the skill.
2. Rerun all test cases (Iteration N+1).
3. Launch reviewer with `--previous-workspace`.
4. Iterate until satisfied or no meaningful progress.

## Blind Comparison (Advanced)
Use `agents/comparator.md` and `agents/analyzer.md` for rigorous A/B testing between versions.
