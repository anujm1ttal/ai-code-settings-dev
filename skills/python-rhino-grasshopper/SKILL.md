---
name: python-rhino-grasshopper
description: Expert in RhinoCommon API, GhPython, and computational design scripting for Rhino 8. Mandates the use of 'Rhino.Geometry' and high-rigor patterns. USE THIS SKILL whenever a user asks to create, modify, or debug geometry, data trees, or Grasshopper components, even if they don't explicitly mention 'Rhino'.
tags: ["rhino", "grasshopper", "computational-design", "python"]
verbosity_control: "STRICT. Focus on API syntax and geometric constraints. No introductory text."
---

# Skill: Python for Rhino & Grasshopper

## 📜 Scripting Standards
- **Shebang**: EVERY Python script MUST begin with `#! python 3` as the first line to ensure the Rhino 8 CPython engine is targeted.

## 📐 Geometric Standards
- **API Choice**: Prioritize `Rhino.Geometry` (RhinoCommon). Use `rhinoscriptsyntax` only for simple document-level tasks (layer management, object selection).
- **Precision**: Never hardcode tolerances. Use `Rhino.RhinoDoc.ActiveDoc.ModelAbsoluteTolerance`.
- **Vectors**: Always `.Unitize()` vectors before translation/projection to ensure predictable magnitudes.
- **Immutability**: Return new geometry instances from transformations. Never modify `RhinoDoc` objects until the final "Bake" step. See `coding-style.md`.
- **Units**: Validate model units at script entry. If the script assumes millimeters, assert it: `assert doc.ModelUnitSystem == Rhino.UnitSystem.Millimeters`.

## 🌳 Data Tree Logic
- **Structure**: Use `Grasshopper.DataTree[object]()` for multi-dimensional outputs.
- **Paths**: Define explicit paths using `GH_Path(i, j)`. Never rely on implicit path inheritance.
- **Efficiency**: Avoid `tree.Flatten()` inside loops; maintain path hierarchy for downstream Grasshopper components.
- **Debugging**: When data tree output is unexpected, log `tree.BranchCount`, `tree.PathCount`, and a sample of `tree.Path(0)` to identify structural issues.
- **Convention**: Match branch structure to the geometric hierarchy of the domain. Define a consistent path-level mapping per project and document it in `config.py`.

## 🏎 Performance & Scaling

### Memory Management
- **Dispose Pattern**: Dispose heavy geometry objects (`Mesh`, `Brep`, `Surface`) in large loops. Use `try/finally` to guarantee cleanup.
  - **Why?**: RhinoCommon objects are wrappers around unmanaged C++ objects; failing to `.Dispose()` in loops causes memory leaks and eventually crashes Rhino.
  - `mesh.Dispose()` after extracting required data (vertices, normals).
  - Never hold references to disposed geometry — extract values first, then dispose.
- **Lazy Evaluation**: For large models, generate geometry on-demand per section rather than all-at-once.
- **Lightweight Proxies**: Use `Point3d` or `BoundingBox` as stand-ins during analysis phases. Generate full geometry only for final output.

### Computation Optimization
- **BoundingBox Culling**: Before performing expensive intersections (`Mesh.Intersect`, `Brep.ClosestPoint`), cull candidates using `BoundingBox.Contains` or `BoundingBox.IsDegenerate`.
- **Spatial Indexing**: For proximity queries across large point sets, use `RTree` (`Rhino.Geometry.RTree`) instead of brute-force distance loops.
- **Batch Operations**: Prefer `Mesh.CreateFromBrep()` on arrays over individual conversions in loops.
- **Parallel Processing**: Use `System.Threading.Tasks.Parallel.ForEach` for independent calculations. Guard shared state with locks.
  - Safe to parallelize: Independent per-group geometry generation, per-element analysis.
  - NOT safe to parallelize: Operations that write to `RhinoDoc`, data tree construction.

### Grasshopper-Specific Performance
- **Component Weight**: Keep GhPython components as thin wrappers (< 50 lines). Heavy logic lives in external `.py` modules imported via `sys.path`.
- **Caching**: Use Grasshopper's built-in caching. Set `ExpireSolution` strategically — don't trigger full recompute for parameter changes that only affect one group.
- **Data Tree Size**: If a single branch exceeds 10,000 items, consider splitting into sub-branches or streaming output.
- **Profiling**: Use `System.Diagnostics.Stopwatch` to time critical sections. Log results for the `auditor` to evaluate.

