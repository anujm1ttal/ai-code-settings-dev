"""Shell smoke tests for hooks/*.js — TL-M1.

Exercises the real Node subprocess contract (stdin JSON in, PreToolUse deny
schema or fail-open exit 0 out) rather than importing internals, since these
scripts are invoked by the Claude Code harness as external processes.
"""

import json
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
HOOKS_DIR = REPO_ROOT / "hooks"
ALL_HOOKS = [
    "guard-paths.js", "guard-commands.js", "auto-lint.js", "audit-trail.js",
    "session-boot.js", "nudge-handoff.js", "evidence-gate.js",
]


def run_hook(script: str, stdin_payload: str, cwd: Path = REPO_ROOT) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(HOOKS_DIR / script)],
        input=stdin_payload,
        capture_output=True,
        text=True,
        cwd=cwd,
        timeout=10,
    )


@pytest.mark.parametrize("hook", ALL_HOOKS)
@pytest.mark.parametrize("bad_stdin", ["not valid json {{{", ""], ids=["malformed-json", "empty-stdin"])
def test_hooks_fail_open_on_bad_stdin(hook: str, bad_stdin: str):
    """Garbage or empty stdin must never block the session — exit 0 regardless."""
    result = run_hook(hook, bad_stdin)
    assert result.returncode == 0, f"{hook} did not fail open on {bad_stdin!r}: stderr={result.stderr!r}"


def test_guard_paths_denies_env_file():
    payload = json.dumps({"tool_input": {"file_path": "secrets/.env"}})
    result = run_hook("guard-paths.js", payload)
    assert result.returncode == 0
    output = json.loads(result.stdout)
    hso = output["hookSpecificOutput"]
    assert hso["hookEventName"] == "PreToolUse"
    assert hso["permissionDecision"] == "deny"
    assert ".env" in hso["permissionDecisionReason"]


def test_guard_paths_allows_normal_source_file():
    payload = json.dumps({"tool_input": {"file_path": "scripts/model_router.py"}})
    result = run_hook("guard-paths.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_guard_commands_denies_rm_rf_root():
    payload = json.dumps({"tool_input": {"command": "rm -rf /"}})
    result = run_hook("guard-commands.js", payload)
    assert result.returncode == 0
    output = json.loads(result.stdout)
    hso = output["hookSpecificOutput"]
    assert hso["permissionDecision"] == "deny"
    assert "Recursive delete" in hso["permissionDecisionReason"]


def test_guard_commands_allows_normal_command():
    payload = json.dumps({"tool_input": {"command": "git status"}})
    result = run_hook("guard-commands.js", payload)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_session_boot_injects_context_for_project_with_artifacts():
    payload = json.dumps({"cwd": str(REPO_ROOT)})
    result = run_hook("session-boot.js", payload)
    assert result.returncode == 0
    output = json.loads(result.stdout)
    hso = output["hookSpecificOutput"]
    assert hso["hookEventName"] == "SessionStart"
    assert "Project root:" in hso["additionalContext"]
