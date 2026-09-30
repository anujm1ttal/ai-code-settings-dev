---
name: testing-strategy
description: Canonical testing taxonomy, runtime-lane selection, evidence requirements, and TDD rules across Python, Rhino/GH, TypeScript/MCP, DAX, and Power BI.
---

# Testing Strategy: Antigravity Verification

Decides the cheapest valid test lane that proves a claim, and the evidence required before
calling work complete. Test taxonomy, runtime lanes (Rhino/GH, frontend), TDD loop/bug triage,
and mocking boundaries: `rules/lang/testing.md`. Required evidence by project type:
`agents/auditor.md`.

## Evidence Rules

- **Artifact-backed [HARD-GATE]**: any command output backing a verified claim redirects to
  `Artifacts/Temp/<phase>_<step>_<command>.txt` (full output + exit code) and is cited by path —
  chat prose points at it, never substitutes for it. Applies at every rigor tier
  (`orchestration.md` §Execution Cadence owns no-artifact-no-PASS and the MTP exemption).
  Evidence a durable record cites gets promoted out of `Temp/` before purge (§Evidence Retention).
- **Assertion mode**: "Passed with exit code 0" required; "should pass" forbidden.
- **A suite total is a run record, never a gate** — gate on a floor (`≥N`) or exit code; totals
  drift as parametrized tests track live `Plans/*-TODO.md`.
- **Entry-point coverage**: evidence for a user-facing capability exercises the outermost entry
  point (route, CLI command, tool call) — a gate on the function beneath it certifies a path no
  user can reach. Count route/command coverage separately from unit coverage.
- **Oracle discipline**: every absence-proof carries a presence-control proving the probe can
  see what it claims is missing. Read the actual type/struct before asserting on its fields — a
  mistyped field is a silent false negative, not an error.
- **Enumerate, don't estimate**: any count of code entities (tools, constants, routes, call
  sites) is a produced, counted list — cross-check with ≥2 distinct search patterns and report
  disagreement rather than trusting one.
- **Asymmetry**: E2E can't substitute for unit evidence when pure logic changed; unit can't
  substitute for E2E when Rhino geometry behavior changed.
