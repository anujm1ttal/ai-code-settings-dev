---
name: testing-strategy
description: Canonical testing taxonomy, runtime-lane selection, evidence requirements, and TDD rules across Python, Rhino/GH, TypeScript/MCP, DAX, and Power BI.
---

# Testing Strategy: Antigravity Verification

Decides the cheapest valid test lane that proves a claim, and the evidence required before
calling work complete.

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

## 2. Runtime Lanes

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

## 3. Evidence Rules

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

## 4. TDD Loop & Bug Triage

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

## 5. Mocking Boundaries

Mock external systems, never internal logic. A wrapper/flatten component's mocks must mirror
the real, fully-wrapped response shape (captured from a live probe) — exercise it end-to-end
against real data at least once before trusting its unit-green. Frontend: mock the network
(MSW), never your own components. Rhino/GH: stub `rhinoscriptsyntax`/`scriptcontext`/`Rhino.*`
for import safety in pure tests, use `Rhino.Inside` for real `RhinoCommon` behavior — a stub
never proves manifoldness, intersections, or Brep validity.

## 6. Required Evidence by Project Type

| Project Type | Required Evidence |
| :--- | :--- |
| **code** | unit + integration + lint/typecheck — UI: render tests + `jsx-a11y`/axe + ≥1 E2E on the primary journey |
| **geometry** | unit for pure logic + Rhino E2E for runtime invariants |
| **data** | model validation + manual matrix |
| **pptx** | script test + output file existence + visual spot-check |
| **pbi-report** | DAX checks + layout audit + performance analyzer |
| **manuscript** | rubric audit |
| **youtube** | script/package checklist |
