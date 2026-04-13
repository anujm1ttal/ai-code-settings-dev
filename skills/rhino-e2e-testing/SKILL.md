---
name: rhino-e2e-testing
description: Headless E2E testing for Rhino 8 and Grasshopper using pytest and rhinoinside.
tags: ["rhino", "grasshopper", "testing", "pytest", "rhinoinside"]
---

# Skill: Rhino E2E Testing

## 🏗 Setup & Environment

This skill enables headless testing of geometric logic and Grasshopper definitions using **Rhino.Inside** and **pytest**.

### Prerequisites
- **Rhino 8** installed on the local machine.
- `rhinoinside` Python package: `pip install rhinoinside`
- `pytest` for test execution.
- System environment configured to find Rhino 8 (usually automatic with `rhinoinside.load(8)`).

### Project Layout
~~~
project/
├── src/
│   └── geometry/        # Your logic
├── tests/
│   ├── conftest.py     # Initialization & fixtures
│   ├── e2e/            # High-level geometric tests
│   │   └── test_stadium.py
│   └── unit/           # Low-level component tests
├── pytest.ini          # Pytest configuration
└── requirements.txt
~~~

## 📡 Headless Initialization

Always load Rhino in a session-scoped `conftest.py` fixture to avoid the massive overhead of re-loading the runtime for every test.

### conftest.py
~~~python
import pytest
import rhinoinside

@pytest.fixture(scope="session", autouse=True)
def rhino_session():
    """Load Rhino 8 runtime once for the entire test session."""
    try:
        rhinoinside.load(8)
        import Rhino  # noqa: F401
        import Grasshopper # noqa: F401
    except Exception as e:
        pytest.exit(f"Failed to load Rhino 8: {e}")
    yield
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

To test a `.gh` definition, use the `GH_DocumentIO` API to load, solve, and extract data.

~~~python
import Grasshopper as gh

def run_headless_gh(file_path, inputs=None):
    io = gh.Kernel.GH_DocumentIO()
    if not io.Open(file_path):
        raise FileNotFoundError(f"Could not open {file_path}")
    
    doc = io.Document
    
    # Optional: Set inputs
    if inputs:
        for name, value in inputs.items():
            param = doc.FindParameter(name)
            if param:
                param.PersistentData.Clear()
                # Use appropriate GH wrapper (GH_Number, GH_Point, etc.)
                
    doc.NewSolution(True) # Force solver
    
    # Extract results from output parameters
    results = {}
    # ... extraction logic ...
    return results
~~~

## 🚫 Ground-Truth Gates (E2E First)

1. **Geometry Task**: If the task involves complex geometry (C-Values, intersections, manifoldness), you MUST write a failing E2E test in `tests/e2e/` before implementing the fix.
2. **Regression Check**: Every new geometric feature must include an assertion for its primary invariant (e.g., "Resulting Brep must be closed").

## 🔧 Troubleshooting

- **DLL Collisions**: Common if multiple versions of Rhino are installed. Use `rhinoinside.load(8)` explicitly.
- **Missing Plugins**: Headless Rhino does not load all GH plugins by default. You may need to call `gh.Instances.ComponentServer.AddExternalObject()` manually in `conftest.py`.
- **License**: Rhino.Inside consumes a license just like a GUI session. Ensure your license server/Cloud Zoo is accessible.
