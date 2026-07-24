"""Lane A in-process bridge — TEMPLATE.

Folds a pytest suite that runs INSIDE a live Rhino instance (real RhinoCommon, not a
headless mock) into your host `python -m pytest` gate, so that suite can never rot
silently — this bridge is the only thing that ever proves it green.

TEMPLATE: copy into your project's integration-test directory (e.g. tests/integration/),
fill in the two `# TODO:` placeholders below, and pair it with an adapted copy of
`in_process_suite_runner.py` whose REPORT_PATH and SENTINEL match exactly.

Why this exists (the exit-0-before-done trap)
-----------------------------------------------
rhinocode returns 0 before the script finishes — hence the sentinel poll; see the
rhino-e2e-testing skill (Lane A-live section) for the exit-0-before-done trap. This
bridge polls in_process_suite_runner.py's report file for a terminal SENTINEL line —
never the subprocess return code — against a deadline derived from TIMEOUT_S.

Usage
-----
Mark and call `run_in_process_suite()` from a normal pytest test so it can be selected
or skipped like any other test:

    @pytest.mark.lane_a_inprocess
    def test_in_process_suite_runs_and_passes():
        run_in_process_suite()
"""

import json
import os
import subprocess
import time

# --- TODO: fill in for your project ------------------------------------------------
RUNNER_PATH = "PATH/TO/in_process_suite_runner.py"             # your adapted copy of the runner
REPORT_PATH = "PATH/TO/Artifacts/Temp/inprocess_report.txt"    # MUST match the runner's REPORT_PATH
# -------------------------------------------------------------------------------------

RHINOCODE_EXE = os.environ.get("RHINOCODE_EXE", r"C:\Program Files\Rhino 8\System\rhinocode.exe")
SENTINEL = "[inprocess] complete rc="   # must match the runner's SENTINEL constant exactly
TIMEOUT_S = 300.0            # first run pip-installs pytest into the provisioned venv; be generous
POLL_INTERVAL_S = 2.0


def discover_rhino_instances() -> list[dict]:
    """Return `rhinocode list --json` entries whose processName is "Rhino".

    `list --json` also surfaces non-Rhino pipes (e.g. `compute.geometry`) that carry a
    `rhinocode_remotepipe_*` pipeId with an empty `activeDoc` — those are never a valid
    `-r` target and must be filtered out here, not left to the caller.
    """
    out = subprocess.run(
        [RHINOCODE_EXE, "list", "--json"], capture_output=True, text=True, timeout=30
    ).stdout
    entries = json.loads(out) if out.strip() else []
    return [e for e in entries if e.get("processName") == "Rhino"]


def resolve_instance() -> str:
    """Resolve the `-r` target for `rhinocode`. Fails loud on ambiguity — never guesses.

    Precedence:
    1. `RHINO_INSTANCE_ID` env var, if set — explicit override, skips discovery entirely.
    2. Exactly one live Rhino instance — return its pipeId.
    3. Zero or >1 live Rhino instances — raise (AssertionError) with a diagnostic; the
       caller must either close extra instances or set `RHINO_INSTANCE_ID`.
    """
    override = os.environ.get("RHINO_INSTANCE_ID")
    if override:
        return override

    instances = discover_rhino_instances()
    assert instances, "no live Rhino instance (StartScriptServer run?)"

    if len(instances) == 1:
        return instances[0]["pipeId"]

    table = "\n".join(
        f"  pipeId={e.get('pipeId')} activeDoc.title={e.get('activeDoc', {}).get('title', '')!r}"
        for e in instances
    )
    assert False, (
        "multiple live Rhino instances — refusing to guess which one to target:\n"
        + table
        + "\nSet RHINO_INSTANCE_ID to the intended pipeId to proceed."
    )


def _wait_for_sentinel(report_path: str, sentinel: str, deadline: float) -> int | None:
    """Poll `report_path` for a line starting with `sentinel`; return its trailing rc, or None."""
    while time.time() < deadline:
        if os.path.exists(report_path):
            with open(report_path, "r", encoding="utf-8") as f:
                for line in f.read().splitlines():
                    if line.startswith(sentinel):
                        return int(line[len(sentinel):].strip())
        time.sleep(POLL_INTERVAL_S)
    return None


def run_in_process_suite() -> None:
    """Drive the in-Rhino suite via rhinocode and block until the sentinel confirms completion.

    Raises AssertionError with a diagnostic message on any precondition failure, timeout,
    or non-zero in-process result — safe to call directly from a pytest test body.
    """
    assert os.path.exists(RHINOCODE_EXE), f"rhinocode not found at {RHINOCODE_EXE} (set RHINOCODE_EXE)"
    assert os.path.isfile(RUNNER_PATH), f"in-process runner missing: {RUNNER_PATH}"

    instance = resolve_instance()

    if os.path.exists(REPORT_PATH):
        os.remove(REPORT_PATH)   # fresh report; the sentinel we read must be from THIS run

    # env inherits os.environ by default (subprocess.run with no `env=` kwarg), so
    # RHINO_DOC_HINT / RHINO_DOC_READONLY set on the host process reach the in-Rhino
    # runner unchanged — no explicit env= construction needed to propagate the hint.
    # rhinocode returns exit 0 before the script finishes — do NOT assert on its return.
    subprocess.run(
        [RHINOCODE_EXE, "-r", instance, "script", RUNNER_PATH],
        capture_output=True, text=True, timeout=TIMEOUT_S,
    )

    rc = _wait_for_sentinel(REPORT_PATH, SENTINEL, time.time() + TIMEOUT_S)
    assert rc is not None, f"no sentinel within {TIMEOUT_S:.0f}s; see {REPORT_PATH}"
    assert rc == 0, f"in-process suite failed (rc={rc}); see {REPORT_PATH}"
