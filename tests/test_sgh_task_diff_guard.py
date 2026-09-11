"""Shell smoke tests for hooks/task-diff-guard.js — SGH-1b T10 (settle-at-Stop
redesign). Supersedes the SGH-1 T1 PostToolUse-diff test suite: PostToolUse now
only stamps a manifest (no diff/output/delete); Stop does the settling. See
`Artifacts/Plans/SGH-1-Plan.md` §SGH-1b for the D1/D2/D3 root cause and the
Stop-based fix this suite verifies.

Exercises the real Node subprocess contract (stdin JSON in, additionalContext or
fail-open exit 0 out), matching test_hooks_smoke.py / test_igh_guards.py. The hook
resolves the project root from `cwd`, so each test builds a throwaway Artifacts/
tree in tmp_path and points the hook at it.
"""

import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
HOOK = REPO_ROOT / "hooks" / "task-diff-guard.js"

TASK_INPUT = {"subagent_type": "coder", "description": "do a thing", "prompt": "..."}
TTL_MS = 6 * 60 * 60 * 1000


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
# name it "Task". The hook must fire for both — every dispatch test runs under both.
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


def stop(project: Path, transcript_path: Path | None = None, stop_hook_active: bool = False) -> subprocess.CompletedProcess:
    payload = {"hook_event_name": "Stop", "cwd": str(project)}
    if transcript_path is not None:
        payload["transcript_path"] = str(transcript_path)
    if stop_hook_active:
        payload["stop_hook_active"] = True
    return run_hook(payload, project)


# ── snapshot/manifest fixture helpers ────────────────────────────────────────

def snapshot_root(project: Path) -> Path:
    return project / "Artifacts" / ".agent" / "pre-task-snapshot"


def list_snapshot_dirs(project: Path) -> list[Path]:
    root = snapshot_root(project)
    if not root.exists():
        return []
    return [p for p in root.iterdir() if p.is_dir()]


def read_manifest(snap_dir: Path) -> dict:
    return json.loads((snap_dir / "manifest.json").read_text(encoding="utf-8"))


