"""Tests for hooks/lib/gate-log.js instrumentation — LH-3 T1a/T1b/T5 (M4).

Three concerns, matched to the plan's Hard Rule 1 and TODO T1b success metric:

1. Each instrumented hook (guard-paths, guard-commands, auto-lint,
   nudge-handoff, evidence-gate) writes one gate_events.jsonl entry when it
   fires (deny/nag), and none when it doesn't.
2. Fail-open WITHIN fail-open: with gate-logging forced to throw, each
   instrumented hook's stdout and exit code are BYTE-IDENTICAL to a normal
   run. The broken logger throws unconditionally (bypassing its own internal
   try/catch) so this proves the call-site wrapping — not just gate-log.js's
   internal safety net — is what protects the hook's decision.
3. logGateEvent() itself must never throw regardless of argument shape
   (BACKLOG lh3_gate-log_1, LH-3 audit MEDIUM): a null/undefined/non-object
   argument must not throw BEFORE the function's internal try/catch even
   starts (a `= {}` default parameter alone does not cover `null`).
"""

import json
import shutil
import subprocess
import uuid
from pathlib import Path

import pytest

from test_lh1_hooks import _fake_ruff_env, _init_git_repo, _marker_path

REPO_ROOT = Path(__file__).resolve().parent.parent
HOOKS_DIR = REPO_ROOT / "hooks"
FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures" / "lh2"

BROKEN_GATE_LOG = (
    "function logGateEvent() {\n"
    "  throw new Error('simulated gate-log failure');\n"
    "}\n"
    "module.exports = { logGateEvent, findProjectRoot: () => '.' };\n"
)


def run_hook(hooks_dir: Path, script: str, stdin_payload: str, cwd: Path, env: dict | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(hooks_dir / script)],
        input=stdin_payload,
        capture_output=True,
        text=True,
        cwd=cwd,
        env=env,
        timeout=10,
    )


def _events(events_file: Path) -> list[dict]:
    if not events_file.exists():
        return []
    return [json.loads(line) for line in events_file.read_text(encoding="utf-8").splitlines() if line.strip()]


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    """A cwd with Artifacts/ present, so gate-log.js will actually write."""
    (tmp_path / "Artifacts").mkdir()
    return tmp_path


@pytest.fixture
def broken_hooks_dir(tmp_path: Path) -> Path:
    """A full copy of hooks/ with lib/gate-log.js swapped for a throwing stub."""
    dest = tmp_path / "hooks-broken"
    shutil.copytree(HOOKS_DIR, dest)
    (dest / "lib" / "gate-log.js").write_text(BROKEN_GATE_LOG, encoding="utf-8")
    return dest


def _events_file(workspace: Path) -> Path:
    return workspace / "Artifacts" / ".agent" / "gate_events.jsonl"


# ---------------------------------------------------------------------------
# Logs only when the hook fires
# ---------------------------------------------------------------------------


