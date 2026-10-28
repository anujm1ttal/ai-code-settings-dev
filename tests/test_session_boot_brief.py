"""Tests for hooks/session-boot.js's brief trim (ALB-1 T8).

Covers: overall byte budget, current_task.md truncation at 2,000 B, pointer
lines (path + line count, no content) for every other state file, the
inline `## Blockers` extraction from HANDOFF_BRIEF.md (user decision Q5),
and the `logPassOnce` heartbeat restored per HFO HR1 — session-boot logged
0 rows since commit 5bcbc68 dropped its gate-log import.

Isolation: every test runs against a `tmp_path` workspace, never the real
repo's `Artifacts/.agent/gate_events.jsonl` (`workspace`/`real_content_workspace`
fixtures below never point `cwd` at REPO_ROOT with logging enabled).
"""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
HOOKS_DIR = REPO_ROOT / "hooks"

MAX_BRIEF_BYTES = 2750
MAX_CURRENT_TASK_BYTES = 2000


def run_hook(payload: dict, cwd: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["node", str(HOOKS_DIR / "session-boot.js")],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        encoding="utf-8",  # Node emits UTF-8; Windows default cp1252 corrupts byte accounting.
        cwd=cwd,
        timeout=10,
    )


def _context(result: subprocess.CompletedProcess) -> str:
    assert result.returncode == 0, f"non-zero exit: stderr={result.stderr!r}"
    output = json.loads(result.stdout)
    return output["hookSpecificOutput"]["additionalContext"]


def _events(events_file: Path) -> list[dict]:
    if not events_file.exists():
        return []
    return [json.loads(line) for line in events_file.read_text(encoding="utf-8").splitlines() if line.strip()]


@pytest.fixture
def workspace(tmp_path: Path) -> Path:
    """A cwd with an empty Artifacts/ dir — isolated from the real repo."""
    (tmp_path / "Artifacts").mkdir()
    return tmp_path


@pytest.fixture
def real_content_workspace(tmp_path: Path) -> Path:
    """Copies THIS repo's real Artifacts state files into an isolated tmp
    workspace so the byte-budget assertion measures real content sizes
    without writing a heartbeat row into the real gate_events.jsonl."""
    src = REPO_ROOT / "Artifacts"
    dest = tmp_path / "Artifacts"
    (dest / ".agent").mkdir(parents=True)
    (dest / "learnings").mkdir()
    shutil.copy(src / ".agent" / "current_task.md", dest / ".agent" / "current_task.md")
    for name in ("HANDOFF_BRIEF.md", "TODO.md", "DECISION_LOG.md"):
        s = src / name
        if s.exists():
            shutil.copy(s, dest / name)
    learnings_index = src / "learnings" / "index.md"
    if learnings_index.exists():
        shutil.copy(learnings_index, dest / "learnings" / "index.md")
    return tmp_path


# ---------------------------------------------------------------------------
# Byte budget
# ---------------------------------------------------------------------------


def test_brief_within_byte_budget_on_real_repo_content(real_content_workspace: Path):
    """ALB-1 T8 success metric: startup brief <= 2,750 B, measured against
    this repo's actual state file sizes."""
    result = run_hook({"cwd": str(real_content_workspace), "source": "startup"}, cwd=real_content_workspace)
    context = _context(result)
    assert len(context.encode("utf-8")) <= MAX_BRIEF_BYTES


def test_total_budget_with_long_root_and_multibyte_state(workspace: Path):
    """Aggregate budget must hold even when both bounded sections are full."""
    root = workspace / ("long-project-name-" * 5)
    state = root / "Artifacts"
    (state / ".agent").mkdir(parents=True)
    (state / ".agent/current_task.md").write_text(
        "## Objective\nRepair the release audit\n" + "é" * 900 + "\n## Blockers\nBlocked by audit\n",
        encoding="utf-8",
    )
    (state / "HANDOFF_BRIEF.md").write_text(
        "## Blockers\n" + "é" * 250 + "\n## Next\nLater\n", encoding="utf-8"
    )
    (state / "TODO.md").write_text("- [ ] audit\n", encoding="utf-8")
    context = _context(run_hook({"cwd": str(root)}, cwd=root))
    assert len(context.encode("utf-8")) <= MAX_BRIEF_BYTES
    assert "## Objective\nRepair the release audit" in context
    assert "Artifacts/TODO.md (1 lines)" in context
    assert "## Blockers" in context
    assert "Read Artifacts/.agent/current_task.md for the rest" in context


# ---------------------------------------------------------------------------
# current_task.md: injected whole, capped at 2,000 B
# ---------------------------------------------------------------------------


def test_current_task_truncated_at_2000_bytes_with_marker(workspace: Path):
    big = "A" * 5000
    (workspace / "Artifacts" / ".agent").mkdir()
    (workspace / "Artifacts" / ".agent" / "current_task.md").write_text(big, encoding="utf-8")

    context = _context(run_hook({"cwd": str(workspace)}, cwd=workspace))

    assert "## Current Task" in context
    assert "current_task.md" in context  # truncation marker names the source file
    assert "A" * MAX_CURRENT_TASK_BYTES in context
    assert "A" * (MAX_CURRENT_TASK_BYTES + 1) not in context


