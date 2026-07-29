---
name: rhino-e2e-testing
description: Use this skill whenever you are performing rigorous, headless end-to-end testing of RhinoCommon geometry, Grasshopper definitions, or plugin state using Rhino.Inside and pytest, OR running any script inside a live Rhino session via the `rhinocode` CLI. It implements the "Lane A protocol" for verifying geometric invariants like manifoldness, intersections, and tolerance-aware comparisons. Trigger when you are fixing a geometric bug, adding a new Grasshopper component, verifying a complex Brep operation, or writing a one-off probe script to inspect a running Rhino instance's document, plugins, or settings — `rhinocode` has two traps (it returns exit 0 before your script finishes, and its stdout never reaches you) that make an unguided probe silently misreport. Do NOT use for geometry-agnostic logic that can be tested in pure Python (Lane B); use rhino-unit-testing instead.
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
| `rhinocode list --json` | List running Rhino instances (PID, ID, open docs) — resolve the target from here (filter `processName == "Rhino"`) before executing. |
| `rhinocode -r <id> script <path.py>` | Run a Python/C# script inside the targeted instance (all plugins + document state available). |
| `rhinocode -r <id> command "_circle 0 0 0 20"` | Execute a Rhino command in the targeted instance — smoke tests, repro setup. |
| `rhinocode project build <path.rhproj>` | Compile a `.rhproj` into a `.yak` package — no running Rhino required, so no `-r`; CI-friendly. |

**Always pass `-r <pipeId>` on `script`/`command`, never bare** (see Key Rule 3). `list` and `project build` are the only subcommands that take no `-r`. There is no `-i` flag; `-r, --rhino <ID>` is the only instance selector.

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

**Async gotcha (repeats the exit-0 rule below):** `rhinocode script` returns **exit 0 before the script finishes**. The script must flush incrementally to a file and write a terminal **sentinel line**; the caller polls that file for the sentinel before reading results.

**Always pass an absolute script path.** A relative path silently runs nothing — the in-process
script's `os.getcwd()` is **`C:\Program Files\Rhino 8\System`** (the Rhino install directory),
*not* the directory you invoked the CLI from, so a relative path is resolved against a location
that does not contain your script. Verified 2026-07-29 against Rhino 8.28: absolute path →
sentinel in 0.76s; identical script by filename with the CLI's cwd set to the script's own
directory → no sentinel in 45s, **exit 0 and empty stdout both times**. That combination —
relative path, exit 0, no output — is indistinguishable from success, which is why this is a
trap rather than an error. The same `cwd` fact applies inside the probe: build every path it
touches from an absolute base, never a relative one.

