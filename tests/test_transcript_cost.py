"""Tests for scripts/transcript_cost.py -- per-category tool-call cost from transcript JSONL.

Fixture is a tiny synthetic transcript written to tmp_path. Presence control per
`testing-strategy.md` Oracle Discipline: the `Artifacts/Temp/` redirect MUST land in
`evidence-files`, proving the probe can see the category it is used to measure.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from transcript_cost import (
    CATEGORIES,
    analyze_paths,
    categorize,
    collect_paths,
    format_table,
    main,
)

EVIDENCE_CMD = "python -m pytest tests -v > Artifacts/Temp/x.txt 2>&1"


def _assistant(msg_id: str, out_tokens: int, *uses: tuple[str, str, dict]) -> dict:
    return {
        "type": "assistant",
        "message": {
            "id": msg_id,
            "usage": {"output_tokens": out_tokens},
            "content": [
                {"type": "tool_use", "id": uid, "name": name, "input": inp}
                for uid, name, inp in uses
            ],
        },
    }


def _result(use_id: str, text: str) -> dict:
    return {
        "type": "user",
        "message": {
            "content": [{"type": "tool_result", "tool_use_id": use_id, "content": text}]
        },
    }


def _write_jsonl(path: Path, rows: list[dict]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")
    return path


@pytest.fixture
def transcript(tmp_path: Path) -> Path:
    rows = [
        _assistant("m1", 100, ("t1", "Bash", {"command": EVIDENCE_CMD})),
        _result("t1", "x" * 50),
        _assistant("m2", 40, ("t2", "Read", {"file_path": "C:\\proj\\Artifacts\\TODO.md"})),
        _result("t2", "y" * 300),
        _assistant("m3", 60, ("t3", "Edit", {"file_path": "/proj/src/mod.py"})),
        _result("t3", "ok"),
    ]
    return _write_jsonl(tmp_path / "session.jsonl", rows)


def test_counts_per_category(transcript: Path) -> None:
    stats = analyze_paths([transcript])
    assert stats["evidence-files"]["calls"] == 1
    assert stats["state-docs"]["calls"] == 1
    assert stats["code"]["calls"] == 1
    assert sum(v["calls"] for v in stats.values()) == 3


def test_presence_control_temp_redirect_is_evidence(transcript: Path) -> None:
    # If this fails the probe is blind to the very category it measures.
    assert analyze_paths([transcript])["evidence-files"]["calls"] > 0
    assert categorize("Bash", {"command": EVIDENCE_CMD}) == "evidence-files"


def test_result_bytes_and_output_tokens_attributed(transcript: Path) -> None:
    stats = analyze_paths([transcript])
    assert stats["evidence-files"]["result_bytes"] == 50
    assert stats["state-docs"]["result_bytes"] == 300
    assert stats["evidence-files"]["out_tokens"] == pytest.approx(100)
    assert stats["code"]["out_tokens"] == pytest.approx(60)


def test_output_tokens_split_across_parallel_tool_uses(tmp_path: Path) -> None:
    rows = [
        _assistant(
            "m1",
            90,
            ("a", "Read", {"file_path": "Artifacts/TODO.md"}),
            ("b", "Edit", {"file_path": "x.py"}),
        )
    ]
    stats = analyze_paths([_write_jsonl(tmp_path / "s.jsonl", rows)])
    assert stats["state-docs"]["out_tokens"] == pytest.approx(45)
    assert stats["code"]["out_tokens"] == pytest.approx(45)


def test_duplicate_assistant_rows_counted_once(tmp_path: Path) -> None:
    row = _assistant("m1", 10, ("a", "Edit", {"file_path": "x.py"}))
    stats = analyze_paths([_write_jsonl(tmp_path / "s.jsonl", [row, row])])
    assert stats["code"]["calls"] == 1


@pytest.mark.parametrize(
    ("name", "inp", "expected"),
    [
        ("Agent", {"prompt": "go"}, "subagent-dispatch"),
        ("Task", {}, "subagent-dispatch"),
        ("Read", {"file_path": "Artifacts/Evidence/P1/a.txt"}, "evidence-files"),
        ("Read", {"file_path": "Artifacts/DECISION_LOG.md"}, "state-docs"),
        ("Read", {"file_path": "Artifacts/Misc/notes.md"}, "artifacts-other"),
        ("Bash", {"command": "git commit -m x"}, "git"),
        ("Bash", {"command": "python -m pytest tests"}, "tests"),
        ("Write", {"file_path": "src/app.ts"}, "code"),
        ("Grep", {"pattern": "x"}, "other"),
    ],
)
def test_categorize(name: str, inp: dict, expected: str) -> None:
    assert categorize(name, inp) == expected


def test_categorize_does_not_mutate_input() -> None:
    inp = {"command": "git status"}
    categorize("Bash", inp)
    assert inp == {"command": "git status"}


def test_collect_paths_includes_subagents(tmp_path: Path) -> None:
    main_t = _write_jsonl(tmp_path / "sess1.jsonl", [])
    sub_t = _write_jsonl(tmp_path / "sess1" / "subagents" / "agent-a.jsonl", [])
    (tmp_path / "notes.txt").write_text("ignore", encoding="utf-8")
    assert set(collect_paths([tmp_path])) == {main_t, sub_t}


def test_collect_paths_rejects_missing(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match="nope"):
        collect_paths([tmp_path / "nope.jsonl"])


def test_malformed_line_skipped(tmp_path: Path) -> None:
    p = tmp_path / "s.jsonl"
    good = json.dumps(_assistant("m1", 5, ("a", "Edit", {"file_path": "x.py"})))
    p.write_text("not json\n" + good + "\n", encoding="utf-8")
    assert analyze_paths([p])["code"]["calls"] == 1


def test_format_table_lists_every_category(transcript: Path) -> None:
    table = format_table(analyze_paths([transcript]))
    for cat in CATEGORIES:
        assert cat in table
    assert "evidence-files" in table and "33.3" in table  # 1 of 3 calls


def test_main_prints_table(transcript: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main([str(transcript)]) == 0
    assert "evidence-files" in capsys.readouterr().out


def test_main_missing_path_exits_nonzero(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    assert main([str(tmp_path / "nope.jsonl")]) == 2
    assert "nope" in capsys.readouterr().err
