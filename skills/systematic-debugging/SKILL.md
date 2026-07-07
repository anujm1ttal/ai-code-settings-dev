---
name: systematic-debugging
description: Use this skill whenever investigating bugs, test failures, inconsistent behavior, or performance bottlenecks. It mandates a rigorous 4-phase process (Data Gathering, Root Cause, Hypothesis, Implementation) before any fix is proposed. Trigger when a user reports an error, a command fails with a traceback, or when tests are failing. Do NOT use for general feature implementation or architectural planning unless a specific failure is being triaged.
argument-hint: "<error message or failing test description>"
model: claude-sonnet-5
metadata:
  version: "1.1.0"
  tags: [debugging, troubleshooting, root-cause, testing, verification]
---


# Skill: Systematic Debugging

## 🔍 The Iron Law
**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**
Patching symptoms is a violation of current task standards. You must prove you understand *why* a failure happens before proposing a solution.

## 🗺 Investigation Strategy Decision Tree

```text
IS THIS A FAILURE?
│
├── [NO] ───────────────────> STOP. Use feature implementation skills.
│
├── [YES]
│    │
│    ├── TYPE: Crash / Exception
│    │   └── [ACTION]: Gather full stack trace + state snapshot. Phase 1.
│    │
│    ├── TYPE: Logical Incorrectness (Math/Geometry)
│    │   └── [ACTION]: Isolate pure logic in Lane B. Compare against manual matrix.
│    │
│    ├── TYPE: Performance Bottleneck
│    │   └── [ACTION]: Profile with timing decorators. Identify the "Hot Path."
│    │
│    └── TYPE: Heuristic/Aesthetic "Feels Wrong"
│        └── [ACTION]: Compare against LAYOUT_SPEC.md or domain standards.
```

## 🛠 The 4-Phase Process

### Phase 1: Data Gathering & Reproduction
- **Reproduction**: Create a minimal test case that fails 100% of the time.
- **Evidence**: Collect logs, state snapshots, and stack traces.
- **Stack Trace Analysis**: Trace the error from the entry point to the crash site. Don't just look at the top line.

### Phase 2: Root Cause Investigation
- **Why? x 5**: Ask why the error occurred until you reach the system boundary.
- **Pattern Matching**: Find a working example of the same logic in the codebase. Compare it against the failing code.
- **Variable Isolation**: If multiple factors exist, isolate them. Change only ONE variable at a time using tests.

### Phase 3: Hypothesis & Verification
- State exactly what you believe is wrong.
- Propose a fix that addresses the **root cause**, not the symptom.
- Predict the outcome of the fix.

### Phase 4: Implementation & Defense-in-Depth
- Implement the fix using the **High-Rigor TDD Loop**.
- **Defense**: Add validation or assertions to the crash site to prevent this class of bug from recurring silently.
- **Broad Sweep**: Check for the same bug pattern in other files.
- **Re-triage after collection-layer fixes**: After any fix at the *collection* layer (import-mode, testpaths, conftest, guard, fixture), re-run the FULL suite — tests that could not be collected before are now runnable and may fail. The pre-fix failure count is a floor, not the total. Corollary: the exit gate must be the literal success-metric invocation (full combined run), never a per-file/per-directory proxy — standalone-green ≠ combined-run-green.

## 🔄 High-Rigor TDD Loop
Use this loop for all bug fixes and complex features (full mandate: `test-driven-development` skill):
1. **RED**: Create a minimal, automated test that reproduces the bug (or defines the new feature). Run it and confirm it **FAILS** with the expected error.
2. **GREEN**: Implement the **minimum code** necessary to make the test pass. Do not over-engineer. Run the test and confirm it **PASSES**.
3. **REFACTOR**: Improve the code quality, remove duplication, and align with `coding-style.md` while ensuring the test stays **GREEN**.

## ⚖️ The 3-Fix Escalation Rule
If you implement a fix and the test still fails **3 times in a row**, you must STOP.
1. **Reset**: Revert all changes to the last known good state.
2. **Escalate**: Route back to the `strategist` to question the underlying architecture.
3. **Do not** keep trying "one more fix."

## 🚫 Anti-Rationalization Table

| Excuse | Reality |
| :--- | :--- |
| "I'm 90% sure this fix will work." | 90% sure = 100% guessing. Go back to Phase 2. |
| "It's just a simple race condition." | Prove it with a passing test that previously failed. |
| "I'll add the logs later." | Logs are your eyes. You are blind without them. Add them NOW. |
| "I've seen this before, I know the fix." | Previous experience is a guide, not evidence. Verify for THIS codebase. |

## 🚩 Red Flags (STOP & INVESTIGATE)
- Fixes that use `try/except` to hide errors.
- Increasing timeouts as a "fix" for race conditions.
- Adding "null checks" without understanding why the value was null.
- `type: ignore` or `as any` used to "fix" a type error.

## ⏱ Condition-Based Waiting (the fix for timeout-bumping)
A bumped timeout never fixes a race — it hides it until a slower machine reopens it.
- **Wait on the condition, not the clock**: poll for the observable state change (file exists, port open, status == ready) at a short interval with a hard deadline.
- **Deadline = diagnosis**: on expiry, fail with the last observed state ("status still PENDING after 30s"), never a bare timeout message.
- **No observable signal?** That IS the root cause — the system lacks a completion signal. Add one; do not guess durations.

## 📝 Verification Protocol
When declaring a bug "Fixed," you must provide:
1. The **Reproduction Script/Test** that initially failed.
2. The **Root Cause** description (1 sentence).
3. The **Fresh Evidence** (command output) showing the test now passes.

## 🔗 Relationships
- **Verification**: Depends on `verification-gate` for evidence standards.
- **TDD Mandate**: Phase 4 fixes follow the `test-driven-development` skill.
- **Lane Selection**: Reproduce in the cheapest valid lane per `rules/common/testing-strategy.md` (Lane B → A-headless → A-live → A-full).

## 📄 Output Templates

### DEBUG_LOG.md
When performing a systematic deep-dive, maintain an `Artifacts/DEBUG_LOG.md` file using this structure:

```markdown
# 🔍 Debugging Session: [Symptom Name]

- **Status**: [Gathering / Investigating / Verifying / Fixed]
- **Reproduction**: `pytest tests/test_failure.py`
- **Root Cause**: [Pending / One-sentence description]

## 🛠 Phase 1: Data Gathering
- [ ] Captured stack trace
- [ ] Isolated minimal failing input
- [ ] Evidence: [Log snippet or snapshot link]

## 🔬 Phase 2: Root Cause Investigation
- [ ] Why 1: [Reason]
- [ ] Why 2: [Reason]
- [ ] Why 3: [Reason]
- [ ] Why 4: [Reason]
- [ ] Why 5: [Root Cause]

## 💡 Phase 3: Hypothesis & Verification
- **Hypothesis**: [Description]
- **Proposed Fix**: [Minimal code change]
- **Predicted Outcome**: [What should happen]

## ✅ Phase 4: Implementation & Defense
- [ ] Fix implemented
- [ ] Regression test added
- [ ] Defense-in-depth: [e.g., added assertion to module_x.py]
```

