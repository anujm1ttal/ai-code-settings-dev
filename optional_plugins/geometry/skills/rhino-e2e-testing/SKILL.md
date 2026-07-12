---
name: rhino-e2e-testing
description: Use this skill whenever you are performing rigorous, headless end-to-end testing of RhinoCommon geometry, Grasshopper definitions, or plugin state using Rhino.Inside and pytest. It implements the "Lane A protocol" for verifying geometric invariants like manifoldness, intersections, and tolerance-aware comparisons. Trigger when you are fixing a geometric bug, adding a new Grasshopper component, or verifying a complex Brep operation. Do NOT use for geometry-agnostic logic that can be tested in pure Python (Lane B); use rhino-unit-testing instead.
argument-hint: "[--run-tests|--setup-reproduction]"
metadata:
  version: "1.2.0"
  tags: ["rhino", "grasshopper", "testing", "pytest", "rhinoinside", "rhinocode", "e2e"]
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
│        │
│        ├── SCRIPTABLE (no dialogs, no manual picks)?
│        │   └── [ACTION]: USE LANE A-LIVE (rhinocode CLI → running Rhino).
│        │                 Drives a full Rhino session with all plugins loaded.
│        │                 Use when headless cannot load specialized plugins.
│        │
│        └── [ACTION]: USE LANE A-FULL (Manual in Rhino UI).
│                      Last resort: requires human interaction.
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

## 🎛 Lane A-live: `rhinocode` CLI (Rhino 8.11+)

The `rhinocode` CLI drives a **live, fully-loaded Rhino session** from the terminal. It fills the gap between Lane A-headless (no specialized plugins) and Lane A-full (manual, no evidence trail): the agent writes a probe script, executes it inside the running Rhino instance, and captures real output.

### Prerequisites
- **Rhino 8.11 or later**.
- `rhinocode` on PATH: `%PROGRAMFILES%\Rhino 8\System` (Windows) or `/Applications/Rhino 8.app/Contents/Resources/bin` (macOS).
- The user runs `StartScriptServer` once inside Rhino — the CLI talks to this script server. **Semi-attended**: Rhino must be open; not a substitute for headless in unattended CI.

### Subcommands
| Command | Purpose |
| :--- | :--- |
| `rhinocode list --json` | List running Rhino instances (PID, ID, open docs) — verify the target before executing. |
| `rhinocode script <path.py>` | Run a Python/C# script inside the live instance (all plugins + document state available). |
| `rhinocode command "_circle 0 0 0 20"` | Execute a Rhino command remotely — smoke tests, repro setup. |
| `rhinocode project build <path.rhproj>` | Compile a `.rhproj` into a `.yak` package — no running Rhino required; CI-friendly. |

Target a specific instance with `--rhino <id>` when multiple are open.

### Bringing packages into the in-process script (`# venv:` / `# r:`)

`rhinocode script` runs inside Rhino's **embedded** interpreter — by default it sees only stdlib + live RhinoCommon, **not** your repo's `.venv`. To run `pytest` (or any pip package) in-process, the script's header declares its environment. Two mechanisms, in preference order:

| Directive | Use when | Behaviour |
|:---|:---|:---|
| `# venv: <name>` + `# r: <pkg>` | **Default** — RhinoCode-managed env. | Auto-creates `site-envs/<name>-<id>` **inside the py39-rh8 runtime dir** and pip-installs the `# r:` packages on first run (first on `sys.path`). Python auto-matches Rhino's 3.9 — no version trap. Documented mechanism. |
| `# env: <abs path to site-packages>` | **External env only** — you must target site-packages you already have. | Puts that directory on `sys.path` as-is; you own the version match. Escape hatch, not the standard. |

```python
#! python 3
# venv: rhino-test
# r: pytest
```

**Version trap (this one bites):** Rhino 8's embedded Python is **3.9.10**. Pointing `# env:` at a 3.11 `.venv` yields a `pytest` whose 3.9 deps are absent — e.g. `ModuleNotFoundError: No module named 'exceptiongroup'` (stdlib in 3.11, so the venv never pip-installed it). `# venv:`/`# r:` sidesteps this by provisioning against py39-rh8 directly; with `# env:` you must supply a **3.9** site-packages. One shared interpreter per Rhino instance → pin versions in `# r:`.

**Async gotcha (repeats the exit-0 rule below):** `rhinocode script` returns **exit 0 before the script finishes**. The script must flush incrementally to a file and write a terminal **sentinel line**; the caller polls that file for the sentinel before reading results. Always pass an **absolute** script path — a relative path silently runs nothing.

Source: [Rhino pyvenvs guide](https://developer.rhino3d.com/guides/scripting/advanced-pyvenvs/) — `# venv:`/`# r:` are the documented directives; `# env:` is undocumented and reserved for external environments.

### Evidence Protocol
Redirect all Lane A-live output to `Artifacts/Temp/` like any other verification command:

```bash
rhinocode list --json > Artifacts/Temp/<phase>_<step>_rhinocode_list.txt 2>&1
rhinocode script probes/check_plugin_state.py > Artifacts/Temp/<phase>_<step>_rhinocode_probe.txt 2>&1
```

### Key Rules
1. **Dialect**: Scripts run in Rhino's embedded CPython (~3.9) — all Rhino-internal dialect rules apply (`typing.List`, no `|` unions, `print()` only).
2. **Not a pytest replacement**: Lane A-headless keeps fixtures, markers, coverage, and clean exit codes. `rhinocode script` is a coarser run-a-script channel — use it only when headless cannot prove the claim.
3. **Verify the target**: Run `rhinocode list` before `script`/`command` to confirm the intended instance and document are active.
4. **Environment via header, not `pip`**: To use `pytest`/pip packages in-process, declare `# venv: <name>` + `# r: <pkg>` (default) — never `# env:` unless deliberately targeting an existing external, Python-3.9-matched site-packages. See *Bringing packages into the in-process script* above.

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
- **Missing Plugins**: Headless Rhino does not load all GH plugins by default. You may need to call `gh.Instances.ComponentServer.AddExternalObject()` manually in `conftest.py` — or escalate to Lane A-live (`rhinocode`), where the full plugin set is already loaded.
- **License**: Rhino.Inside consumes a license just like a GUI session. Ensure your license server/Cloud Zoo is accessible.
