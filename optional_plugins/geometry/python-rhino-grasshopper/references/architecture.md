# Rhino Software Architecture

> Load this on-demand when designing new systems, extracting logic from GhPython, or setting up project structures.

## 🔌 The External Module Pattern

Heavy logic MUST be extracted from Grasshopper (GH) components into importable `.py` modules. This ensures testability and prevents "Dark Code".

### 1. 1:1 Mapping Requirement
Every `.py` module in `src/` MUST have a corresponding `test_*.py` file in `tests/`.

```
project_root/
├── src/                    # Logic modules (Version Controlled)
│   └── domain_a/
│       ├── core_logic.py   # Heavy lifting here
│       └── validation.py
└── tests/                  # Headless E2E tests
    └── test_core_logic.py
```

### 2. The Thin Wrapper Pattern
The GhPython component on the canvas acts ONLY as a delegator.

- **Import**: `sys.path.append(r"path/to/project"); from domain_a.core_logic import compute`
- **Delegate**: Call the external function.
- **Why?**: Logic in the canvas cannot be unit tested, linted, or versioned effectively.

## 🏗 Coding Standards

### Immutability
Return new geometry instances from transformations. Never modify `RhinoDoc` objects directly until the final bake step.

### Script Setup
Every Python script targeting Rhino 8 MUST begin with the CPython 3 shebang:
`#! python 3`

### Precision & Units
- **Absolute Tolerance**: Never hardcode. Use `Rhino.RhinoDoc.ActiveDoc.ModelAbsoluteTolerance`.
- **Unit Assertion**: Validate model units at entry.
  `assert doc.ModelUnitSystem == Rhino.UnitSystem.Millimeters`

## 🧪 Testing Strategy

Refer to the **rhino-e2e-testing** skill for orchestration.
- **Headless Runner**: Use `GHHeadlessRunner` to execute `.gh` files without UI.
- **Approximate Equality**: Use `pytest.approx` for all geometric assertions.
