---
name: testing-lanes
description: Test taxonomy, runtime-lane selection, TDD/bug-triage loop, and mocking boundaries. Loads only when a test file is touched — evidence rules (always-loaded) live in rules/common/testing-strategy.md.
paths: ["**/tests/**", "**/test_*.py", "**/*_test.py", "**/conftest.py", "**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"]
---

# Testing Lanes, TDD & Mocking

## Test Taxonomy

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

## Runtime Lanes

Rhino/GH — default rule: cheapest lane that proves the claim, order B → A-headless → A-live → A-full.

| Lane | Use For | Requires Rhino? |
| :--- | :--- | :--- |
| **Lane B — Pure** | math, parsing, validators, metadata, sorting, data transforms | No |
| **Lane A-headless** | RhinoCommon geometry, Breps, meshes, intersections | Yes, via Rhino.Inside |
| **Lane A-live** | Scriptable checks needing plugins/document state | Yes, running instance via `rhinocode` CLI (8.11+) |
| **Lane A-full** | Interactive UI, dialogs, manual picks | Yes, Rhino UI (manual) |

Frontend — same rule, order F-unit → F-component → F-a11y → F-e2e.

| Lane | Use for | Requires browser? |
| :--- | :--- | :--- |
| **F-unit** | pure logic, hooks (`renderHook`), reducers, utils | No (jsdom) |
| **F-component** | render + interaction (RTL + user-event), MSW for network | No (jsdom) |
| **F-a11y** | axe assertions on rendered components | No (jsdom) |
| **F-e2e** | full user journeys, real routing, real build | Yes (Playwright) |
| **F-visual** | screenshot regression (optional) | Yes (Playwright) |

## TDD Loop & Bug Triage

RED-GREEN-REFACTOR itself is owned by `test-driven-development`; this covers bug-triage.

**Deferred defects — strict xfail**: encode every known-but-deferred defect as
`@pytest.mark.xfail(strict=True, reason="<defect> — fix scheduled Phase N")` asserting the
*correct* behavior. A silent fix triggers XPASS and fails the build — the marker can't rot.
Reproduce before encoding; never xfail an unconfirmed defect. Green-baseline/hygiene phases:
encode a discovered production defect this way rather than weakening the test or fixing out of
scope.

**Inherited triage is a hypothesis, not a given**: before bending a failing test to match
current production, probe actual production behavior — a "maintained contract" may itself be
the bug. Mechanically matching tests to production silently encodes production bugs as expected.

## Mocking Boundaries

Mock external systems, never internal logic. A wrapper/flatten component's mocks must mirror
the real, fully-wrapped response shape (captured from a live probe) — exercise it end-to-end
against real data at least once before trusting its unit-green. Frontend: mock the network
(MSW), never your own components. Rhino/GH: stub `rhinoscriptsyntax`/`scriptcontext`/`Rhino.*`
for import safety in pure tests, use `Rhino.Inside` for real `RhinoCommon` behavior — a stub
never proves manifoldness, intersections, or Brep validity.
