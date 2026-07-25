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
| **Lane A-live** | Scriptable checks needing plugins/document state headless can't load | Yes, running instance via `rhinocode` CLI (8.11+, `StartScriptServer`) |
| **Lane A-full** | Interactive UI, dialogs, manual picks | Yes, Rhino UI (manual) |

**Default Rule**: Use the cheapest lane that proves the claim. Lane order: B → A-headless → A-live → A-full.

## 3. Evidence Rules

Evidence is the currency of the **Verification Gate**.
- **Freshness**: Test command must be fresh.
- **Artifact-backed [HARD-GATE]**: Any command output backing a claim a verifier must check is redirected to a file and cited by **path** — `<command> > Artifacts/Temp/<phase>_<step>_<command>.txt 2>&1`. The file is the evidence; chat prose only points at it. Applies at **every** rigor tier (`orchestration.md` §Execution Cadence owns the no-artifact-no-PASS rule and the MTP exemption).
- **Completeness**: The artifact carries full output including exit code. A chat summary is a *pointer* to the artifact, never a substitute for it — a verifier that read only the summary has verified nothing.
- **Retention**: Evidence cited by a durable record is promoted out of `Artifacts/Temp/` and committed — see `orchestration.md` §Evidence Retention. Uncited evidence is purged with `Temp/`.
- **Assertion Mode**: "Should pass" is forbidden; "Passed with exit code 0" is required.
- **Entry-Point Coverage**: Evidence for a user-facing capability MUST be produced by exercising the outermost entry point that capability ships behind (HTTP route, CLI command, tool call), not an internal function it delegates to. A gate that calls the function beneath the entry point certifies a path no user can reach. **Corollary**: count route/command coverage separately from unit coverage — entry points with zero test coverage are where defects ship.
- **Oracle Discipline**: Every absence-proof MUST carry a presence-control proving the probe can see what it claims is missing — absence of evidence is not evidence of absence. Read the actual type/struct before asserting on its fields; a mistyped field yields a silent false negative, not an error. An oracle must encode the CONTRACT, not a surface pattern. Recount any asserted ratio before publishing it.
- **Asymmetry Rules**:
  - E2E evidence cannot substitute for unit evidence when pure logic changed.
  - Unit evidence cannot substitute for E2E evidence when Rhino geometry behavior changed.

## 4. TDD Loop & Bug Triage

The RED-GREEN-REFACTOR cycle itself is owned by the `test-driven-development` skill — see that
skill for the mandatory loop. This section covers bug-triage concerns specific to testing strategy
(lane selection for the failing test is per §2 above).

### Deferred Defects: Strict Xfail
Encode every known-but-deferred defect as an executable marker asserting the **correct** behavior that currently fails:

```python
@pytest.mark.xfail(strict=True, reason="<defect> — fix scheduled Phase N")
```

- **Why**: The defect list is enforced, not prose. A silent fix triggers XPASS and fails the build, forcing deliberate marker removal — the documentation cannot rot.
- **Rules**: Reproduce the defect before encoding it (never xfail an unconfirmed defect). Cite the fixing phase in `reason`. The auditor counts remaining xfails against the deferred-defect list at each phase gate.
- **Green-baseline / hygiene / migration phases**: When a test-only phase carries both a "go green" goal AND a "no production changes" constraint, encode any production defect it *discovers* as `xfail(strict=True)` — never weaken/delete the test or fix production out of scope. This satisfies both pulls at once: the baseline goes green while the bug stays loud (a later silent production fix triggers XPASS and fails the build).

### Inherited Triage Is a Hypothesis
"Bend the failing test to the maintained production contract" assumes the contract is correct — but the contract is *unverified* until you run production. Before matching a failing test to current production, probe actual production behavior (a throwaway probe script). Mechanically matching tests to production encodes production bugs as expected behavior. (Evidence: 5 of 13 "rotten" inherited tests were correct tests catching real production bugs; only a runtime probe distinguished rot from a real defect.)

## 5. Mocking Boundaries

- **Rule**: Mock external systems; do not mock internal logic.
- **Wrapper/Flatten Tools**: When a component's job is to transform, unwrap, or flatten another component's output, its mocks MUST mirror the real, fully-wrapped response shape (capture it from a live probe). The component MUST be exercised end-to-end against real data at least once before its unit-green is trusted. A degenerate/empty live result is a mock-vs-real envelope mismatch until proven otherwise.
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