## 🔌 External Module Pattern

### Structure
Heavy logic extracted from GH components into importable modules:

~~~
project_name/
├── domain_a/
│   ├── __init__.py
│   ├── core_logic.py
│   ├── helpers.py
│   └── validation.py
├── domain_b/
│   ├── __init__.py
│   ├── profile.py
│   └── constraints.py
├── geometry/
│   ├── __init__.py
│   ├── proxies.py
│   └── culling.py
└── config.py               # Constants and project-specific settings
~~~

### GhPython Wrapper Pattern
The GH component imports and calls the external module:
- Import: `sys.path.append(r"path/to/project_name"); from domain_a.core_logic import compute`
- Input: Receive raw GH inputs (points, curves, parameters).
- Transform: Convert GH types to RhinoCommon types if needed.
- Delegate: Call the external module function.
- Output: Return results to GH outputs (geometry, data trees, values).

## 📖 API Reference Lookups (MANDATORY GATE)

> [!IMPORTANT]
> **Ground-Truth Requirement**: You are FORBIDDEN from making "best guess" API calls in the `Rhino.Geometry` or `Grasshopper` namespaces if they are not already used correctly in the current workspace.
> 
> **Why?**: LLMs frequently hallucinate properties (e.g., `.BoundingBox` vs `.GetBoundingBox()`) due to the massive API surface of RhinoCommon. This gate ensures your code matches the exact signature installed on the user's machine.
> 
> **Lookup Protocol**:
> 1.  **Identify**: Note the specific class and member you intend to use.
> 2.  **Verify**: Execute `grep_search` on the XML resources below to confirm the exact signature (Method vs. Property, required arguments).
> 3.  **Cross-Check**: If the XML shows a `M:` prefix, it is a **Method** (requires `()`). If it shows `P:`, it is a **Property**.
> 
> Failure to perform this lookup for new API surface areas will result in a mandatory `auditor` failure.

- **Files**:
  - `skills/python-rhino-grasshopper/resources/RhinoCommon.xml`
  - `skills/python-rhino-grasshopper/resources/Grasshopper.xml`
  - `skills/python-rhino-grasshopper/resources/GH_IO.XML`
- **Retrieval Method**: Use `grep_search` with `MatchPerLine: true`. These files are highly efficient for line-based searching; lookups typically resolve in <5 seconds.

### Example Lookup Patterns:
1. **RhinoCommon**:
   - `grep_search(Query="member name=\"M:Rhino.Geometry.Mesh.CreateFromBrep", SearchPath="skills/python-rhino-grasshopper/resources/RhinoCommon.xml", MatchPerLine=true)`
2. **Grasshopper**:
   - `grep_search(Query="member name=\"M:Grasshopper.DataTree", SearchPath="skills/python-rhino-grasshopper/resources/Grasshopper.xml", MatchPerLine=true)`
3. **GH_IO**:
   - `grep_search(Query="member name=\"T:GH_IO.Serialization.GH_Archive", SearchPath="skills/python-rhino-grasshopper/resources/GH_IO.XML", MatchPerLine=true)`

## 🔧 Common Pitfalls

| Pitfall | Symptom | Fix |
| :--- | :--- | :--- |
| Hardcoded tolerance | Geometry joins fail in different models | Use `doc.ModelAbsoluteTolerance` |
| Flatten in loop | Exponential slowdown on large models | Maintain path hierarchy, flatten only at final output |
| Non-unitized vectors | Unpredictable translation magnitudes | `.Unitize()` before every transform |
| Undisposed meshes | Memory leak, GH freeze on large models | `try/finally` dispose pattern |
| Single-threaded groups | Large models take 10+ minutes | `Parallel.ForEach` on independent groups |
| Fat GH component | Impossible to debug, test, or reuse | Extract to external module, keep GH as thin wrapper |

