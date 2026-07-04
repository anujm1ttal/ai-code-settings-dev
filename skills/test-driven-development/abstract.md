# Skill Abstract: Test-Driven Development (L0)

**Purpose**: Mandatory failing-test-first discipline for all production code changes.

**Core Logic**:
- **Iron Law**: NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST. Code written before its test is deleted, not adapted.
- **Cycle**: RED (one minimal test) → Verify RED (fails for the right reason) → GREEN (simplest pass) → Verify GREEN → REFACTOR while green.
- **Lane Selection**: Failing test goes in the cheapest valid lane (`testing-strategy.md`: B → A-headless → A-live → A-full).
- **Exemption**: Only a task with no testable surface — and the exemption must be claimed explicitly in the report, never applied silently.

**Constraint**: A test that passes immediately proves nothing — fix the test. No "just this once."
