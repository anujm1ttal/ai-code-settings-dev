"""Fixture-driven tests for scripts/gate_telemetry.py — LH-3 T1c/T5 (M2).

Uses synthetic gate_events.jsonl content (tmp_path) rather than a real
Artifacts/.agent/ log so counts are deterministic and independent of any
session's actual hook activity.
"""

import json
from pathlib import Path

import gate_telemetry as gt

FIXTURE_EVENTS = [
    {"ts": "2026-07-01T10:00:00.000Z", "hook": "guard-paths", "event": "PreToolUse", "decision": "deny", "tool": "Write", "ruleId": "guard-paths"},
    {"ts": "2026-07-02T11:00:00.000Z", "hook": "guard-paths", "event": "PreToolUse", "decision": "deny", "tool": "Edit", "ruleId": "guard-paths"},
    {"ts": "2026-07-03T12:00:00.000Z", "hook": "auto-lint", "event": "PostToolUse", "decision": "nag", "tool": "Edit", "ruleId": "auto-lint"},
    {"ts": "2026-07-04T13:00:00.000Z", "hook": "evidence-gate", "event": "Stop", "decision": "nag", "tool": None, "ruleId": "evidence-gate"},
    {"ts": "2026-07-05T14:00:00.000Z", "hook": "evidence-gate", "event": "Stop", "decision": "nag", "tool": None, "ruleId": "evidence-gate"},
]


def _write_events(path: Path, events: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(e) for e in events) + "\n", encoding="utf-8")


def test_parse_events_skips_malformed_lines(tmp_path: Path):
    events_file = tmp_path / "gate_events.jsonl"
    events_file.write_text(
        json.dumps(FIXTURE_EVENTS[0]) + "\nnot valid json {{{\n\n" + json.dumps(FIXTURE_EVENTS[1]) + "\n",
        encoding="utf-8",
    )
    events = gt.parse_events(events_file)
    assert len(events) == 2


def test_parse_events_missing_file_returns_empty():
    assert gt.parse_events(Path("/nonexistent/gate_events.jsonl")) == []


def test_aggregate_correct_counts_on_fixture():
    stats = gt.aggregate(FIXTURE_EVENTS)
    by_hook = {s.hook: s for s in stats}

    assert by_hook["guard-paths"].deny_count == 2
    assert by_hook["guard-paths"].nag_count == 0
    assert by_hook["guard-paths"].last_fired == "2026-07-02T11:00:00.000Z"

    assert by_hook["auto-lint"].deny_count == 0
    assert by_hook["auto-lint"].nag_count == 1

    assert by_hook["evidence-gate"].deny_count == 0
    assert by_hook["evidence-gate"].nag_count == 2
    assert by_hook["evidence-gate"].last_fired == "2026-07-05T14:00:00.000Z"


def test_aggregate_sorted_by_hook_name():
    stats = gt.aggregate(FIXTURE_EVENTS)
    hooks = [s.hook for s in stats]
    assert hooks == sorted(hooks)


def test_filter_since_excludes_earlier_events():
    since_ts = gt.datetime.fromisoformat("2026-07-03").timestamp()
    filtered = gt.filter_since(FIXTURE_EVENTS, since_ts)
    hooks = {e["hook"] for e in filtered}
    assert hooks == {"auto-lint", "evidence-gate"}
    assert len(filtered) == 3


def test_filter_since_drops_unparseable_timestamps():
    events = [{"ts": "not-a-date", "hook": "x", "decision": "deny"}]
    since_ts = gt.datetime.fromisoformat("2026-01-01").timestamp()
    assert gt.filter_since(events, since_ts) == []


def test_main_end_to_end_on_fixture_file(tmp_path: Path, capsys):
    events_file = tmp_path / "gate_events.jsonl"
    _write_events(events_file, FIXTURE_EVENTS)

    # main() reads argv via argparse — swap sys.argv for the duration of the call.
    import sys

    old_argv = sys.argv
    try:
        sys.argv = ["gate_telemetry.py", str(events_file), "--json"]
        rc = gt.main()
    finally:
        sys.argv = old_argv

    assert rc == 0
    out = json.loads(capsys.readouterr().out)
    by_hook = {row["hook"]: row for row in out}
    assert by_hook["guard-paths"]["deny_count"] == 2
    assert by_hook["evidence-gate"]["nag_count"] == 2


def test_main_no_events_file_reports_empty(capsys):
    import sys

    old_argv = sys.argv
    try:
        sys.argv = ["gate_telemetry.py", "/nonexistent/gate_events.jsonl"]
        rc = gt.main()
    finally:
        sys.argv = old_argv

    assert rc == 0
    assert "No gate events found." in capsys.readouterr().out


def test_main_invalid_since_returns_exit_2(tmp_path: Path):
    events_file = tmp_path / "gate_events.jsonl"
    _write_events(events_file, FIXTURE_EVENTS)
    import sys

    old_argv = sys.argv
    try:
        sys.argv = ["gate_telemetry.py", str(events_file), "--since", "not-a-date"]
        rc = gt.main()
    finally:
        sys.argv = old_argv

    assert rc == 2
