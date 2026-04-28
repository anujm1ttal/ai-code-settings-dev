---
name: rhino-unit-testing
description: Lane B protocol — Pure Python testing of geometry-agnostic logic without booting Rhino runtime.
tags: ["rhino", "testing", "pytest", "unit-testing", "mocking", "lane-b"]
auto_activate: false
argument-hint: "<logic module to test>"
metadata:
  version: "1.0.0"
---

# Skill: Rhino Unit Testing (Lane B)

## 🏎 The Lane B Protocol
Use this skill to test the **computational logic** of Rhino scripts without the overhead of `rhinoinside` or a Rhino license. Lane B tests are significantly faster and should constitute the majority of the test suite.

### When to use Lane B:
- Validating bay math, seating counts, or brief parameters.
- Testing predicates (e.g., `is_valid_rake()`).
- Verifying data transformation logic (e.g., JSON → Seating Config).
- Testing any logic that doesn't strictly require `Rhino.Geometry` (rg) objects.

## 🏗 Mocking Rhino.Geometry (rg)
If a function requires an `rg` object (like a `Point3d`) but only uses its properties (like `.X`, `.Y`), mock it using `unittest.mock` or simple `dataclasses`.

### Mocking Pattern
~~~python
from unittest.mock import MagicMock

def test_rake_calculation():
    # Mocking rg.Point3d behavior
    mock_point = MagicMock()
    mock_point.X = 10.0
    mock_point.Y = 5.0
    
    result = calculate_something(mock_point)
    assert result == 15.0
~~~

## 🚥 Isolating Lanes
Use the `@pytest.mark.rhino` marker to distinguish tests that *must* run in Lane A (full Rhino).

### pytest.ini Configuration
~~~ini
[pytest]
markers =
    rhino: tests that require a live Rhino instance (Lane A).
~~~

### Running Lanes
- **Run Lane B only (Fast)**: `pytest -m "not rhino"`
- **Run Lane A only (Rigor)**: `pytest -m rhino`
- **Run all**: `pytest`

## 📁 Directory Split
Maintain clear separation between logic and geometry-heavy code:
~~~
src/
├── core_logic.py          # Lane B compatible
└── geometry_bridge.py     # Lane A required
tests/
├── unit/                  # Fast Lane B tests
└── e2e/                   # Rigorous Lane A tests (marked @pytest.mark.rhino)
~~~

## 📜 Rules
1. **Mock boundaries, not internals**: If a function calls `rg.Intersect.LinePlane`, don't mock it — that belongs in Lane A. If it uses `rg.Point3d.X`, mock it in Lane B.
2. **Logic Extraction**: If a geometric function is too complex to test, extract its pure-math component into a Lane B compatible function in `src/`.
3. **No License in B**: Lane B tests must NEVER call `rhinoinside.load()`.
4. **Fast Feedback**: Lane B tests should run in <100ms.
