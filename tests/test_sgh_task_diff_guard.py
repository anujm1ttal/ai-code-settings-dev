"""Shell smoke tests for hooks/task-diff-guard.js — SGH-1 T1.

Exercises the real Node subprocess contract (stdin JSON in, additionalContext or
fail-open exit 0 out), matching test_hooks_smoke.py / test_igh_guards.py. The hook
resolves the project root from `cwd`, so each test builds a throwaway Artifacts/
tree in tmp_path and points the hook at it.
"""

import json
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
HOOK = REPO_ROOT / "hooks" / "task-diff-guard.js"

TASK_INPUT = {"subagent_type": "coder", "description": "do a thing", "prompt": "..."}


def run_hook(payload: dict, cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(HOOK)],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        cwd=str(cwd),
        timeout=10,
    )


def run_raw(stdin: str, cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(HOOK)],
        input=stdin,
        capture_output=True,
        text=True,
        cwd=str(cwd),
        timeout=10,
    )


@pytest.fixture
def project(tmp_path: Path) -> Path:
    artifacts = tmp_path / "Artifacts"
    (artifacts / ".agent").mkdir(parents=True)
    (artifacts / "Plans").mkdir()
    (artifacts / "TODO.md").write_text("- [ ] T1: original\n", encoding="utf-8")
    (artifacts / "BACKLOG.md").write_text("## entry\nStatus: OPEN\n", encoding="utf-8")
    (artifacts / "Plans" / "SGH-1-TODO.md").write_text("- [ ] T1\n", encoding="utf-8")
    return tmp_path


# This runtime names the subagent-dispatch tool "Agent"; other/older runtimes
# name it "Task". The hook must fire for both — every firing test runs under both.
DISPATCH_TOOL_NAMES = ["Task", "Agent"]


def pre(project: Path, tool_input=TASK_INPUT, tool_name: str = "Task") -> subprocess.CompletedProcess:
    return run_hook(
        {"hook_event_name": "PreToolUse", "tool_name": tool_name,
         "tool_input": tool_input, "cwd": str(project)},
        project,
    )


def post(project: Path, tool_input=TASK_INPUT, tool_name: str = "Task") -> subprocess.CompletedProcess:
    return run_hook(
        {"hook_event_name": "PostToolUse", "tool_name": tool_name,
         "tool_input": tool_input, "tool_response": {}, "cwd": str(project)},
        project,
    )


# ── fail-open contract ───────────────────────────────────────────────────────

@pytest.mark.parametrize("bad", ["not json {{{", "", "42", "null"])
def test_fail_open_on_bad_stdin(bad: str, tmp_path: Path):
    result = run_raw(bad, tmp_path)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_non_task_tool_is_ignored(project: Path):
    result = run_hook(
        {"hook_event_name": "PreToolUse", "tool_name": "Bash",
         "tool_input": {"command": "ls"}, "cwd": str(project)},
        project,
    )
    assert result.returncode == 0
    assert result.stdout.strip() == ""
    assert not (project / "Artifacts" / ".agent" / "pre-task-snapshot").exists()


def test_no_artifacts_dir_is_noop(tmp_path: Path):
    plain = tmp_path / "plain"
    plain.mkdir()
    (plain / ".git").mkdir()
    result = pre(plain)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


# ── PreToolUse: snapshot ─────────────────────────────────────────────────────

@pytest.mark.parametrize("tool_name", DISPATCH_TOOL_NAMES)
def test_pre_snapshots_present_files(project: Path, tool_name: str):
    result = pre(project, tool_name=tool_name)
    assert result.returncode == 0
    snaps = list((project / "Artifacts" / ".agent" / "pre-task-snapshot").rglob("*"))
    names = {p.name for p in snaps if p.is_file()}
    assert {"TODO.md", "BACKLOG.md", "SGH-1-TODO.md"} <= names


