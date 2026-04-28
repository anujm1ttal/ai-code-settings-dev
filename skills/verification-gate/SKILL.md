---
name: verification-gate
description: Use when about to claim work is complete, fixed, or passing — before committing, creating PRs, or marking tasks done. Evidence before assertions, always.
tags: [verification, completion, evidence, quality-gate]
auto_activate: false
metadata:
  version: "1.0.0"
---

# Skill: Verification Gate

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in THIS message, you cannot claim it passes.
Claiming work is complete without verification is dishonesty, not efficiency.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|:---|:---|:---|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |

## Red Flags — STOP

If you catch yourself thinking:
- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!")
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- Thinking "just this once"
- **ANY wording implying success without having run verification**

**ALL of these mean: STOP. Run the command. Read the output. THEN claim the result.**

## 🚫 Anti-Rationalization Table

| Excuse | Reality |
|:---|:---|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler ≠ tests |
| "Agent said success" | Verify independently |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter. Always. |
| "I already tested it mentally" | Mental models are not evidence |

## Agent Integration

- **Coder**: Invoke before claiming any task implementation is ready for review
- **Audit Trail**: Every gate pass must be linkable to a specific test run or log file.

## 🔗 Relationships
- **Debugging**: Cross-ref `systematic-debugging` for root-cause mandate.
- **Reporting**: Auditor uses this to verify `Artifacts/TODO.md` tasks.

## Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**Agent delegation:**
```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust agent report
```
