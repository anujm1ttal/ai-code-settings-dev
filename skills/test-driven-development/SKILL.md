---
name: test-driven-development
description: Use this skill whenever writing or modifying production code — new features, bug fixes, refactors, or schema changes. Trigger before the first line of implementation is written, when an implementer subagent is dispatched, or when reviewing whether completed work followed the TDD mandate. Do NOT use for pure documentation, configuration, or planning tasks with no testable surface.
argument-hint: "<feature or fix about to be implemented>"
metadata:
  version: "1.0.0"
  tags: [testing, tdd, red-green-refactor, verification, quality]
---

# Skill: Test-Driven Development

## 🔴 The Iron Law
**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.**
If implementation code exists before its test, delete it and restart from the test. "Delete" means delete — do not keep it open in a tab, do not "adapt" it, do not keep it "as reference." Violating the letter of this rule is violating the spirit of this rule.

## 🔄 The Cycle

1. **RED** — Write ONE minimal test that demonstrates the desired behavior. No implementation yet.
2. **Verify RED** — Run it. Confirm it fails **for the right reason** (missing behavior — not a syntax error, missing import, or typo). If you skipped this step, you cannot prove the test validates anything.
3. **GREEN** — Write the simplest code that passes. No speculative features, no premature optimization.
4. **Verify GREEN** — Run the test. Confirm it passes AND no other tests broke.
5. **REFACTOR** — Only while green: remove duplication, improve names, align with `coding-style.md`. Re-run tests after.

**If the test passes immediately at step 2**: you are testing behavior that already exists. Fix the test — it proves nothing.

## 🛤 Lane Selection (mandatory)
Write the failing test in the **cheapest valid lane** per `rules/common/testing-strategy.md`:
Lane B (pure logic, no runtime) → Lane A-headless (RhinoCommon via Rhino.Inside) → Lane A-live → Lane A-full.
A Lane B unit test cannot prove runtime geometry behavior; runtime evidence cannot substitute for unit evidence when pure logic changed.

## 🧾 No Testable Surface? Say So.
The only exemption is a task with genuinely no runtime surface (pure docs, comments, static config). The exemption must be **claimed explicitly in your report** ("No testable surface: reason"), never applied silently. If you find yourself writing logic — a conditional, a transformation, a calculation — the exemption is void.

## 🚫 Anti-Rationalization Table

| Excuse | Reality |
| :--- | :--- |
| "I'll write the test after." | A test written after passes immediately and proves nothing about validity. |
| "I already tested it manually." | Ad-hoc manual checks are not reproducible and vanish with the session. |
| "Deleting working code wastes hours." | Keeping unverified code is the debt. The sunk cost is already spent. |
| "This is too simple to test." | Simple code with a bug ships the bug. The test costs one minute. |
| "Tests-after achieve the same goal." | Tests-after answer "what does this code do?" Tests-first answer "what SHOULD it do?" |
| "TDD is dogma; I'm being pragmatic." | Catching the bug before commit is the pragmatic outcome. |

## 🚩 Red Flags (STOP — restart the cycle)
- Rationalizing "just this once."
- Writing more than one failing test before going green.
- Keeping pre-test implementation code "as reference."
- Claiming "it's about the spirit, not the ritual."
- A "(if applicable)" hedge appearing in your own reasoning about whether to test.

## 🔗 Relationships
- **Evidence standards**: `verification-gate` defines what fresh proof of RED/GREEN looks like.
- **Bug fixes**: `systematic-debugging` Phase 4 delegates its fix loop to this skill.
- **Dispatch**: `implementation-dispatch` implementer prompts bind subagents to this mandate.
