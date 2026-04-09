---
name: python-rhino-grasshopper
description: Expert in RhinoCommon API, GhPython, and computational design scripting. Covers geometry standards, data trees, performance scaling, testing, and platform constraints.
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

## 📖 API Reference Lookups

For deep-dives into specific RhinoCommon classes, methods, or properties, use the offline documentation provided in the skill resources.

- **Files**:
  - `skills/python-rhino/resources/RhinoCommon.xml`
  - `skills/python-rhino/resources/Grasshopper.xml`
  - `skills/python-rhino/resources/GH_IO.XML`
- **Retrieval Method**: Use `grep_search` with `MatchPerLine: true`. These files are highly efficient for line-based searching; lookups typically resolve in <5 seconds.

### Example Lookup Patterns:
1. **RhinoCommon**:
   - `grep_search(Query="member name=\"M:Rhino.Geometry.Mesh.CreateFromBrep", SearchPath="skills/python-rhino/resources/RhinoCommon.xml", MatchPerLine=true)`
2. **Grasshopper**:
   - `grep_search(Query="member name=\"M:Grasshopper.DataTree", SearchPath="skills/python-rhino/resources/Grasshopper.xml", MatchPerLine=true)`
3. **GH_IO**:
   - `grep_search(Query="member name=\"T:GH_IO.Serialization.GH_Archive", SearchPath="skills/python-rhino/resources/GH_IO.XML", MatchPerLine=true)`

> [!TIP]
> Use this as the "ground truth" when you need to verify exact API signatures that may be missing from your internal training data.

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

## 🧪 Testing with rhinoinside + pytest

### Overview
**`rhinoinside`** loads the Rhino runtime inside CPython, enabling standard `pytest` execution without the Rhino UI. This is the recommended approach for testing Rhino/Grasshopper logic outside the editor.

- **Best option**: `rhinoinside` — full RhinoCommon API available in headless CPython.
- **Alternatives**: `rhino3dm` (geometry-only, no full RhinoCommon), `compute.rhino3d` (server-based), `ghpythonremote` (community).
- **Reference implementation**: Ladybug Tools — best real-world example of this pattern.

### Project Structure

~~~
project/
├── src/
│   └── geometry_utils.py      # Testable Rhino logic
├── tests/
│   ├── conftest.py            # rhinoinside session-scoped fixture
│   ├── test_geometry_utils.py # Tests using RhinoCommon via rhinoinside
│   └── pytest.ini             # Pytest config
└── requirements-dev.txt       # rhinoinside, pytest, Rhino-stubs
~~~

### conftest.py Pattern

~~~python
import pytest

@pytest.fixture(scope="session", autouse=True)
def rhino_setup():
    """Load Rhino runtime once for the entire test session."""
    import rhinoinside
    rhinoinside.load()
    import Rhino  # noqa: F401 — available after load()
    yield
~~~

### Key Testing Patterns
- **Session-scoped loading**: `rhinoinside.load()` is expensive — load once per session, not per test.
- **Reusable geometry fixtures**: Create shared `Point3d`, `Curve`, `Brep` fixtures for common test inputs.
- **Float comparison**: Use `pytest.approx` for all geometric value assertions (distances, areas, volumes).
- **Parametrize**: Use `@pytest.mark.parametrize` for multi-input geometric validation.
- **Class-based grouping**: Group related tests by geometric domain (`TestSightlines`, `TestMeshOps`, etc.).

### pytest.ini

~~~ini
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    slow: marks tests as slow (e.g., full model generation)
    rhino: marks tests requiring rhinoinside
~~~

## 🔤 Stubs for Autocomplete

- **Package**: `pip install Rhino-stubs` — official McNeel package from `mcneel/pythonstubs`.
- **Coverage**: Provides `.pyi` stubs for `RhinoCommon`, `Grasshopper`, `GH_IO`, `GH_Util`.
- **Rhino 7**: PyPI version is pinned to Rhino 7.
- **Rhino 8**: Clone the repo directly (`github.com/mcneel/pythonstubs`) for Rhino 8 coverage — PyPI lags behind.
- **Usage**: Install into your dev environment for IDE autocomplete and type checking. Does NOT affect runtime.

## 🚫 Anti-Patterns
- ❌ `rhinoscriptsyntax` for dimension/annotation styles
- ❌ `DimStyles.Add(style_object)` — expects string
- ❌ `DimensionStyle.LeaderContentAngleType.Horizontal` — use int `1`
- ❌ `str | None` syntax — use `Optional[str]`
- ❌ `logging.basicConfig()` without explicit file target
- ❌ Testing Rhino logic only inside the GH canvas — use `rhinoinside` + `pytest` for headless CI
- ❌ Loading `rhinoinside` per-test instead of session-scoped — causes massive slowdown
- ❌ Exact float equality in geometry assertions — use `pytest.approx`