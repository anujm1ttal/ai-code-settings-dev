"""Shell smoke tests for hooks/task-diff-guard.js — SGH-1b T10 (settle-at-Stop
redesign). Supersedes the SGH-1 T1 PostToolUse-diff test suite: PostToolUse now
only stamps a manifest (no diff/output/delete); Stop does the settling. See
`Artifacts/Plans/SGH-1-Plan.md` §SGH-1b for the D1/D2/D3 root cause and the
Stop-based fix this suite verifies.

Extended for SGH-1c T12d (D4 fix): `status: returned` is a dispatch-LAUNCH
signal, not a completion signal, so `doStop` now gates every settle behind a
transcript-derived in-flight barrier (`SGH-1-Plan.md` §11). Most Stop-settle
tests below therefore now pass an already-notified, unrelated Agent dispatch
transcript (`open_barrier_transcript`/`open_barrier_lines`) purely to OPEN
that barrier — the barrier has no correlation to any specific manifest on
disk (global, not per-dispatch, §11.4). The barrier-closed behavior itself
(retain, `pass`/`note:'barrier'`|`'no-transcript'`) is covered by the
dedicated `test_barrier_*` section further down.

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
BARRIER_STALE_MS = 60 * 60 * 1000  # SGH-1c §11.3 wedge guard


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


# ── SGH-1c D4 barrier fixture helpers ────────────────────────────────────────
# The barrier (`hooks/task-diff-guard.js` `computeBarrier`) is GLOBAL and
# transcript-derived — it has no correlation to any specific manifest on disk
# (SGH-1-Plan.md §11.4). Every test that needs the existing (pre-SGH-1c)
# settle path to run must therefore give `doStop` a transcript naming an
# already-notified Agent/Task dispatch, or the barrier stays closed and
# nothing settles regardless of manifest status.

def _agent_dispatch_entry(tool_use_id: str, timestamp_ms: int, tool_name: str = "Agent") -> str:
    return json.dumps({
        "type": "assistant",
        "timestamp": _iso(timestamp_ms),
        "message": {"content": [{"type": "tool_use", "id": tool_use_id, "name": tool_name, "input": {"description": "x"}}]},
    })


def _notification_entry(tool_use_id: str, timestamp_ms: int, task_id: str = "atask0001") -> str:
    content = (
        f"<task-notification>\n<task-id>{task_id}</task-id>\n"
        f"<tool-use-id>{tool_use_id}</tool-use-id>\n<status>completed</status>\n"
        "<summary>Agent finished</summary>\n</task-notification>"
    )
    return json.dumps({"type": "queue-operation", "operation": "enqueue", "timestamp": _iso(timestamp_ms), "content": content})


def open_barrier_lines(dispatch_ms: int, tool_use_id: str = "toolu_barrier_open", tool_name: str = "Agent") -> list[str]:
    """A single already-notified dispatch — opens the barrier without
    corresponding to any manifest on disk (global, not per-dispatch)."""
    return [
        _agent_dispatch_entry(tool_use_id, dispatch_ms, tool_name=tool_name),
        _notification_entry(tool_use_id, dispatch_ms + 1000),
    ]


def open_barrier_transcript(project: Path, dispatch_ms: int, tool_use_id: str = "toolu_barrier_open") -> Path:
    return write_transcript(project, open_barrier_lines(dispatch_ms, tool_use_id=tool_use_id))


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
    # IMPLEMENTATION_PLAN.md / DECISION_LOG.md do not exist in the fixture.
    # (CPI-1: AUDIT_REPORT.md retired from PROTECTED_FILES — the rolling root
    # file no longer exists; its replacement, Artifacts/Reports/<PHASE>-
    # AUDIT_REPORT.md, is covered by the pre-existing Reports glob instead.)
    pre(project)
    snaps = {p.name for p in list_snapshot_dirs(project)[0].rglob("*") if p.is_file()}
    assert "IMPLEMENTATION_PLAN.md" not in snaps
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
    dispatched_at = read_manifest(snap_dir)["dispatched_at"]
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: original\n- [ ] T2\n", encoding="utf-8")
    post(project)

    transcript = open_barrier_transcript(project, dispatched_at)  # SGH-1c: barrier must be open to settle
    result = stop(project, transcript_path=transcript)
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
    survive a Stop that has nothing settled to evaluate. Barrier open (an
    unrelated already-notified dispatch) so retention is due to the manifest's
    own `in-flight` status, not the SGH-1c barrier — see the barrier-specific
    tests below for that distinct case."""
    pre(project)
    snap_dir = list_snapshot_dirs(project)[0]
    dispatched_at = read_manifest(snap_dir)["dispatched_at"]

    transcript = open_barrier_transcript(project, dispatched_at)
    result = stop(project, transcript_path=transcript)
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
    dispatched_at = read_manifest(list_snapshot_dirs(project)[0])["dispatched_at"]
    pre(project, input_b)
    post(project, input_a)  # A settles, unchanged; B stays in-flight

    transcript = open_barrier_transcript(project, dispatched_at)
    result = stop(project, transcript_path=transcript)
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
    dispatched_at = read_manifest(list_snapshot_dirs(project)[0])["dispatched_at"]
    pre(project, input_b)
    (project / "Artifacts" / "TODO.md").write_text("changed by A\n", encoding="utf-8")
    post(project, input_a)
    (project / "Artifacts" / "BACKLOG.md").write_text("changed by B\n", encoding="utf-8")
    post(project, input_b)

    transcript = open_barrier_transcript(project, dispatched_at)
    result = stop(project, transcript_path=transcript)
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
    dispatched_at = read_manifest(list_snapshot_dirs(project)[0])["dispatched_at"]
    post(project)
    (project / "Artifacts" / "BACKLOG.md").unlink()
    transcript = open_barrier_transcript(project, dispatched_at)
    result = stop(project, transcript_path=transcript)
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

    transcript = open_barrier_transcript(project, manifest["dispatched_at"])
    result = stop(project, transcript_path=transcript)
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

    transcript = open_barrier_transcript(project, int(time.time() * 1000))
    result = stop(project, transcript_path=transcript)
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

    transcript = open_barrier_transcript(project, int(time.time() * 1000))
    result = stop(project, transcript_path=transcript)
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
    transcript = write_transcript(project, open_barrier_lines(dispatched_at) + [
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
    transcript = write_transcript(project, open_barrier_lines(dispatched_at) + [
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
    transcript = write_transcript(project, open_barrier_lines(dispatched_at) + [_bash_entry("ls", dispatched_at + 500)])
    result = stop(project, transcript_path=transcript)
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx
    events = task_diff_guard_events(project)
    assert events[0]["filtered_n"] == 0


def test_stop_absent_transcript_filters_nothing(project: Path):
    """SGH-1c supersession: pre-SGH-1c, an absent transcript meant the
    ATTRIBUTION FILTER's own fail-open direction ("surface everything") ran.
    Now the D4 barrier intercepts first — with zero Agent/Task dispatches
    findable at all, the barrier stays CLOSED (`note:'no-transcript'`) and the
    settle loop (attribution filter included) never runs. Retention is the
    fail-open direction now: never a premature settle. See the barrier-closed
    tests below for the dedicated coverage; this proves the specific
    supersession of the pre-SGH-1c "filters nothing" claim."""
    snap_dir, _ = _settle(project)
    result = stop(project)  # no transcript_path at all
    assert result.returncode == 0
    assert result.stdout.strip() == ""
    assert snap_dir.exists()  # retained, not settled
    events = task_diff_guard_events(project)
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "no-transcript"


def test_stop_unreadable_transcript_path_filters_nothing(project: Path):
    """SGH-1c supersession — see test_stop_absent_transcript_filters_nothing:
    an unreadable transcript path finds zero dispatches either, so the
    barrier stays closed and retains rather than surfacing unfiltered."""
    snap_dir, _ = _settle(project)
    result = stop(project, transcript_path=project / "does-not-exist.jsonl")
    assert result.stdout.strip() == ""
    assert snap_dir.exists()
    events = task_diff_guard_events(project)
    assert events[0]["note"] == "no-transcript"


def test_stop_corrupt_transcript_filters_nothing(project: Path):
    """SGH-1c supersession — see test_stop_absent_transcript_filters_nothing:
    every line fails to parse, so entries is empty and zero dispatches are
    found; same barrier-closed retention as the absent-transcript case."""
    snap_dir, _ = _settle(project)
    transcript = project / "corrupt.jsonl"
    transcript.write_text("{not json\nnot-json-either\n", encoding="utf-8")
    result = stop(project, transcript_path=transcript)
    assert result.stdout.strip() == ""
    assert snap_dir.exists()
    events = task_diff_guard_events(project)
    assert events[0]["note"] == "no-transcript"


# ── SGH-1 T7-prep regression: matcher must accept the runtime's real dispatch tool name ──

def test_agent_dispatch_end_to_end_surfaces_protected_edit(project: Path):
    pre(project, tool_name="Agent")
    dispatched_at = read_manifest(list_snapshot_dirs(project)[0])["dispatched_at"]
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: original\n", encoding="utf-8")
    post(project, tool_name="Agent")
    transcript = open_barrier_transcript(project, dispatched_at)
    result = stop(project, transcript_path=transcript)
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx
    assert "+ - [x] T1: original" in ctx


# ── SGH-1c D4 fix: the in-flight barrier (T12d, 7 enumerated cases) ─────────

def test_barrier_closed_when_dispatch_not_notified_d4_regression(project: Path):
    """Case 1 — D4 regression: manifest `returned`, transcript has the
    dispatch `tool_use` but NO notification -> snapshot RETAINED, no nag,
    `pass`+`note:'barrier'`+`in_flight_n:1`. This is the exact miss the probe
    (`sgh1c_d4_probe.txt`) documented: PostToolUse's `returned` stamp is not
    proof of completion."""
    pre(project)
    snap_dir = list_snapshot_dirs(project)[0]
    dispatched_at = read_manifest(snap_dir)["dispatched_at"]
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: changed\n", encoding="utf-8")
    post(project)  # manifest status -> returned (the pre-SGH-1c "settled" signal)

    transcript = write_transcript(project, [_agent_dispatch_entry("toolu_unnotified", dispatched_at + 100)])
    result = stop(project, transcript_path=transcript)
    assert result.returncode == 0
    assert result.stdout.strip() == ""  # D4 fix: no premature nag
    assert snap_dir.exists()  # retained, NOT settled/deleted
    assert read_manifest(snap_dir)["status"] == "returned"  # manifest itself untouched

    events = task_diff_guard_events(project)
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "barrier"
    assert events[0]["in_flight_n"] == 1


def test_barrier_opens_once_notification_present_then_settles(project: Path):
    """Case 2 — the SAME manifest, at a LATER Stop once the notification is
    present -> settles, diff surfaced, snapshot deleted."""
    pre(project)
    snap_dir = list_snapshot_dirs(project)[0]
    dispatched_at = read_manifest(snap_dir)["dispatched_at"]
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: changed\n", encoding="utf-8")
    post(project)

    # Stop #1: dispatched, not yet notified -> barrier closed, retained.
    transcript_1 = write_transcript(project, [_agent_dispatch_entry("toolu_later", dispatched_at + 100)])
    result_1 = stop(project, transcript_path=transcript_1)
    assert result_1.stdout.strip() == ""
    assert snap_dir.exists()

    # Stop #2: notification now present -> barrier opens -> settles.
    transcript_2 = write_transcript(project, [
        _agent_dispatch_entry("toolu_later", dispatched_at + 100),
        _notification_entry("toolu_later", dispatched_at + 5000),
    ])
    result_2 = stop(project, transcript_path=transcript_2)
    ctx = json.loads(result_2.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx
    assert not snap_dir.exists()

    events = task_diff_guard_events(project)
    assert len(events) == 2
    assert events[0]["decision"] == "pass" and events[0]["note"] == "barrier"
    assert events[1]["decision"] == "nag"


def test_barrier_is_global_mixed_notified_and_unnotified_blocks_both(project: Path):
    """Case 3 — mixed: A notified, B not -> NEITHER settles (global barrier,
    SGH-1-Plan.md §11.4 — settling A while B is in flight would re-open the
    D1 interleave)."""
    input_a = {"subagent_type": "coder", "description": "A", "prompt": "a"}
    input_b = {"subagent_type": "auditor", "description": "B", "prompt": "b"}
    pre(project, input_a)
    dir_a = list_snapshot_dirs(project)[0]
    dispatched_at_a = read_manifest(dir_a)["dispatched_at"]
    (project / "Artifacts" / "TODO.md").write_text("changed by A\n", encoding="utf-8")
    post(project, input_a)

    pre(project, input_b)
    dir_b = [d for d in list_snapshot_dirs(project) if d != dir_a][0]
    (project / "Artifacts" / "BACKLOG.md").write_text("changed by B\n", encoding="utf-8")
    post(project, input_b)

    transcript = write_transcript(project, [
        _agent_dispatch_entry("toolu_a", dispatched_at_a + 10),
        _notification_entry("toolu_a", dispatched_at_a + 20),
        _agent_dispatch_entry("toolu_b", dispatched_at_a + 30),  # NOT notified
    ])
    result = stop(project, transcript_path=transcript)
    assert result.returncode == 0
    assert result.stdout.strip() == ""  # global barrier: neither settles
    assert dir_a.exists()
    assert dir_b.exists()

    events = task_diff_guard_events(project)
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "barrier"
    assert events[0]["in_flight_n"] == 1


def test_barrier_stale_unnotified_dispatch_does_not_block(project: Path):
    """Case 4 — staleness: a dispatch entry older than BARRIER_STALE_MS with
    no notification does NOT block; `stale_in_flight_n:1`; settle proceeds
    (SGH-1-Plan.md §11.3 wedge guard — a never-notified dispatch must not
    hold the barrier closed for the rest of the session)."""
    pre(project)
    snap_dir = list_snapshot_dirs(project)[0]
    dispatched_at = read_manifest(snap_dir)["dispatched_at"]
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: changed\n", encoding="utf-8")
    post(project)

    stale_dispatch_ms = dispatched_at - (BARRIER_STALE_MS + 60_000)
    transcript = write_transcript(project, [_agent_dispatch_entry("toolu_stale", stale_dispatch_ms)])
    result = stop(project, transcript_path=transcript)
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx  # settle proceeded despite the stale, never-notified dispatch
    assert not snap_dir.exists()

    events = task_diff_guard_events(project)
    assert len(events) == 1
    assert events[0]["decision"] == "nag"
    assert events[0]["stale_in_flight_n"] == 1


def test_barrier_no_transcript_retains_everything(project: Path):
    """Case 5 — unreadable/empty transcript -> retain + `pass`/
    `note:'no-transcript'`, nothing deleted. (See also the three
    `test_stop_*_filters_nothing` supersession tests above for the absent /
    unreadable-path / corrupt-content variants of this same case.)"""
    pre(project)
    snap_dir = list_snapshot_dirs(project)[0]
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: changed\n", encoding="utf-8")
    post(project)

    result = stop(project)  # no transcript_path at all
    assert result.returncode == 0
    assert result.stdout.strip() == ""
    assert snap_dir.exists()

    events = task_diff_guard_events(project)
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "no-transcript"


def test_barrier_ignores_unrelated_background_notification_no_crash(project: Path):
    """Case 6 — a background-Bash task-notification is present but there is
    no matching Agent/Task dispatch for its id -> ignored, no crash, no
    effect on the real dispatch's own settle outcome."""
    pre(project)
    snap_dir = list_snapshot_dirs(project)[0]
    dispatched_at = read_manifest(snap_dir)["dispatched_at"]
    (project / "Artifacts" / "TODO.md").write_text("- [x] T1: changed\n", encoding="utf-8")
    post(project)

    transcript = write_transcript(project, [
        _agent_dispatch_entry("toolu_real", dispatched_at + 10),
        _notification_entry("toolu_real", dispatched_at + 20),
        _notification_entry("toolu_bash_bg", dispatched_at + 30),  # unrelated background task
    ])
    result = stop(project, transcript_path=transcript)
    assert result.returncode == 0
    ctx = json.loads(result.stdout)["hookSpecificOutput"]["additionalContext"]
    assert "Artifacts/TODO.md" in ctx
    assert not snap_dir.exists()


def test_barrier_closed_ttl_sweep_still_runs(project: Path):
    """Case 7 — TTL sweep still runs while the barrier is closed: a stale
    manifest is swept even though a different, recent, un-notified dispatch
    is holding the barrier closed."""
    pre(project)  # dispatch 1: stays in-flight, holds the barrier closed
    dir_blocking = list_snapshot_dirs(project)[0]
    dispatched_at = read_manifest(dir_blocking)["dispatched_at"]

    pre(project)  # dispatch 2: backdated past TTL_MS
    dir_stale = [d for d in list_snapshot_dirs(project) if d != dir_blocking][0]
    manifest_stale = read_manifest(dir_stale)
    manifest_stale["dispatched_at"] -= (TTL_MS + 60_000)
    write_manifest(dir_stale, manifest_stale)

    transcript = write_transcript(project, [_agent_dispatch_entry("toolu_blocking", dispatched_at + 10)])  # not notified
    result = stop(project, transcript_path=transcript)
    assert result.returncode == 0
    assert result.stdout.strip() == ""
    assert dir_blocking.exists()       # blocked by barrier, retained
    assert not dir_stale.exists()      # TTL-swept despite the barrier being closed

    events = task_diff_guard_events(project)
    assert len(events) == 1
    assert events[0]["decision"] == "pass"
    assert events[0]["note"] == "barrier"
    assert events[0]["in_flight_n"] == 1


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