def test_current_task_under_cap_not_truncated(workspace: Path):
    small = "short task body"
    (workspace / "Artifacts" / ".agent").mkdir()
    (workspace / "Artifacts" / ".agent" / "current_task.md").write_text(small, encoding="utf-8")

    context = _context(run_hook({"cwd": str(workspace)}, cwd=workspace))

    assert small in context
    assert "truncated at" not in context


# ---------------------------------------------------------------------------
# Every other state file: pointer line only (path + line count, no content)
# ---------------------------------------------------------------------------


def test_pointer_lines_present_with_line_counts_no_content_dump(workspace: Path):
    artifacts = workspace / "Artifacts"
    (artifacts / "HANDOFF_BRIEF.md").write_text("h1\nh2\nh3\nh4\nh5", encoding="utf-8")
    (artifacts / "TODO.md").write_text("t1\nt2\nt3", encoding="utf-8")
    (artifacts / "learnings").mkdir()
    (artifacts / "learnings" / "index.md").write_text("n1\nn2\nn3\nn4", encoding="utf-8")
    (artifacts / "DECISION_LOG.md").write_text("d1\nd2", encoding="utf-8")

    context = _context(run_hook({"cwd": str(workspace)}, cwd=workspace))

    assert "Artifacts/HANDOFF_BRIEF.md (5 lines)" in context
    assert "Artifacts/TODO.md (3 lines)" in context
    assert "Artifacts/learnings/index.md (4 lines)" in context
    assert "Artifacts/DECISION_LOG.md (2 lines)" in context
    # Pointer only — the full multi-line bodies must never appear verbatim.
    assert "t1\nt2\nt3" not in context
    assert "n1\nn2\nn3\nn4" not in context
    assert "d1\nd2" not in context


def test_learnings_falls_back_to_legacy_file_pointer(workspace: Path):
    artifacts = workspace / "Artifacts"
    (artifacts / "LEARNINGS.md").write_text("legacy1\nlegacy2", encoding="utf-8")

    context = _context(run_hook({"cwd": str(workspace)}, cwd=workspace))

    assert "Artifacts/LEARNINGS.md (2 lines)" in context


# ---------------------------------------------------------------------------
# HANDOFF_BRIEF.md `## Blockers` stays inline (user decision Q5)
# ---------------------------------------------------------------------------


def test_blockers_section_kept_inline_bounded(workspace: Path):
    handoff = (
        "## Session Summary\nDid stuff.\n\n"
        "## Blockers\n\nWaiting on X approval.\n\n"
        "## Decisions\nSecret decision text should not leak.\n"
    )
    (workspace / "Artifacts" / "HANDOFF_BRIEF.md").write_text(handoff, encoding="utf-8")

    context = _context(run_hook({"cwd": str(workspace)}, cwd=workspace))

    assert "Waiting on X approval." in context
    assert "Secret decision text should not leak." not in context


def test_no_blockers_heading_emits_no_blockers_section(workspace: Path):
    handoff = "## Session Summary\nNothing blocking.\n"
    (workspace / "Artifacts" / "HANDOFF_BRIEF.md").write_text(handoff, encoding="utf-8")

    context = _context(run_hook({"cwd": str(workspace)}, cwd=workspace))

    assert "## Blockers" not in context


# ---------------------------------------------------------------------------
# Missing-state alert behavior preserved: nothing found -> no output at all
# ---------------------------------------------------------------------------


def test_no_state_files_emits_nothing(workspace: Path):
    result = run_hook({"cwd": str(workspace)}, cwd=workspace)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


# ---------------------------------------------------------------------------
# HFO HR1: once-per-session pass heartbeat restored
# ---------------------------------------------------------------------------


def test_heartbeat_written_once_per_session(workspace: Path):
    session_id = "test-session-abc"
    payload = {"cwd": str(workspace), "session_id": session_id}

    run_hook(payload, cwd=workspace)
    run_hook(payload, cwd=workspace)  # second fire in the same session must not duplicate

    events = _events(workspace / "Artifacts" / ".agent" / "gate_events.jsonl")
    session_boot_events = [e for e in events if e.get("hook") == "session-boot"]
    assert len(session_boot_events) == 1
    assert session_boot_events[0]["decision"] == "pass"


def test_heartbeat_written_even_when_brief_is_empty(workspace: Path):
    """The heartbeat must prove the hook ran regardless of whether any state
    was found to inject — a real evaluation either way."""
    session_id = "test-session-empty"
    run_hook({"cwd": str(workspace), "session_id": session_id}, cwd=workspace)

    events = _events(workspace / "Artifacts" / ".agent" / "gate_events.jsonl")
    session_boot_events = [e for e in events if e.get("hook") == "session-boot"]
    assert len(session_boot_events) == 1
    assert session_boot_events[0]["note"] == "no-state-found"


def test_heartbeat_distinguishes_brief_emitted_note(workspace: Path):
    (workspace / "Artifacts" / "TODO.md").write_text("t1\nt2", encoding="utf-8")
    session_id = "test-session-emitted"
    run_hook({"cwd": str(workspace), "session_id": session_id}, cwd=workspace)

    events = _events(workspace / "Artifacts" / ".agent" / "gate_events.jsonl")
    session_boot_events = [e for e in events if e.get("hook") == "session-boot"]
    assert len(session_boot_events) == 1
    assert session_boot_events[0]["note"] == "brief-emitted"
