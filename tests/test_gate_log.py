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


def test_guard_paths_allow_writes_pass_heartbeat(workspace: Path):
    """HFO-1 T4: the allow path now emits a once-per-session pass heartbeat
    instead of writing nothing — this is the fix for Defect B (positives-only
    logging), not a regression of T1a's original "no event on allow" claim.
    `note` distinguishes the branch (HFO-1-Plan.md §3 note-vocabulary table)."""
    payload = json.dumps({"tool_input": {"file_path": "scripts/model_router.py"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "guard-paths.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "guard-paths"
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "no-path-match"


def test_guard_commands_deny_writes_gate_event(workspace: Path):
    payload = json.dumps({"tool_input": {"command": "rm -rf /"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "guard-commands.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "guard-commands"
    assert events[0]["decision"] == "deny"


def test_guard_commands_allow_writes_pass_heartbeat(workspace: Path):
    """HFO-1 T4: see test_guard_paths_allow_writes_pass_heartbeat."""
    payload = json.dumps({"tool_input": {"command": "git status"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "guard-commands.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "guard-commands"
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "no-pattern-match"


def test_auto_lint_nag_writes_gate_event(workspace: Path):
    env = _fake_ruff_env(workspace, exit_code=1, stdout_line="test.py:1:1: F401 'os' imported but unused")
    payload = json.dumps({"tool_input": {"file_path": "test.py"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "auto-lint.js", payload, cwd=workspace, env=env)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "auto-lint"
    assert events[0]["decision"] == "nag"


def test_auto_lint_clean_writes_pass_heartbeat(workspace: Path):
    """HFO-1 T4: see test_guard_paths_allow_writes_pass_heartbeat. The fake
    ruff is on PATH and exits 0, so this hits the 'lint-clean' branch — the
    linter actually ran, distinct from the three could-not-evaluate branches
    (no-file-path/no-linter-mapped/linter-unavailable) that never run it."""
    env = _fake_ruff_env(workspace, exit_code=0)
    payload = json.dumps({"tool_input": {"file_path": "test.py"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "auto-lint.js", payload, cwd=workspace, env=env)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "auto-lint"
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "lint-clean"


def test_auto_lint_no_linter_mapped_writes_could_not_evaluate_note(workspace: Path):
    """A file extension with no LINTER_MAP entry never reaches the linter at
    all — the 'no-linter-mapped' note distinguishes this could-not-evaluate
    branch from 'lint-clean' (HFO-1-Plan.md §3)."""
    payload = json.dumps({"tool_input": {"file_path": "README.md"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "auto-lint.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "auto-lint"
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "no-linter-mapped"


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


def test_evidence_gate_silent_writes_pass_heartbeat(workspace: Path):
    """HFO-1 T4: see test_guard_paths_allow_writes_pass_heartbeat. This fixture
    has source edits + a completion claim + fresh evidence, so it reaches the
    hasFreshEvidence() branch specifically — note 'evidence-fresh'."""
    payload = json.dumps({"transcript_path": str(FIXTURES_DIR / "evidenced-done.jsonl"), "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "evidence-gate.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "evidence-gate"
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "evidence-fresh"


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


# ---------------------------------------------------------------------------
# T2 — 5 MB rotation, mirroring audit-trail.js
# ---------------------------------------------------------------------------

GATE_LOG_PATH = (HOOKS_DIR / "lib" / "gate-log.js").as_posix()
MAX_BYTES = 5 * 1024 * 1024


def _agent_dir(workspace: Path) -> Path:
    d = workspace / "Artifacts" / ".agent"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _run_log_gate_event(workspace: Path, hook: str = "test-hook") -> subprocess.CompletedProcess:
    script = (
        f"const {{ logGateEvent }} = require('{GATE_LOG_PATH}');\n"
        f"logGateEvent({{ hook: {json.dumps(hook)}, event: 'PreToolUse', decision: 'deny', "
        f"cwd: {json.dumps(str(workspace))} }});\n"
    )
    return subprocess.run(["node", "-e", script], capture_output=True, text=True, cwd=workspace, timeout=10)


def test_gate_log_rotates_over_threshold_file(workspace: Path):
    """Over-threshold gate_events.jsonl rotates to a stamped file on next append."""
    agent_dir = _agent_dir(workspace)
    log_file = agent_dir / "gate_events.jsonl"
    log_file.write_bytes(b"x" * (MAX_BYTES + 1))

    result = _run_log_gate_event(workspace)
    assert result.returncode == 0, result.stderr

    rotated = list(agent_dir.glob("gate_events.*.jsonl"))
    assert len(rotated) == 1, f"expected exactly one rotated file, found {rotated}"
    # Rotated file keeps the oversized content untouched.
    assert rotated[0].stat().st_size == MAX_BYTES + 1

    # The live log is fresh — only the new entry from this call.
    events = _events(log_file)
    assert len(events) == 1
    assert events[0]["hook"] == "test-hook"


def test_gate_log_does_not_rotate_under_threshold_file(workspace: Path):
    """Under-threshold gate_events.jsonl is appended to in place — no rotation."""
    agent_dir = _agent_dir(workspace)
    log_file = agent_dir / "gate_events.jsonl"
    log_file.write_text(json.dumps({"existing": "row"}) + "\n", encoding="utf-8")

    result = _run_log_gate_event(workspace)
    assert result.returncode == 0, result.stderr

    rotated = list(agent_dir.glob("gate_events.*.jsonl"))
    assert rotated == [], f"unexpected rotation of an under-threshold file: {rotated}"

    events = _events(log_file)
    assert len(events) == 2  # the pre-existing row plus the new append
    assert events[0] == {"existing": "row"}
    assert events[1]["hook"] == "test-hook"


def test_gate_log_rotation_never_throws_or_blocks_logging(workspace: Path):
    """Rotation runs inside its own fail-open try/catch — even if renameSync
    would fail (target already exists as a directory), the append still
    happens and the process still exits 0 (fail-open WITHIN fail-open)."""
    agent_dir = _agent_dir(workspace)
    log_file = agent_dir / "gate_events.jsonl"
    log_file.write_bytes(b"x" * (MAX_BYTES + 1))

    # Force renameSync to fail: pre-create every possible stamped-name target
    # this second cannot predict, so instead directly stub Date so the
    # rotation attempts to rename onto a path that already exists as a dir.
    stamp_dir_script = (
        f"const {{ logGateEvent }} = require('{GATE_LOG_PATH}');\n"
        "const RealDate = Date;\n"
        "class FixedDate extends RealDate {\n"
        "  constructor(...args) { super(...args); }\n"
        "  toISOString() { return '2026-01-01T00:00:00.000Z'; }\n"
        "}\n"
        "global.Date = FixedDate;\n"
        f"const fs = require('fs');\n"
        f"const path = require('path');\n"
        f"const collision = path.join({json.dumps(str(agent_dir))}, 'gate_events.2026-01-01-00-00-00.jsonl');\n"
        "fs.mkdirSync(collision, { recursive: true });\n"  # a directory, not a file — renameSync onto it throws
        f"logGateEvent({{ hook: 'test-hook', event: 'PreToolUse', decision: 'deny', cwd: {json.dumps(str(workspace))} }});\n"
        "console.log('ALL_OK');\n"
    )
    result = subprocess.run(["node", "-e", stamp_dir_script], capture_output=True, text=True, cwd=workspace, timeout=10)
    assert result.returncode == 0, result.stderr
    assert "ALL_OK" in result.stdout
    # The oversized file is still there (rename failed), but the append still
    # landed in it — logging was never blocked by the rotation failure.
    assert log_file.exists()


# ---------------------------------------------------------------------------
# T3 — logPassOnce: once-per-(hook, session) heartbeat
# ---------------------------------------------------------------------------


def _run_log_pass_once(workspace: Path, hook: str, session_id, extra: str = "") -> subprocess.CompletedProcess:
    session_field = "null" if session_id is None else json.dumps(session_id)
    script = (
        f"const {{ logPassOnce }} = require('{GATE_LOG_PATH}');\n"
        f"logPassOnce({{ hook: {json.dumps(hook)}, event: 'PreToolUse', "
        f"cwd: {json.dumps(str(workspace))}, sessionId: {session_field} }});\n"
        f"{extra}"
    )
    return subprocess.run(["node", "-e", script], capture_output=True, text=True, cwd=workspace, timeout=10)


def test_log_pass_once_second_call_same_hook_session_writes_no_row(workspace: Path):
    session_id = "sess-fixed"
    first = _run_log_pass_once(workspace, "guard-commands", session_id)
    assert first.returncode == 0, first.stderr
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["hook"] == "guard-commands"
    assert events[0]["decision"] == "pass"

    second = _run_log_pass_once(workspace, "guard-commands", session_id)
    assert second.returncode == 0, second.stderr
    # Still exactly one row — the second call (a fresh process, proving the
    # dedup marker is filesystem-based, not in-memory) was a no-op.
    events = _events(_events_file(workspace))
    assert len(events) == 1


def test_log_pass_once_different_session_writes_separate_row(workspace: Path):
    """Keyed on (hook, session) — a different session for the SAME hook is
    not deduped against the first."""
    first = _run_log_pass_once(workspace, "guard-paths", "session-a")
    second = _run_log_pass_once(workspace, "guard-paths", "session-b")
    assert first.returncode == 0 and second.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 2
    assert {e["decision"] for e in events} == {"pass"}


def test_log_pass_once_different_hook_same_session_writes_separate_row(workspace: Path):
    """Keyed on (hook, session), not session alone — two hooks in the same
    session both get their own heartbeat row."""
    session_id = "shared-session"
    first = _run_log_pass_once(workspace, "auto-lint", session_id)
    second = _run_log_pass_once(workspace, "evidence-gate", session_id)
    assert first.returncode == 0 and second.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 2
    assert {e["hook"] for e in events} == {"auto-lint", "evidence-gate"}


def test_log_pass_once_missing_session_id_writes_single_row_never_throws(workspace: Path):
    result = _run_log_pass_once(workspace, "guard-shared-state", None)
    assert result.returncode == 0, result.stderr
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["decision"] == "pass"


def test_log_pass_once_tolerates_null_undefined_and_non_object_args(tmp_path: Path):
    """Same hostile-argument sweep as logGateEvent's own regression test —
    logPassOnce must not throw before its own try/catch even starts."""
    script = (
        f"const {{ logPassOnce }} = require('{GATE_LOG_PATH}');\n"
        "for (const arg of [null, undefined, 42, 'str', true, [1, 2]]) {\n"
        "  logPassOnce(arg);\n"
        "}\n"
        "console.log('ALL_OK');\n"
    )
    result = subprocess.run(["node", "-e", script], capture_output=True, text=True, cwd=tmp_path, timeout=10)
    assert result.returncode == 0, f"logPassOnce threw on a bad argument: {result.stderr}"
    assert "ALL_OK" in result.stdout
    # No Artifacts/ dir under tmp_path — best-effort behavior is to write nothing.
    assert not (tmp_path / "Artifacts" / ".agent" / "gate_events.jsonl").exists()


def test_log_pass_once_creates_marker_file_on_disk(workspace: Path):
    """Presence control: the dedup marker itself must exist where T3's docs
    say it lives, not merely be inferred from row counts."""
    _run_log_pass_once(workspace, "nudge-handoff", "marker-check-session")
    marker_dir = workspace / "Artifacts" / ".agent" / "pass_markers"
    assert marker_dir.is_dir()
    markers = list(marker_dir.glob("nudge-handoff.marker-check-session*"))
    assert len(markers) == 1


# ---------------------------------------------------------------------------
# HFO-1 T4 — note vocabulary: each pass row is tagged with the specific
# no-op branch that produced it (HFO-1-Plan.md §3), not a bare "pass". These
# cover the remaining 8 of 13 call sites not already exercised above by the
# renamed pass-heartbeat tests (guard-paths/no-path-match,
# guard-commands/no-pattern-match, auto-lint/lint-clean+no-linter-mapped,
# evidence-gate/evidence-fresh).
# ---------------------------------------------------------------------------


def test_auto_lint_no_file_path_writes_could_not_evaluate_note(workspace: Path):
    payload = json.dumps({"tool_input": {}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "auto-lint.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "no-file-path"


def test_auto_lint_linter_unavailable_writes_could_not_evaluate_note(workspace: Path):
    """No fake ruff on PATH — matches test_lh1_hooks.py's
    test_auto_lint_ruff_absent_fails_open_silently precedent (this dev machine
    has no ruff installed either)."""
    payload = json.dumps({"tool_input": {"file_path": "test.py"}, "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "auto-lint.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "linter-unavailable"


def test_evidence_gate_no_source_edits_writes_evaluated_note(workspace: Path):
    transcript = workspace / "no-edits.jsonl"
    transcript.write_text(
        json.dumps({"type": "assistant", "message": {"role": "assistant", "content": [
            {"type": "text", "text": "This is done, nothing to change."}
        ]}}) + "\n",
        encoding="utf-8",
    )
    payload = json.dumps({"transcript_path": str(transcript), "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "evidence-gate.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "no-source-edits"


def test_evidence_gate_no_completion_claim_writes_evaluated_note(workspace: Path):
    transcript = workspace / "no-claim.jsonl"
    lines = [
        {"type": "assistant", "message": {"role": "assistant", "content": [
            {"type": "tool_use", "id": "toolu_01", "name": "Edit",
             "input": {"file_path": "src/pagination.py", "old_string": "i <= n", "new_string": "i < n"}}
        ]}},
        {"type": "user", "message": {"role": "user", "content": [
            {"type": "tool_result", "tool_use_id": "toolu_01", "content": "Updated."}
        ]}},
        {"type": "assistant", "message": {"role": "assistant", "content": [
            {"type": "text", "text": "Let me check the test output next."}
        ]}},
    ]
    transcript.write_text("\n".join(json.dumps(line) for line in lines) + "\n", encoding="utf-8")
    payload = json.dumps({"transcript_path": str(transcript), "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "evidence-gate.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "no-completion-claim"


def test_guard_shared_state_no_edit_writes_evaluated_note(workspace: Path):
    transcript = workspace / "benign-edit.jsonl"
    transcript.write_text(
        json.dumps({"type": "assistant", "message": {"role": "assistant", "content": [
            {"type": "tool_use", "id": "t1", "name": "Edit",
             "input": {"file_path": "scripts/thing.py", "new_string": "def add(a, b):\n    return a + b"}}
        ]}}) + "\n",
        encoding="utf-8",
    )
    payload = json.dumps({"transcript_path": str(transcript), "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "guard-shared-state.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "no-shared-state-edit"


def test_guard_shared_state_full_suite_ran_writes_evaluated_note(workspace: Path):
    transcript = workspace / "stdout-edit-then-full-suite.jsonl"
    lines = [
        {"type": "assistant", "message": {"role": "assistant", "content": [
            {"type": "tool_use", "id": "t1", "name": "Edit",
             "input": {"file_path": "scripts/thing.py", "new_string": "sys.stdout = TextIOWrapper(buf)"}}
        ]}},
        {"type": "assistant", "message": {"role": "assistant", "content": [
            {"type": "tool_use", "id": "t2", "name": "Bash", "input": {"command": "python -m pytest tests/ -q"}}
        ]}},
    ]
    transcript.write_text("\n".join(json.dumps(line) for line in lines) + "\n", encoding="utf-8")
    payload = json.dumps({"transcript_path": str(transcript), "cwd": str(workspace)})
    result = run_hook(HOOKS_DIR, "guard-shared-state.js", payload, cwd=workspace)
    assert result.returncode == 0
    events = _events(_events_file(workspace))
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "full-suite-ran"


def test_nudge_handoff_tree_clean_writes_evaluated_note(workspace: Path):
    _init_git_repo(workspace, dirty=False)
    session_id = str(uuid.uuid4())
    try:
        payload = json.dumps({"cwd": str(workspace), "session_id": session_id})
        result = run_hook(HOOKS_DIR, "nudge-handoff.js", payload, cwd=workspace)
        assert result.returncode == 0
        events = _events(_events_file(workspace))
        assert len(events) == 1
        assert events[0]["decision"] == "pass"
        assert events[0]["note"] == "tree-clean"
    finally:
        marker = _marker_path(session_id)
        if marker.exists():
            marker.unlink()


def test_nudge_handoff_recent_handoff_writes_evaluated_note(workspace: Path):
    _init_git_repo(workspace, dirty=True)
    session_id = str(uuid.uuid4())
    transcript = workspace / "recent-handoff.txt"
    transcript.write_text("User ran /handoff to close out the session.", encoding="utf-8")
    try:
        payload = json.dumps({
            "cwd": str(workspace),
            "session_id": session_id,
            "transcript_path": str(transcript),
        })
        result = run_hook(HOOKS_DIR, "nudge-handoff.js", payload, cwd=workspace)
        assert result.returncode == 0
        events = _events(_events_file(workspace))
        assert len(events) == 1
        assert events[0]["decision"] == "pass"
        assert events[0]["note"] == "handoff-recent"
    finally:
        marker = _marker_path(session_id)
        if marker.exists():
            marker.unlink()