Source: [Rhino pyvenvs guide](https://developer.rhino3d.com/guides/scripting/advanced-pyvenvs/) — `# venv:`/`# r:` are the documented directives; `# env:` is undocumented and reserved for external environments.

### The two traps, and why a probe must write its own output

`rhinocode script` fails in two ways that **look identical to a script that did nothing**:

| Trap | What you observe | What is actually happening |
|:---|:---|:---|
| **Async return** | exit 0, then an empty/truncated report | Exit 0 means *dispatched*, not *finished*. An immediate read races the script. |
| **No stdout** | the redirect file is empty | `print()` output never travels back to the CLI. It is not lost — it was never sent. |

Together they manufacture a convincing false diagnosis. An instant `cat` of an empty file after
an exit 0 reads exactly like a silent no-op, and the natural "fix" — retry — appears to work,
because dispatching a second invocation burns enough wall-clock for the *first* one to finish
writing. **A retry that fixes it is evidence of the race, not a workaround for it.**

Both remedies are the same one line: **the probe writes its own output to a file and ends with a
terminal sentinel; the caller polls for that sentinel before reading.** Never assert on the
subprocess return code, and never read the report before the sentinel appears.

> [!WARNING]
> Retrying is actively unsafe for a **mutating** probe — the accidental-sleep effect means a
> retry can double-apply a mutation that the first invocation had not yet finished. See
> *Mutating probes* under Key Rules.

### Evidence Protocol
Two different files, and confusing them is the trap above:

```bash
rhinocode list --json > Artifacts/Temp/<phase>_<step>_rhinocode_list.txt 2>&1
# resolve <id> = the pipeId whose processName is "Rhino" from the list above

# This redirect captures DISPATCH STATUS ONLY — it will be empty even on success.
# It is not the probe's output and must never be cited as the probe's evidence.
rhinocode -r <id> script /abs/path/probes/check_plugin_state.py > Artifacts/Temp/<phase>_<step>_rhinocode_dispatch.txt 2>&1

# The probe's REAL evidence is the file the probe itself wrote, read only after its
# sentinel line appears. Cite this path, not the dispatch file.
cat Artifacts/Temp/<phase>_<step>_rhinocode_probe.txt
```

Use `${CLAUDE_PLUGIN_ROOT}/skills/rhino-e2e-testing/resources/probe_harness.py` rather than hand-rolling the flush/sentinel/poll dance.

### Lane A in-process runner (pytest inside live Rhino)

For a full `pytest` suite that must run **inside** a live Rhino instance (real RhinoCommon,
not headless), use `${CLAUDE_PLUGIN_ROOT}/skills/rhino-e2e-testing/resources/in_process_bridge_runner.py` (host-side, folds the run into
your `python -m pytest` gate) paired with `${CLAUDE_PLUGIN_ROOT}/skills/rhino-e2e-testing/resources/in_process_suite_runner.py` (the
in-Rhino script `rhinocode script` invokes). Both are templates — copy in, fill the
`# TODO:` placeholders, keep `REPORT_PATH`/`SENTINEL` identical across the pair.

Four load-bearing gotchas (each documented in the resource docstrings, don't re-derive):
1. **Exit-0-before-done**: the rhinocode exit-0-before-done trap [see the async gotcha above] is why the bridge polls the report file for a terminal sentinel line, never the subprocess return code.
2. **py39-venv provisioning**: `# venv: <name>` + `# r: pytest` header directives in the runner provision a py39-Rhino8-matched venv, sidestepping the version trap of a 3.11+ host `.venv`.
3. **`.venv` sys.modules purge**: the runner purges every cached module whose `__file__` resolves under the host `.venv` before `import pytest`, or the shared RhinoCode interpreter leaks a 3.11 build into the py39 venv.
4. **faulthandler off**: `-p no:faulthandler` — Rhino has no real stderr fileno, so pytest's faulthandler plugin crashes at configure.

Conventions to keep:
- **Skip-guard rule**: skip (`pytest.skip`) only on `ConnectionError`/refused-connection — env absence ≠ regression. Any other exception must propagate; a live-but-broken Rhino fails loud.
- **Marker-gated per-test cleanup**: an autouse fixture that only acts when `request.node.get_closest_marker("<your_marker>")` is set, so non-Lane-A tests pass through untouched; run cleanup before AND after each marked test.
- **Isolated conftest**: the real-RhinoCommon suite (`SUITE_PATH`) lives outside `pytest` `testpaths` with a deliberately empty `conftest.py`, so it never inherits the headless suite's Rhino mocks.

### Key Rules
1. **Dialect**: Scripts run in Rhino's embedded CPython (~3.9) — all Rhino-internal dialect rules apply (`typing.List`, no `|` unions, `print()` only).
2. **Not a pytest replacement**: Lane A-headless keeps fixtures, markers, coverage, and clean exit codes. `rhinocode script` is a coarser run-a-script channel — use it only when headless cannot prove the claim.
3. **Verify the target, always `-r`, never bare**: Resolve the instance from `rhinocode list --json` filtered to `processName == "Rhino"` (non-Rhino pipes like `compute.geometry` also appear with empty `activeDoc` — filter them out), then pass `-r <pipeId>` explicitly on every `script`/`command` invocation. A bare `rhinocode script ...` with no `-r` resolves ambiguously when >1 Rhino instance is open. On ambiguity (>1 live Rhino instance), fail loud and list each `pipeId` + `activeDoc.title` rather than guessing — see `discover_rhino_instances()`/`resolve_instance()` in `${CLAUDE_PLUGIN_ROOT}/skills/rhino-e2e-testing/resources/in_process_bridge_runner.py`. There is no `-i` flag; the only selector is `-r, --rhino <ID>`. Never pin a PID/instance-id literal — instance ids are volatile across sessions.
4. **Doc-hint guard for mutating probes**: Any document-mutating in-process script must guard against running against the wrong open document — set `RHINO_DOC_HINT` (matched case-insensitively as a substring of `RhinoDoc.Name`) and abort on mismatch; `RHINO_DOC_READONLY=1` downgrades a mismatch to a warning for read-only probes. See the guard at the top of `${CLAUDE_PLUGIN_ROOT}/skills/rhino-e2e-testing/resources/in_process_suite_runner.py`.
5. **Environment via header, not `pip`**: To use `pytest`/pip packages in-process, declare `# venv: <name>` + `# r: <pkg>` (default) — never `# env:` unless deliberately targeting an existing external, Python-3.9-matched site-packages. See *Bringing packages into the in-process script* above.
6. **Mutating probes: tag them, run them once, never retry**. Every probe declares its blast radius next to itself — `read-only` (inspects only, safe to re-run) or `mutating` (writes document objects, **app-global settings, or plugin state**). An undeclared probe is treated as mutating. A mutating probe gets **exactly one invocation**: no retry-on-timeout, no retry-on-empty-report. The async trap makes retry the instinctive response to an empty file, and it is precisely wrong here — the second dispatch merely buys the first one time to finish, so a "retry that worked" can double-apply a mutation. When a mutating probe's sentinel does not appear, **investigate; do not re-run**. Note that Key Rule 4's `RHINO_DOC_HINT` guards the wrong-*document* case only — it offers no protection at all for app-global state, which is exactly where a double-apply is hardest to undo. Use `${CLAUDE_PLUGIN_ROOT}/skills/rhino-e2e-testing/resources/probe_harness.py`, which carries the `MUTATING` tag, the doc guard, stdout capture, and the sentinel in one place.

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
python "${CLAUDE_PLUGIN_ROOT}/skills/rhino-e2e-testing/scripts/run_headless.py" tests/e2e --cov=src
```

The runner ships with this skill, so it is addressed via `${CLAUDE_PLUGIN_ROOT}` — a bare
`scripts/run_headless.py` resolves against the consuming project's cwd and is not found.

Standard `pytest` commands are also available:
- `pytest` : Basic run.
- `pytest --cov=src --cov-report=term-missing` : Run with coverage.
- `pytest -s` : Show print output.

## 🚫 Ground-Truth Gates (E2E First)

1. **Geometry Task**: If the task involves complex geometry (C-Values, intersections, manifoldness), you MUST write a failing E2E test in `tests/e2e/` before implementing the fix.
2. **Regression Check**: Every new geometric feature must include an assertion for its primary invariant (e.g., "Resulting Brep must be closed").

## 🔧 Troubleshooting

- **DLL Collisions / wrong version loaded**: Common if multiple versions of Rhino are installed. A bare `rhinoinside.load()` silently defaults to **Rhino 7** (signature: `load(rhino_dir_or_major_version = 7, ...)`) with no warning — Rhino 8-only APIs (e.g. `ModelObject`) then fail in a way that masquerades as test rot. Always `rhinoinside.load(8)` explicitly; when Lane A behaves strangely on a multi-Rhino machine, verify `Rhino.RhinoApp.Version.Major` **before** triaging test failures.
- **Missing Plugins**: Headless Rhino does not load all GH plugins by default. You may need to call `gh.Instances.ComponentServer.AddExternalObject()` manually in `conftest.py` — or escalate to Lane A-live (`rhinocode`), where the full plugin set is already loaded.
- **License**: Rhino.Inside consumes a license just like a GUI session. Ensure your license server/Cloud Zoo is accessible.
