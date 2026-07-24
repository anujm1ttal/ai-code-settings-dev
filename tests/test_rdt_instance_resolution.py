"""Lane B tests for RDT-1 instance resolution — in_process_bridge_runner.py.

The module under test lives under `optional_plugins/` (not an installed package), so it
is loaded by path via `importlib.util`, matching the pattern `tests/conftest.py` already
uses for `scripts/` (path-based, not package-based).
"""

import importlib.util
import json
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
BRIDGE_RUNNER_PATH = (
    REPO_ROOT / "optional_plugins" / "geometry" / "skills" / "rhino-e2e-testing"
    / "resources" / "in_process_bridge_runner.py"
)

RHINO_ENTRY = {
    "pipeId": "rhinocode_remotepipe_31340",
    "processId": 31340,
    "processName": "Rhino",
    "activeDoc": {"title": "gBlox_P0_2_scratch.3dm", "location": r"C:\models\gBlox_P0_2_scratch.3dm"},
}
COMPUTE_ENTRY = {
    "pipeId": "rhinocode_remotepipe_30536",
    "processId": 30536,
    "processName": "compute.geometry",
    "activeDoc": {"title": "", "location": ""},
}
RHINO_ENTRY_2 = {
    "pipeId": "rhinocode_remotepipe_44821",
    "processId": 44821,
    "processName": "Rhino",
    "activeDoc": {"title": "other_project.3dm", "location": r"C:\models\other_project.3dm"},
}


def _load_bridge_runner():
    spec = importlib.util.spec_from_file_location("in_process_bridge_runner", BRIDGE_RUNNER_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def bridge_runner():
    return _load_bridge_runner()


class _FakeCompletedProcess:
    def __init__(self, stdout: str):
        self.stdout = stdout


def test_discover_rhino_instances_filters_compute_geometry(bridge_runner, monkeypatch):
    payload = json.dumps([RHINO_ENTRY, COMPUTE_ENTRY])
    monkeypatch.setattr(
        bridge_runner.subprocess, "run",
        lambda *a, **k: _FakeCompletedProcess(payload),
    )

    instances = bridge_runner.discover_rhino_instances()

    assert instances == [RHINO_ENTRY]


def test_resolve_instance_single_rhino_returns_pipe_id(bridge_runner, monkeypatch):
    payload = json.dumps([RHINO_ENTRY, COMPUTE_ENTRY])
    monkeypatch.setattr(
        bridge_runner.subprocess, "run",
        lambda *a, **k: _FakeCompletedProcess(payload),
    )
    monkeypatch.delenv("RHINO_INSTANCE_ID", raising=False)

    assert bridge_runner.resolve_instance() == RHINO_ENTRY["pipeId"]


def test_resolve_instance_multiple_rhino_raises_naming_both_docs(bridge_runner, monkeypatch):
    payload = json.dumps([RHINO_ENTRY, RHINO_ENTRY_2, COMPUTE_ENTRY])
    monkeypatch.setattr(
        bridge_runner.subprocess, "run",
        lambda *a, **k: _FakeCompletedProcess(payload),
    )
    monkeypatch.delenv("RHINO_INSTANCE_ID", raising=False)

    with pytest.raises(AssertionError) as exc_info:
        bridge_runner.resolve_instance()

    message = str(exc_info.value)
    assert RHINO_ENTRY["activeDoc"]["title"] in message
    assert RHINO_ENTRY_2["activeDoc"]["title"] in message


def test_resolve_instance_honors_env_override_without_discovery(bridge_runner, monkeypatch):
    def _fail(*a, **k):
        raise AssertionError("discovery should not be called when RHINO_INSTANCE_ID is set")

    monkeypatch.setattr(bridge_runner.subprocess, "run", _fail)
    monkeypatch.setenv("RHINO_INSTANCE_ID", "rhinocode_remotepipe_99999")

    assert bridge_runner.resolve_instance() == "rhinocode_remotepipe_99999"


def test_resolve_instance_no_rhino_instances_raises(bridge_runner, monkeypatch):
    payload = json.dumps([COMPUTE_ENTRY])
    monkeypatch.setattr(
        bridge_runner.subprocess, "run",
        lambda *a, **k: _FakeCompletedProcess(payload),
    )
    monkeypatch.delenv("RHINO_INSTANCE_ID", raising=False)

    with pytest.raises(AssertionError, match="no live Rhino instance"):
        bridge_runner.resolve_instance()