def write_manifest(snap_dir: Path, manifest: dict) -> None:
    (snap_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")


def gate_events_path(project: Path) -> Path:
    return project / "Artifacts" / ".agent" / "gate_events.jsonl"


def read_gate_events(project: Path) -> list[dict]:
    p = gate_events_path(project)
    if not p.exists():
        return []
    return [json.loads(line) for line in p.read_text(encoding="utf-8").splitlines() if line.strip()]


def task_diff_guard_events(project: Path) -> list[dict]:
    return [e for e in read_gate_events(project) if e.get("hook") == "task-diff-guard"]


# ── transcript fixture helpers ───────────────────────────────────────────────

def _iso(ms: int) -> str:
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def _edit_entry(tool_name: str, file_path: str, timestamp_ms: int) -> str:
    return json.dumps({
        "type": "assistant",
        "timestamp": _iso(timestamp_ms),
        "message": {"content": [{"type": "tool_use", "id": "t1", "name": tool_name, "input": {"file_path": file_path}}]},
    })


def _bash_entry(command: str, timestamp_ms: int) -> str:
    return json.dumps({
        "type": "assistant",
        "timestamp": _iso(timestamp_ms),
        "message": {"content": [{"type": "tool_use", "id": "t2", "name": "Bash", "input": {"command": command}}]},
    })


def write_transcript(dest: Path, lines: list[str]) -> Path:
    transcript = dest / f"transcript-{os.urandom(4).hex()}.jsonl"
    transcript.write_text("\n".join(lines), encoding="utf-8")
    return transcript


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
    assert not snapshot_root(project).exists()


def test_no_artifacts_dir_is_noop(tmp_path: Path):
    plain = tmp_path / "plain"
    plain.mkdir()
    (plain / ".git").mkdir()
    result = pre(plain)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_stop_noop_when_no_artifacts_dir(tmp_path: Path):
    plain = tmp_path / "plain"
    plain.mkdir()
    (plain / ".git").mkdir()
    result = stop(plain)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


# ── PreToolUse: snapshot + manifest ──────────────────────────────────────────

@pytest.mark.parametrize("tool_name", DISPATCH_TOOL_NAMES)
def test_pre_snapshots_present_files(project: Path, tool_name: str):
    result = pre(project, tool_name=tool_name)
    assert result.returncode == 0
    dirs = list_snapshot_dirs(project)
    assert len(dirs) == 1
    names = {p.name for p in dirs[0].rglob("*") if p.is_file() and p.name != "manifest.json"}
    assert {"TODO.md", "BACKLOG.md", "SGH-1-TODO.md"} <= names


def test_pre_skips_absent_files(project: Path):
    # AUDIT_REPORT.md / DECISION_LOG.md do not exist in the fixture
    pre(project)
    snaps = {p.name for p in list_snapshot_dirs(project)[0].rglob("*") if p.is_file()}
    assert "AUDIT_REPORT.md" not in snaps
    assert "DECISION_LOG.md" not in snaps


def test_pre_writes_in_flight_manifest(project: Path):
    pre(project)
    manifest = read_manifest(list_snapshot_dirs(project)[0])
    assert manifest["status"] == "in-flight"
    assert manifest["subagent_type"] == "coder"
    assert manifest["description"] == "do a thing"
    assert manifest["returned_at"] is None
    assert isinstance(manifest["dispatched_at"], int)
    assert manifest["tool_use_id"] is None  # T8: unverified, HR4 — never keyed on


def test_pre_identical_parallel_dispatches_get_distinct_dirs(project: Path):
    """D2 regression guarantee: two dispatches with byte-identical tool_input
    (the designed /audit --team / /afk fan-out case) must never clobber each
    other's baseline."""
    pre(project)
    pre(project)
    dirs = list_snapshot_dirs(project)
    assert len(dirs) == 2
    for d in dirs:
        assert (d / "TODO.md").read_text(encoding="utf-8") == "- [ ] T1: original\n"
        assert read_manifest(d)["status"] == "in-flight"


# ── PostToolUse: stamp only, no diff/output/delete ───────────────────────────

@pytest.mark.parametrize("tool_name", DISPATCH_TOOL_NAMES)
def test_post_stamps_returned_with_no_output(project: Path, tool_name: str):
    pre(project, tool_name=tool_name)
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: original\n", encoding="utf-8")
    result = post(project, tool_name=tool_name)
    assert result.returncode == 0
    assert result.stdout.strip() == ""  # D1 fix: PostToolUse never emits additionalContext anymore
    manifest = read_manifest(list_snapshot_dirs(project)[0])
    assert manifest["status"] == "returned"
    assert isinstance(manifest["returned_at"], int)


def test_post_without_snapshot_is_silent(project: Path):
    result = post(project)
    assert result.returncode == 0
    assert result.stdout.strip() == ""


def test_post_does_not_delete_the_snapshot(project: Path):
    pre(project)
    post(project)
    assert len(list_snapshot_dirs(project)) == 1  # still there — Stop deletes, not Post


def test_post_stamps_oldest_in_flight_when_keys_collide(project: Path):
    pre(project)  # dispatch 1
    dir1 = list_snapshot_dirs(project)[0]
    manifest1 = read_manifest(dir1)
    manifest1["dispatched_at"] -= 5000  # force dir1 strictly older
    write_manifest(dir1, manifest1)

    pre(project)  # dispatch 2, identical tool_input -> a second dir
    post(project)  # a single Post — must resolve to the OLDEST in-flight match

    assert read_manifest(dir1)["status"] == "returned"
    other = [d for d in list_snapshot_dirs(project) if d != dir1][0]
    assert read_manifest(other)["status"] == "in-flight"


# ── Stop: settle, retain, delete ──────────────────────────────────────────────

def test_stop_settles_returned_dispatch_and_surfaces_diff(project: Path):
    pre(project)
    snap_dir = list_snapshot_dirs(project)[0]
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: original\n- [ ] T2\n", encoding="utf-8")
    post(project)

    result = stop(project)
    assert result.returncode == 0
    out = json.loads(result.stdout)
    hso = out["hookSpecificOutput"]
    assert hso["hookEventName"] == "Stop"
    ctx = hso["additionalContext"]
    assert "Artifacts/TODO.md" in ctx
    assert "coder" in ctx
    assert "+ - [x] T1: original" in ctx
    assert not snap_dir.exists()  # settled -> deleted

    events = task_diff_guard_events(project)
    assert len(events) == 1
    assert events[0]["decision"] == "nag"
    assert events[0]["filtered_n"] == 0
    assert events[0]["settled_n"] == 1


def test_stop_retains_in_flight_snapshot(project: Path):
    """D2 regression guarantee, at Stop: an in-flight dispatch's baseline must
    survive a Stop that has nothing settled to evaluate."""
    pre(project)
    snap_dir = list_snapshot_dirs(project)[0]

    result = stop(project)
    assert result.returncode == 0
    assert result.stdout.strip() == ""
    assert snap_dir.exists()
    assert read_manifest(snap_dir)["status"] == "in-flight"
    assert task_diff_guard_events(project) == []  # nothing settled -> no row at all


def test_stop_no_row_and_silent_when_nothing_pending(project: Path):
    result = stop(project)
    assert result.returncode == 0
    assert result.stdout.strip() == ""
    assert task_diff_guard_events(project) == []


def test_stop_settled_unchanged_deletes_only_its_own_snapshot(project: Path):
    input_a = {"subagent_type": "coder", "description": "A", "prompt": "a"}
    input_b = {"subagent_type": "auditor", "description": "B", "prompt": "b"}
    pre(project, input_a)
    pre(project, input_b)
    post(project, input_a)  # A settles, unchanged; B stays in-flight

    result = stop(project)
    assert result.returncode == 0
    assert result.stdout.strip() == ""  # nothing changed -> pass, not nag

    remaining = list_snapshot_dirs(project)
    assert len(remaining) == 1
    assert read_manifest(remaining[0])["status"] == "in-flight"

    events = task_diff_guard_events(project)
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["settled_n"] == 1


def test_stop_aggregates_multiple_settled_dispatches_into_one_block(project: Path):
    input_a = {"subagent_type": "coder", "description": "A", "prompt": "a"}
    input_b = {"subagent_type": "auditor", "description": "B", "prompt": "b"}
    pre(project, input_a)
    pre(project, input_b)
    (project / "Artifacts" / "TODO.md").write_text("changed by A\n", encoding="utf-8")
    post(project, input_a)
    (project / "Artifacts" / "BACKLOG.md").write_text("changed by B\n", encoding="utf-8")
    post(project, input_b)

    result = stop(project)
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "2 settled subagent dispatch" in ctx
    assert "Artifacts/TODO.md" in ctx
    assert "Artifacts/BACKLOG.md" in ctx
    assert list_snapshot_dirs(project) == []  # both settled -> both deleted

    events = task_diff_guard_events(project)
    assert len(events) == 1  # exactly one row per Stop, even with 2 settled dispatches
    assert events[0]["decision"] == "nag"
    assert events[0]["settled_n"] == 2


def test_stop_flags_deleted_protected_file(project: Path):
    pre(project)
    post(project)
    (project / "Artifacts" / "BACKLOG.md").unlink()
    result = stop(project)
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/BACKLOG.md" in ctx
    assert "deleted or unreadable" in ctx


def test_stop_respects_stop_hook_active(project: Path):
    pre(project)
    post(project)
    (project / "Artifacts" / "TODO.md").write_text("changed\n", encoding="utf-8")
    result = stop(project, stop_hook_active=True)
    assert result.returncode == 0
    assert result.stdout.strip() == ""
    assert len(list_snapshot_dirs(project)) == 1  # left untouched, re-evaluated at a later Stop


# ── TTL sweep ─────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("status", ["in-flight", "returned"])
def test_stop_ttl_sweeps_stale_manifest_regardless_of_status(project: Path, status: str):
    pre(project)
    snap_dir = list_snapshot_dirs(project)[0]
    manifest = read_manifest(snap_dir)
    manifest["status"] = status
    manifest["dispatched_at"] -= (TTL_MS + 60_000)  # just over 6h stale
    write_manifest(snap_dir, manifest)

    result = stop(project)
    assert result.returncode == 0
    assert result.stdout.strip() == ""
    assert not snap_dir.exists()

    events = task_diff_guard_events(project)
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "ttl"


def test_stop_leaves_legacy_dir_without_manifest_alone_when_fresh(project: Path):
    snap_root = snapshot_root(project)
    snap_root.mkdir(parents=True, exist_ok=True)
    legacy_dir = snap_root / "legacy0000-0"
    legacy_dir.mkdir()
    (legacy_dir / "TODO.md").write_text("stale copy", encoding="utf-8")

    result = stop(project)
    assert result.returncode == 0
    assert result.stdout.strip() == ""
    assert legacy_dir.exists()  # not stale yet -> left alone, never diffed
    assert task_diff_guard_events(project) == []


def test_stop_sweeps_stale_legacy_dir_without_manifest(project: Path):
    snap_root = snapshot_root(project)
    snap_root.mkdir(parents=True, exist_ok=True)
    legacy_dir = snap_root / "legacy0000-0"
    legacy_dir.mkdir()
    old = time.time() - (TTL_MS / 1000 + 60)
    os.utime(legacy_dir, (old, old))

    result = stop(project)
    assert result.returncode == 0
    assert not legacy_dir.exists()

    events = task_diff_guard_events(project)
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "ttl"


# ── Attribution filter ───────────────────────────────────────────────────────

def _settle(project: Path) -> tuple[Path, int]:
    pre(project)
    snap_dir = list_snapshot_dirs(project)[0]
    dispatched_at = read_manifest(snap_dir)["dispatched_at"]
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: original\n", encoding="utf-8")
    post(project)
    return snap_dir, dispatched_at


def test_stop_attribution_filter_drops_main_agent_edit(project: Path):
    snap_dir, dispatched_at = _settle(project)
    transcript = write_transcript(project, [
        _edit_entry("Edit", "Artifacts/TODO.md", dispatched_at + 1000),
    ])
    result = stop(project, transcript_path=transcript)
    assert result.returncode == 0
    assert result.stdout.strip() == ""  # filtered to zero -> pass, not nag
    assert not snap_dir.exists()

    events = task_diff_guard_events(project)
    assert events[0]["decision"] == "pass"
    assert events[0]["filtered_n"] == 1


def test_stop_attribution_ignores_main_agent_edit_before_dispatch(project: Path):
    """An edit BEFORE the dispatch does not exempt the subagent — "at or
    after" is the boundary, not "ever"."""
    snap_dir, dispatched_at = _settle(project)
    transcript = write_transcript(project, [
        _edit_entry("Edit", "Artifacts/TODO.md", dispatched_at - 5000),
    ])
    result = stop(project, transcript_path=transcript)
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx
    events = task_diff_guard_events(project)
    assert events[0]["decision"] == "nag"
    assert events[0]["filtered_n"] == 0


def test_stop_surfaces_change_with_no_matching_main_agent_edit(project: Path):
    """A subagent's own edits never appear in the parent transcript — an
    unrelated tool call in the transcript must not suppress the finding."""
    snap_dir, dispatched_at = _settle(project)
    transcript = write_transcript(project, [_bash_entry("ls", dispatched_at + 500)])
    result = stop(project, transcript_path=transcript)
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx
    events = task_diff_guard_events(project)
    assert events[0]["filtered_n"] == 0


def test_stop_absent_transcript_filters_nothing(project: Path):
    snap_dir, _ = _settle(project)
    result = stop(project)  # no transcript_path at all
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx
    events = task_diff_guard_events(project)
    assert events[0]["filtered_n"] == 0


def test_stop_unreadable_transcript_path_filters_nothing(project: Path):
    snap_dir, _ = _settle(project)
    result = stop(project, transcript_path=project / "does-not-exist.jsonl")
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx


def test_stop_corrupt_transcript_filters_nothing(project: Path):
    snap_dir, _ = _settle(project)
    transcript = project / "corrupt.jsonl"
    transcript.write_text("{not json\nnot-json-either\n", encoding="utf-8")
    result = stop(project, transcript_path=transcript)
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx


# ── SGH-1 T7-prep regression: matcher must accept the runtime's real dispatch tool name ──

def test_agent_dispatch_end_to_end_surfaces_protected_edit(project: Path):
    pre(project, tool_name="Agent")
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: original\n", encoding="utf-8")
    post(project, tool_name="Agent")
    result = stop(project)
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx
    assert "+ - [x] T1: original" in ctx


@pytest.mark.parametrize("config_file", ["settings-template.json", "enforced-rules.json"])
def test_matcher_config_accepts_both_task_and_agent(config_file: str):
    text = (REPO_ROOT / "hooks" / config_file).read_text(encoding="utf-8")
    config = json.loads(text)
    if config_file == "enforced-rules.json":
        matchers = {
            r["matcher"] for r in config["rules"]
            if r["hook_file"] == "task-diff-guard.js" and r["event"] != "Stop"
        }
    else:
        blocks = config["hooks"]["PreToolUse"] + config["hooks"]["PostToolUse"]
        matchers = {
            b["matcher"] for b in blocks
            if any("task-diff-guard.js" in h.get("command", "") for h in b["hooks"])
        }
    assert matchers == {"Task|Agent"}, f"{config_file}: task-diff-guard Pre/Post matcher(s) {matchers}"
