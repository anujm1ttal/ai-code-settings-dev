# Anti-Pattern: Auditor Mutation-Testing Catches Hollow Tests

**Category:** anti-patterns  
**First seen:** 2026-07-08 (OSH-6 pre-deploy gate)

## The gotcha

Code-review spot-checks and manual inspection can miss test-fixture bugs that only runtime mutation-testing reveals.

During OSH-6 pre-deploy verification:
- Coder's spot-check reported "all tests pass" after fixture refactor
- Mutation-testing run found a **hollow test** — the fixture was never actually exercised, so it passed trivially
- A second mutation-testing pass caught a **rollback-safety gap** in deploy.sh backup restoration logic
- Both required remediation and re-verification before deploy gate could pass

## The rule

- **Spot-check ≠ comprehensive verification.** Code review catches logic errors but misses fixture initialization bugs.
- **Mutation-testing is non-optional before production deploy.** It exercises the whole stack (fixtures, mocks, assertions, edge cases) in ways a single test run cannot.
- When test suite passes but auditor has suspicion: run full test + mutation suite, not just line-by-line code audit.
- Flag "fixture never touched" as a pre-deploy blocker. Hollow tests hide real bugs.

## Related

Related to **Enforcement Config Never Runtime-Verified** (same family: configuration exists but is not actually being exercised). Both require runtime verification, not inspection-only.

## Action

Always run full test suite + mutation variants before any deploy gate. Do not treat "all tests pass" from spot-check as sufficient evidence.
