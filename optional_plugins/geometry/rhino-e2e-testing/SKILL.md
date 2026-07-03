---
name: rhino-e2e-testing
description: Use this skill whenever you are performing rigorous, headless end-to-end testing of RhinoCommon geometry, Grasshopper definitions, or plugin state using Rhino.Inside and pytest. It implements the "Lane A protocol" for verifying geometric invariants like manifoldness, intersections, and tolerance-aware comparisons. Trigger when you are fixing a geometric bug, adding a new Grasshopper component, or verifying a complex Brep operation. Do NOT use for geometry-agnostic logic that can be tested in pure Python (Lane B); use rhino-unit-testing instead.
tags: ["rhino", "grasshopper", "testing", "pytest", "rhinoinside", "e2e"]
auto_activate: false
argument-hint: "[--run-tests|--setup-reproduction]"
metadata:
  version: "1.0.1"
---


# Skill: Rhino E2E Testing

## 🏗 Setup & Environment

## 🗺 Testing Lane Decision Tree

```text
DOES THE TEST REQUIRE GEOMETRIC INVARIANTS?
(Manifoldness, Brep.Split, Mesh.Intersection, GH.Canvas)
│
├── [NO] ───────────────────> USE LANE B (rhino-unit-testing)
│                             Fast, pure Python, no Rhino runtime.
│
├── [YES]
│    │
│    ├── TYPE: Core Logic / Algorithms
│    │   └── [ACTION]: USE LANE A-HEADLESS (pytest + rhinoinside).
│    │                 Best for CI/CD and rapid iteration.
│    │
│    └── TYPE: UI / Canvas / Plugin Interaction
│        └── [ACTION]: USE LANE A-FULL (Manual in Rhino UI).
│                      Use when headless mode cannot load specialized plugins.
```

### Prerequisites
- **Rhino 8** installed on the local machine.
- `rhinoinside` Python package: `pip install rhinoinside`
- `pytest` for test execution.
- `pytest` for test execution.
- System environment configured to find Rhino 8 (usually automatic with `rhinoinside.load(8)`).

### 🐍 Dialect Awareness (CRITICAL)
Note the version mismatch between your test environment and the code being tested:
- **Host / Test Python (3.12+)**: Full support for `list[T]`, `T | None`, Pydantic, and loguru.
- **Internal Rhino Python (~3.9)**: Code running inside Rhino or exported to GH components is restricted.
  - Use `from typing import List, Optional`.
  - No union pipe (`|`) syntax.
  - Manual validation (no Pydantic).
  - Use `print()` only (no loguru inside GH).
*Test files should be written in 3.12, but source modules intended for GH must remain 3.9-compatible.*

### Project Layout
~~~
project/
├── src/
│   └── geometry_utils.py       # Core logic (no GH dependency)
├── tests/
│   ├── conftest.py             # rhinoinside loaded once here
│   ├── unit/                   # Fast Lane B tests (see rhino-unit-testing)
│   ├── e2e/                    # Rigorous Lane A tests (marked @pytest.mark.rhino)
│   └── test_data/              # Optional .3dm, .json fixtures
├── pytest.ini                  # markers defined here
└── requirements.txt
~~~

## 📡 Headless Initialization

Always load Rhino in a session-scoped `conftest.py` fixture to avoid the massive overhead of re-loading the runtime for every test.

### conftest.py Pattern
~~~python
import pytest
import rhinoinside
rhinoinside.load(8)

import Rhino # noqa: E402
import Rhino.Geometry as rg # noqa: E402

@pytest.fixture(scope="session")
def rhino():
    return Rhino

@pytest.fixture(scope="session")
def rg_module():
    return Rhino.Geometry
~~~

## 📏 Geometric Assertions

Use the `geometry_assertions` library to verify geometric invariants. Never use `==` for geometric values; always use `pytest.approx` or tolerance-based helpers.

### Core Helpers
| Helper | Description |
| :--- | :--- |
| `assert_is_closed(geometry)` | Ensures Breps or Meshes are airtight. |
| `assert_is_manifold(mesh)` | Validates mesh topology. |
| `assert_near(a, b, tol)` | Tolerance-aware comparison for Points/Vectors/Floats. |
| `assert_intersect(a, b)` | Verifies that two geometries intersect. |

## 🦗 Headless Grasshopper Runner

To test a `.gh` definition, use the `GH_DocumentIO` API to load, solve, and extract data. Keep components as thin wrappers that call into tested source modules.

## 📜 Key Rules
1. **Load First**: `rhinoinside.load(8)` must be called BEFORE any Rhino imports.
2. **Session Scope**: Use `scope="session"` on fixtures — loading Rhino takes 2-3 seconds; do it once.
3. **Linter Gates**: All Rhino imports use `# noqa: E402` if they appear after `rhinoinside.load()`.
4. **Float Accuracy**: Use `pytest.approx` for all floating point comparisons with geometry.
5. **Thin Wrappers**: Separate core logic into pure Python modules under `src/`. GH components should only handle I/O.
6. **1:1 Mapping**: Test files map 1:1 to source files: `src/utils.py` -> `tests/e2e/test_utils.py`.
7. **Lane Separation**: Every E2E test file must be decorated with `@pytest.mark.rhino` to avoid being run during Lane B unit testing.

## 🔗 Relationships
- **Lane B**: Use `rhino-unit-testing` for geometry-agnostic logic.
- **Foundations**: Depends on `cd-foundations` for tolerance standards.

## 🧪 Writing a Test File
~~~python
import pytest
import Rhino.Geometry as rg
from src.geometry_utils import my_function

class TestMyFunction:
    def test_basic_case(self, sample_brep):
        result = my_function(sample_brep)
        assert result == pytest.approx(100.0, rel=1e-6)

    @pytest.mark.parametrize("input_val,expected", [(1.0, 10.0), (0.0, 0.0)])
    def test_parametric(self, input_val, expected):
        assert my_function(input_val) == pytest.approx(expected)
~~~

## 💻 Running Tests

Use the standardized runner script. Run with `--help` for options. **Do NOT read the source code.**

```bash
python scripts/run_headless.py tests/e2e --cov=src
```

Standard `pytest` commands are also available:
- `pytest` : Basic run.
- `pytest --cov=src --cov-report=term-missing` : Run with coverage.
- `pytest -s` : Show print output.

## 🚫 Ground-Truth Gates (E2E First)

1. **Geometry Task**: If the task involves complex geometry (C-Values, intersections, manifoldness), you MUST write a failing E2E test in `tests/e2e/` before implementing the fix.
2. **Regression Check**: Every new geometric feature must include an assertion for its primary invariant (e.g., "Resulting Brep must be closed").

## 🔧 Troubleshooting

- **DLL Collisions**: Common if multiple versions of Rhino are installed. Use `rhinoinside.load(8)` explicitly.
- **Missing Plugins**: Headless Rhino does not load all GH plugins by default. You may need to call `gh.Instances.ComponentServer.AddExternalObject()` manually in `conftest.py`.
- **License**: Rhino.Inside consumes a license just like a GUI session. Ensure your license server/Cloud Zoo is accessible.