def test_guard_paths_deny_writes_gate_event(workspace: Path):
    payload = json.dumps({"tool_input": {"file_path": "secrets/.env"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "guard-paths.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "guard-paths"
    assert events[0]["decision"] == "deny"


def test_guard_paths_allow_writes_no_gate_event(workspace: Path):
    payload = json.dumps({"tool_input": {"file_path": "scripts/model_router.py"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "guard-paths.js", payload, cwd=workspace)
    assert result.returncode == 0
    assert _events(_events_file(workspace)) == []


def test_guard_commands_deny_writes_gate_event(workspace: Path):
    payload = json.dumps({"tool_input": {"command": "rm -rf /"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "guard-commands.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "guard-commands"
    assert events[0]["decision"] == "deny"


def test_guard_commands_allow_writes_no_gate_event(workspace: Path):
    payload = json.dumps({"tool_input": {"command": "git status"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "guard-commands.js", payload, cwd=workspace)
    assert result.returncode == 0
    assert _events(_events_file(workspace)) == []


def test_auto_lint_nag_writes_gate_event(workspace: Path):
    env = _fake_ruff_env(workspace, exit_code=1, stdout_line="test.py:1:1: F401 'os' imported but unused")
    payload = json.dumps({"tool_input": {"file_path": "test.py"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "auto-lint.js", payload, cwd=workspace, env=env)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "auto-lint"
    assert events[0]["decision"] == "nag"


def test_auto_lint_clean_writes_no_gate_event(workspace: Path):
    env = _fake_ruff_env(workspace, exit_code=0)
    payload = json.dumps({"tool_input": {"file_path": "test.py"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "auto-lint.js", payload, cwd=workspace, env=env)
    assert result.returncode == 0
    assert _events(_events_file(workspace)) == []


def test_nudge_handoff_nudge_writes_gate_event(workspace: Path):
    _init_git_repo(workspace, dirty=True)
    session_id = str(uuid.uuid4())
    try:
        payload = json.dumps({"cwd": str(workspace), "session_id": session_id})
        result = run_hook(HOOKS_DIR, "nudge-handoff.js", payload, cwd=workspace)
        assert result.returncode == 0
        events = _events(_events_file(workspace))
        assert len(events) == 1
        assert events[0]["hook"] == "nudge-handoff"
        assert events[0]["decision"] == "nag"
    finally:
        marker = _marker_path(session_id)
        if marker.exists():
            marker.unlink()


def test_evidence_gate_fire_writes_gate_event(workspace: Path):
    payload = json.dumps({"transcript_path": str(FIXTURES_DIR / "unevidenced-done.jsonl"), "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "evidence-gate.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "evidence-gate"
    assert events[0]["decision"] == "nag"


def test_evidence_gate_silent_writes_no_gate_event(workspace: Path):
    payload = json.dumps({"transcript_path": str(FIXTURES_DIR / "evidenced-done.jsonl"), "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "evidence-gate.js", payload, cwd=workspace)
    assert result.returncode == 0
    assert _events(_events_file(workspace)) == []


# ---------------------------------------------------------------------------
# logGateEvent() itself must never throw, for any argument shape
# (BACKLOG lh3_gate-log_1 / LH-3 audit MEDIUM)
# ---------------------------------------------------------------------------


def test_log_gate_event_tolerates_null_undefined_and_non_object_args(tmp_path: Path):
    """Regression for BACKLOG lh3_gate-log_1: destructuring a null/undefined/
    non-object argument must not throw BEFORE logGateEvent's own try/catch —
    a `= {}` default parameter alone does not cover `null` (defaults only
    apply to `undefined`)."""
    lib_path = (HOOKS_DIR / "lib" / "gate-log.js").as_posix()
    script = (
        f"const {{ logGateEvent }} = require('{lib_path}');\n"
        "for (const arg of [null, undefined, 42, 'str', true, [1, 2]]) {\n"
        "  logGateEvent(arg);\n"  # would throw here (uncaught) before any try/catch if unfixed
        "}\n"
        "console.log('ALL_OK');\n"
    )
    result = subprocess.run(["node", "-e", script], capture_output=True, text=True, cwd=tmp_path, timeout=10)
    assert result.returncode == 0, f"logGateEvent threw on a bad argument: {result.stderr}"
    assert "ALL_OK" in result.stdout
    # No Artifacts/ dir under tmp_path — best-effort behavior is to write nothing.
    assert not (tmp_path / "Artifacts" / ".agent" / "gate_events.jsonl").exists()


def test_log_gate_event_null_arg_still_calling_convention_no_arg_safe(tmp_path: Path):
    """logGateEvent() (zero args, i.e. undefined) must also be safe — the
    call-site pattern used by every instrumented hook, unaffected by the fix."""
    lib_path = (HOOKS_DIR / "lib" / "gate-log.js").as_posix()
    script = f"const {{ logGateEvent }} = require('{lib_path}'); logGateEvent(); console.log('ALL_OK');\n"
    result = subprocess.run(["node", "-e", script], capture_output=True, text=True, cwd=tmp_path, timeout=10)
    assert result.returncode == 0, f"logGateEvent() threw with no argument: {result.stderr}"
    assert "ALL_OK" in result.stdout


# ---------------------------------------------------------------------------
# Fail-open WITHIN fail-open: broken logging never changes decision/exit code
# ---------------------------------------------------------------------------


def test_guard_paths_deny_identical_with_broken_logging(workspace: Path, broken_hooks_dir: Path):
    payload = json.dumps({"tool_input": {"file_path": "secrets/.env"}, "cwd": str(workspace)})
    normal = run_hook(HOOKS_DIR, "guard-paths.js", payload, cwd=workspace)
    broken = run_hook(broken_hooks_dir, "guard-paths.js", payload, cwd=workspace)
    assert broken.returncode == normal.returncode == 0
    assert broken.stdout == normal.stdout


def test_guard_commands_deny_identical_with_broken_logging(workspace: Path, broken_hooks_dir: Path):
    payload = json.dumps({"tool_input": {"command": "rm -rf /"}, "cwd": str(workspace)})
    normal = run_hook(HOOKS_DIR, "guard-commands.js", payload, cwd=workspace)
    broken = run_hook(broken_hooks_dir, "guard-commands.js", payload, cwd=workspace)
    assert broken.returncode == normal.returncode == 0
    assert broken.stdout == normal.stdout


def test_auto_lint_nag_identical_with_broken_logging(workspace: Path, broken_hooks_dir: Path):
    env = _fake_ruff_env(workspace, exit_code=1, stdout_line="test.py:1:1: F401 'os' imported but unused")
    payload = json.dumps({"tool_input": {"file_path": "test.py"}, "cwd": str(workspace)})
    normal = run_hook(HOOKS_DIR, "auto-lint.js", payload, cwd=workspace, env=env)
    broken = run_hook(broken_hooks_dir, "auto-lint.js", payload, cwd=workspace, env=env)
    assert broken.returncode == normal.returncode == 0
    assert broken.stdout == normal.stdout


def test_nudge_handoff_identical_with_broken_logging(workspace: Path, broken_hooks_dir: Path):
    _init_git_repo(workspace, dirty=True)
    session_normal = str(uuid.uuid4())
    session_broken = str(uuid.uuid4())
    try:
        normal = run_hook(
            HOOKS_DIR, "nudge-handoff.js", json.dumps({"cwd": str(workspace), "session_id": session_normal}), cwd=workspace
        )
        broken = run_hook(
            broken_hooks_dir, "nudge-handoff.js", json.dumps({"cwd": str(workspace), "session_id": session_broken}), cwd=workspace
        )
        assert broken.returncode == normal.returncode == 0
        assert broken.stdout == normal.stdout
    finally:
        for session_id in (session_normal, session_broken):
            marker = _marker_path(session_id)
            if marker.exists():
                marker.unlink()


def test_evidence_gate_identical_with_broken_logging(workspace: Path, broken_hooks_dir: Path):
    payload = json.dumps({"transcript_path": str(FIXTURES_DIR / "unevidenced-done.jsonl"), "cwd": str(workspace)})
    normal = run_hook(HOOKS_DIR, "evidence-gate.js", payload, cwd=workspace)
    broken = run_hook(broken_hooks_dir, "evidence-gate.js", payload, cwd=workspace)
    assert broken.returncode == normal.returncode == 0
    assert broken.stdout == normal.stdout
