---
name: testing-strategy
description: Canonical testing taxonomy, runtime-lane selection, evidence requirements, and TDD rules across Python, Rhino/GH, TypeScript/MCP, DAX, and Power BI.
---

# Testing Strategy: Antigravity Verification

**One-sentence definition**: `testing-strategy` decides the cheapest valid test lane that proves a claim, then defines the evidence required before anyone can call the work complete.

## 1. Test Taxonomy

| Type | Purpose | Runtime |
| :--- | :--- | :--- |
| **Unit** | Pure logic contract | No external runtime (Lane B) |
| **Boundary** | Adapter/service contract with mocks | Mocked external system |
| **Integration** | Multiple internal modules together | Local runtime |
| **E2E** | Real system/runtime path | External runtime required (Lane A) |
| **Smoke** | Minimal health check | Usually runtime required |
| **Regression** | Previously broken behavior | Depends on bug |
| **Schema** | Input/output validation | No external runtime |
| **Manual Matrix** | Known input → expected output | Human/tool verified |

## 2. Runtime Lanes (Rhino/GH focus)

| Lane | Use For | Requires Rhino? |
| :--- | :--- | :--- |
| **Lane B — Pure** | math, parsing, validators, metadata, sorting, data transforms | No |
| **Lane A-headless**| RhinoCommon geometry, Breps, meshes, intersections | Yes, via Rhino.Inside |
| **Lane A-full** | UI, GH canvas, plugins, Rhino document state | Yes, Rhino UI |

**Default Rule**: Use the cheapest lane that proves the claim.

## 3. Evidence Rules

Evidence is the currency of the **Verification Gate**.
- **Freshness**: Test command must be fresh.
- **Completeness**: Full output or summarized output with exit code required.
- **Assertion Mode**: "Should pass" is forbidden; "Passed with exit code 0" is required.
- **Asymmetry Rules**:
  - E2E evidence cannot substitute for unit evidence when pure logic changed.
  - Unit evidence cannot substitute for E2E evidence when Rhino geometry behavior changed.

## 4. TDD Loop & Bug Triage

For bug fixes and feature development:
1. **Failing Test**: Write the failing test in the lowest valid lane.
2. **Confirm Failure**: Confirm the failure matches the bug/requirement.
3. **Surgical Fix**: Implement the minimum fix.
4. **Confirm Pass**: Confirm the test passes.
5. **Runtime Check**: Add E2E only if the bug involves runtime behavior.

## 5. Mocking Boundaries

- **Rule**: Mock external systems; do not mock internal logic.
- **Rhino/GH Boundaries**:
  - Mock/stub `rhinoscriptsyntax`, `scriptcontext`, `Rhino.*` for import safety in pure tests.
  - Use `Rhino.Inside` when testing actual `RhinoCommon` geometry behavior.
  - **Forbidden**: Never pretend a stub proves manifoldness, intersections, or Brep validity.

## 6. Required Evidence by Project Type

| Project Type | Required Evidence |
| :--- | :--- |
| **code** | unit + integration + lint/typecheck |
| **geometry** | unit for pure logic + Rhino E2E for runtime invariants |
| **data** | model validation + manual matrix |
| **pptx** | script test + output file existence + visual spot-check |
| **pbi-report** | DAX checks + layout audit + performance analyzer |
| **manuscript** | rubric audit |
| **youtube** | script/package checklist |