## 📋 Code Review Checklist
- [ ] Starts with `#! python 3` as the first line?
- [ ] Uses RhinoCommon (`Rhino.Geometry`) over `rhinoscriptsyntax`?
- [ ] Handles Data Trees correctly without "Path Hell"?
- [ ] References document tolerance, not hardcoded values?
- [ ] Disposes heavy geometry objects in large loops?
- [ ] Unit system validated at script entry?
- [ ] External module pattern used for logic > 50 lines?
- [ ] BoundingBox culling before expensive intersections?
- [ ] `Parallel.ForEach` considered for independent work?
- [ ] Constants defined in `config.py`, not inline?
- [ ] `rhinoinside` + `pytest` test coverage for core geometry logic?
- [ ] `Rhino-stubs` installed for IDE autocomplete?

## ⚠ Pitfalls & Platform Constraints

### Type Hints
- NO union syntax (`str | None`) — Rhino Python targets <3.10
- USE `Optional[str]` from `typing`

### DimStyles API
- `rs.IsTextStyle()` / `rs.CreateTextStyle()` DO NOT EXIST
- Use `sc.doc.DimStyles` directly:
  - `doc.DimStyles.Add("Name")` — string, NOT object
  - Flow: Add by name → retrieve by index → set props → Commit via `Modify()`

### .NET Enums
- Nested enum paths often fail to resolve
- Use raw integers: `dim_style.LeaderContentAngleStyle = 1`
- Document magic numbers in comments

### Logging
- `logging.basicConfig()` output is swallowed — use `print()`
- File logging works if you set `filename=` explicitly

### Script Editor
- Command-line options render in Rhino viewport, not editor
- Rhino 8: `ScriptEditor` command; run with F5

## 🧪 Testing & E2E Validation

### Overview
All geometric and Grasshopper logic must be validated using headless CI patterns. This ensures that refactors don't break complex geometric invariants (closure, tolerances, manifoldness).

- **Source of Truth**: Refer to the **[rhino-e2e-testing](file:///c:/Users/44547/source/repos/ai-code-settings/skills/rhino-e2e-testing/SKILL.md)** skill for:
  - `conftest.py` initialization patterns for Rhino 8.
  - `GHHeadlessRunner` utility for executing `.gh` files.
  - `geometry_assertions` library for high-rigor validation.

### Key Testing Principles
- **Session-scoped loading**: `rhinoinside.load()` is expensive — load once per session.
- **Reusable geometry fixtures**: Create shared `Point3d`, `Curve`, `Brep` fixtures for common inputs.
- **Float comparison**: Use `pytest.approx` for all geometric value assertions (distances, areas, volumes).
~~~

## 🔤 Stubs for Autocomplete

- **Package**: `pip install Rhino-stubs` — official McNeel package from `mcneel/pythonstubs`.
- **Coverage**: Provides `.pyi` stubs for `RhinoCommon`, `Grasshopper`, `GH_IO`, `GH_Util`.
- **Rhino 7**: PyPI version is pinned to Rhino 7.
- **Rhino 8**: Clone the repo directly (`github.com/mcneel/pythonstubs`) for Rhino 8 coverage — PyPI lags behind.
- **Usage**: Install into your dev environment for IDE autocomplete and type checking. Does NOT affect runtime.

## 🚫 Common API Hallucinations (DENY LIST)

| Hallucination | Reality | Context |
| :--- | :--- | :--- |
| `obj.BoundingBox` | `obj.GetBoundingBox(True)` | Methods inherited from `GeometryBase` (Curves, Breps) |
| `rs.CreateTextStyle()` | Does NOT exist | Use `sc.doc.DimStyles.Add(name)` |
| `GH_Path(i)` | `GH_Path(i, j)` | Always use explicit multi-D paths for DataTrees |
| `doc.DimStyles.Add(obj)` | `doc.DimStyles.Add(string)` | Method only accepts a unique name string |
| `rs.IsTextStyle()` | Does NOT exist | Check `sc.doc.DimStyles.FindName(name)` |

## 🚫 Anti-Patterns
- ❌ `rhinoscriptsyntax` for dimension/annotation styles
- ❌ `DimStyles.Add(style_object)` — expects string
- ❌ `DimensionStyle.LeaderContentAngleType.Horizontal` — use int `1`
- ❌ `str | None` syntax — use `Optional[str]`
- ❌ `logging.basicConfig()` without explicit file target
- ❌ Testing Rhino logic only inside the GH canvas — use `rhinoinside` + `pytest` for headless CI
- ❌ Loading `rhinoinside` per-test instead of session-scoped — causes massive slowdown
- ❌ Exact float equality in geometry assertions — use `pytest.approx`