def test_pre_skips_absent_files(project: Path):
    # AUDIT_REPORT.md / DECISION_LOG.md do not exist in the fixture
    pre(project)
    snaps = {p.name for p in (project / "Artifacts" / ".agent" / "pre-task-snapshot").rglob("*") if p.is_file()}
    assert "AUDIT_REPORT.md" not in snaps
    assert "DECISION_LOG.md" not in snaps


# ── PostToolUse: diff ────────────────────────────────────────────────────────

@pytest.mark.parametrize("tool_name", DISPATCH_TOOL_NAMES)
def test_post_flags_changed_protected_file(project: Path, tool_name: str):
    pre(project, tool_name=tool_name)
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: original\n- [ ] T2\n", encoding="utf-8")
    result = post(project, tool_name=tool_name)
    assert result.returncode == 0
    out = json.loads(result.stdout)
    hso = out["hookSpecificOutput"]
    assert hso["hookEventName"] == "PostToolUse"
    ctx = hso["additionalContext"]
    assert "Artifacts/TODO.md" in ctx
    assert "coder" in ctx
    assert "+ - [x] T1: original" in ctx


def test_post_silent_when_nothing_changed(project: Path):
    pre(project)
    result = post(project)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_post_deletes_snapshot_after_run(project: Path):
    pre(project)
    key_dir = project / "Artifacts" / ".agent" / "pre-task-snapshot"
    assert any(key_dir.iterdir())
    post(project)
    assert not key_dir.exists() or not any(key_dir.iterdir())


def test_post_without_snapshot_is_silent(project: Path):
    # PostToolUse with no matching PreToolUse snapshot → fail open
    result = post(project)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_parallel_dispatches_do_not_clobber(project: Path):
    a = {"subagent_type": "coder", "prompt": "task A"}
    b = {"subagent_type": "auditor", "prompt": "task B"}
    pre(project, a)
    pre(project, b)
    (project / "Artifacts" / "BACKLOG.md").write_text("changed by A\n", encoding="utf-8")
    out_a = post(project, a)
    assert "Artifacts/BACKLOG.md" in json.loads(out_a.stdout)["hookSpecificOutput"]["additionalContext"]
    # B's snapshot still intact and also sees the change
    out_b = post(project, b)
    assert "Artifacts/BACKLOG.md" in json.loads(out_b.stdout)["hookSpecificOutput"]["additionalContext"]


def test_flags_deleted_protected_file(project: Path):
    pre(project)
    (project / "Artifacts" / "BACKLOG.md").unlink()
    result = post(project)
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/BACKLOG.md" in ctx
    assert "deleted or unreadable" in ctx


# ── SGH-1 T7-prep: matcher must accept the runtime's real dispatch tool name ──

def test_agent_dispatch_end_to_end_surfaces_protected_edit(project: Path):
    # The concrete regression: a real `Agent` dispatch that edits TODO.md must be
    # snapshotted (Pre) and surfaced with a diff (Post) — this is what the inert
    # `!== 'Task'` guard silently dropped for the life of the hook.
    pre(project, tool_name="Agent")
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: original\n", encoding="utf-8")
    result = post(project, tool_name="Agent")
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx
    assert "+ - [x] T1: original" in ctx


@pytest.mark.parametrize("config_file", ["settings-template.json", "enforced-rules.json"])
def test_matcher_config_accepts_both_task_and_agent(config_file: str):
    text = (REPO_ROOT / "hooks" / config_file).read_text(encoding="utf-8")
    config = json.loads(text)
    if config_file == "enforced-rules.json":
        matchers = {r["matcher"] for r in config["rules"] if r["hook_file"] == "task-diff-guard.js"}
    else:
        blocks = config["hooks"]["PreToolUse"] + config["hooks"]["PostToolUse"]
        matchers = {
            b["matcher"] for b in blocks
            if any("task-diff-guard.js" in h.get("command", "") for h in b["hooks"])
        }
    assert matchers == {"Task|Agent"}, f"{config_file}: task-diff-guard matcher(s) {matchers}"
