"""Tests for scripts/todo_graph.py — task-dependency graph validator.

Covers the four checks (cycle, unknown blocker, malformed, redundant-edge advisory),
the blind-zero guard, the exit-code contract, and the read-only Hard Rule.

Presence control per `testing-strategy.md` §Oracle Discipline: synthetic fixtures pin
exact counts; live phase TODOs assert `> 0` only, because those files change as work
proceeds and a pinned count would rot into a false failure.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from todo_graph import (
    SEVERITY_ADVISORY,
    SEVERITY_VIOLATION,
    Report,
    check_redundant_edges,
    find_cycle,
    format_report,
    main,
    parse_tasks,
    validate,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
FROZEN_IGH1 = Path(__file__).resolve().parent / "fixtures" / "igh1-todo-frozen.md"
LIVE_PLANS_DIR = REPO_ROOT / "Artifacts" / "Plans"

HEADER = "# Phase TODO\n\nStatus: `[ ]` not started\n\n---\n\n"


def write(tmp_path: Path, body: str) -> Path:
    path = tmp_path / "X-1-TODO.md"
    path.write_text(HEADER + body, encoding="utf-8")
    return path


def codes(report: Report, severity: str) -> list[str]:
    return [f.code for f in report.findings if f.severity == severity]


# --------------------------------------------------------------------------- parsing


def test_parses_full_grammar() -> None:
    line = "- [x] [coder] T2: Do a thing — Success: exit 0 — Mode: AFK — Blocked by: T1\n"
    (task,) = parse_tasks(line)
    assert task.task_id == "T2"
    assert task.status == "x"
    assert task.agent == "coder"
    assert task.mode == "AFK"
    assert task.blockers == ("T1",)


def test_id_mode_and_blockers_are_all_optional() -> None:
    """orchestration.md: a task without Tn:/Mode:/Blocked by: is fully valid."""
    (task,) = parse_tasks("- [ ] [auditor] Verify the thing — Success: metric\n")
    assert task.task_id is None
    assert task.mode is None
    assert task.blockers == ()
    assert task.agent == "auditor"


def test_parses_multiple_blockers() -> None:
    (task,) = parse_tasks("- [ ] [coder] T4: Fan-in — Mode: AFK — Blocked by: T2, T3\n")
    assert task.blockers == ("T2", "T3")


def test_ignores_non_task_bullets_and_indented_lines() -> None:
    text = (
        "- [ ] [coder] T1: Real task\n"
        "- **Not a task** — prose bullet\n"
        "  - [ ] [coder] T9: indented sub-bullet, not a task line\n"
        "1. Numbered hard rule\n"
    )
    tasks = parse_tasks(text)
    assert [t.task_id for t in tasks] == ["T1"]


def test_list_order_is_recorded() -> None:
    text = "- [ ] [coder] T1: a\n- [ ] [coder] T2: b\n- [ ] [coder] T3: c\n"
    assert [t.order for t in parse_tasks(text)] == [0, 1, 2]


# --------------------------------------------------------------------------- cycle


def test_detects_two_node_cycle_and_names_both_ids(tmp_path: Path) -> None:
    path = write(
        tmp_path,
        "- [ ] [coder] T1: a — Blocked by: T2\n- [ ] [coder] T2: b — Blocked by: T1\n",
    )
    report = validate(path)
    assert "CYCLE" in codes(report, SEVERITY_VIOLATION)
    (cycle,) = [f for f in report.violations if f.code == "CYCLE"]
    assert "T1" in cycle.message and "T2" in cycle.message


def test_detects_three_node_cycle() -> None:
    text = (
        "- [ ] [coder] T1: a — Blocked by: T3\n"
        "- [ ] [coder] T2: b — Blocked by: T1\n"
        "- [ ] [coder] T3: c — Blocked by: T2\n"
    )
    assert set(find_cycle(parse_tasks(text))) == {"T1", "T2", "T3"}


def test_acyclic_diamond_is_not_a_cycle() -> None:
    text = (
        "- [ ] [coder] T1: root\n"
        "- [ ] [coder] T2: left — Blocked by: T1\n"
        "- [ ] [coder] T3: right — Blocked by: T1\n"
        "- [ ] [coder] T4: join — Blocked by: T2, T3\n"
    )
    assert find_cycle(parse_tasks(text)) == ()


# --------------------------------------------------------------------------- unknown ID


def test_unknown_blocker_is_a_violation_and_names_the_id(tmp_path: Path) -> None:
    path = write(tmp_path, "- [ ] [coder] T1: a\n- [ ] [coder] T2: b — Blocked by: T99\n")
    report = validate(path)
    assert "UNKNOWN_BLOCKER" in codes(report, SEVERITY_VIOLATION)
    assert any("T99" in f.message for f in report.violations)


# --------------------------------------------------------------------------- malformed


def test_bad_status_marker_is_a_violation(tmp_path: Path) -> None:
    path = write(tmp_path, "- [ ] [coder] T1: fine\n- [?] [coder] T2: bad status\n")
    assert "MALFORMED_STATUS" in codes(validate(path), SEVERITY_VIOLATION)


def test_missing_agent_field_is_a_violation(tmp_path: Path) -> None:
    path = write(tmp_path, "- [ ] [coder] T1: fine\n- [ ] T2: no agent field\n")
    assert "MISSING_AGENT" in codes(validate(path), SEVERITY_VIOLATION)


# --------------------------------------------------------------------------- blind-zero guard


def test_non_empty_file_with_no_tasks_is_a_violation(tmp_path: Path) -> None:
    """HR2: reporting 'clean' on an unparsed file is the false negative to prevent."""
    path = tmp_path / "X-1-TODO.md"
    path.write_text("# Phase TODO\n\nProse only, no task lines.\n", encoding="utf-8")
    assert "EMPTY_PARSE" in codes(validate(path), SEVERITY_VIOLATION)


def test_truly_empty_file_is_not_a_violation(tmp_path: Path) -> None:
    path = tmp_path / "X-1-TODO.md"
    path.write_text("", encoding="utf-8")
    assert validate(path).has_violations is False


# --------------------------------------------------------------------------- redundant edge


def test_redundant_edge_is_advisory_not_violation(tmp_path: Path) -> None:
    path = write(tmp_path, "- [ ] [coder] T1: a\n- [ ] [coder] T2: b — Blocked by: T1\n")
    report = validate(path)
    assert codes(report, SEVERITY_ADVISORY) == ["REDUNDANT_EDGE"]
    assert report.has_violations is False


def test_non_adjacent_blocker_is_not_flagged() -> None:
    """T3 depending on T1 diverges from list order — the clause earns its place."""
    text = (
        "- [ ] [coder] T1: a\n"
        "- [ ] [coder] T2: b\n"
        "- [ ] [coder] T3: c — Blocked by: T1\n"
    )
    assert check_redundant_edges(parse_tasks(text)) == ()


def test_multi_blocker_fan_in_is_not_flagged() -> None:
    text = (
        "- [ ] [coder] T1: a\n"
        "- [ ] [coder] T2: b\n"
        "- [ ] [coder] T3: c — Blocked by: T1, T2\n"
    )
    assert check_redundant_edges(parse_tasks(text)) == ()


def test_first_task_is_never_flagged() -> None:
    assert check_redundant_edges(parse_tasks("- [ ] [coder] T1: a — Blocked by: T0\n")) == ()


# --------------------------------------------------------------------------- frozen regression


def test_frozen_igh1_fixture_exists() -> None:
    assert FROZEN_IGH1.is_file(), "frozen IGH-1 regression fixture is missing"


def test_frozen_igh1_parses_to_pinned_counts() -> None:
    """Presence control: exact counts, because the fixture is frozen and cannot drift."""
    report = validate(FROZEN_IGH1)
    assert len(report.tasks) == 5
    assert report.edge_count == 4
    assert [t.task_id for t in report.tasks] == ["T1", "T2", "T3", "T4", "T5"]


def test_frozen_igh1_yields_exactly_four_redundant_advisories() -> None:
    """M4 — the confirmed live defect that passed a full auditor gate."""
    report = validate(FROZEN_IGH1)
    advisories = [f for f in report.findings if f.code == "REDUNDANT_EDGE"]
    assert len(advisories) == 4
    assert all(f.severity == SEVERITY_ADVISORY for f in advisories)
    for task_id in ("T2", "T3", "T4", "T5"):
        assert any(f.message.startswith(f"{task_id}:") for f in advisories)


def test_frozen_igh1_has_no_violations() -> None:
    """Advisories must never change the exit code."""
    assert validate(FROZEN_IGH1).has_violations is False


# --------------------------------------------------------------------------- live presence control


@pytest.mark.parametrize("todo", sorted(LIVE_PLANS_DIR.glob("*-TODO.md")), ids=lambda p: p.name)
def test_live_phase_todos_parse_to_at_least_one_task(todo: Path) -> None:
    """No pinned counts — live files change. Only the blind zero is forbidden."""
    assert len(validate(todo).tasks) > 0


def test_live_plans_dir_is_not_empty() -> None:
    """Control for the parametrised test above: zero files would vacuously pass it."""
    assert len(list(LIVE_PLANS_DIR.glob("*-TODO.md"))) >= 6


# --------------------------------------------------------------------------- read-only (HR1)


def test_validate_never_mutates_the_file(tmp_path: Path) -> None:
    """HR1 — the tool reports; it never edits, marks, or rotates."""
    path = write(tmp_path, "- [ ] [coder] T1: a\n- [ ] [coder] T2: b — Blocked by: T1\n")
    before = path.read_bytes()
    validate(path)
    format_report(validate(path))
    assert path.read_bytes() == before


def test_source_contains_no_write_calls() -> None:
    """M1 — static proof the tool cannot mutate state."""
    source = (REPO_ROOT / "scripts" / "todo_graph.py").read_text(encoding="utf-8")
    for forbidden in ("write_text(", "unlink(", "os.remove", "shutil."):
        assert forbidden not in source, f"todo_graph.py must not call {forbidden}"


def test_source_has_zero_repo_imports() -> None:
    """M1 — stdlib only, so the tool stays copyable into any project."""
    source = (REPO_ROOT / "scripts" / "todo_graph.py").read_text(encoding="utf-8")
    stdlib = {"__future__", "dataclasses", "pathlib", "argparse", "re", "sys"}
    for line in source.splitlines():
        if line.startswith(("import ", "from ")):
            module = line.split()[1].split(".")[0]
            assert module in stdlib, f"non-stdlib import: {line}"


# --------------------------------------------------------------------------- CLI contract


def test_cli_exits_1_on_violation(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = write(tmp_path, "- [ ] [coder] T1: a — Blocked by: T99\n")
    monkeypatch.setattr("sys.argv", ["todo_graph.py", str(path)])
    assert main() == 1


def test_cli_exits_0_on_advisories_only(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = write(tmp_path, "- [ ] [coder] T1: a\n- [ ] [coder] T2: b — Blocked by: T1\n")
    monkeypatch.setattr("sys.argv", ["todo_graph.py", str(path)])
    assert main() == 0


def test_cli_exits_0_when_no_phase_todos_exist(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A project with no phase TODOs has no graph — not a violation."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("sys.argv", ["todo_graph.py"])
    assert main() == 0


def test_violations_only_suppresses_advisory_output(tmp_path: Path) -> None:
    path = write(tmp_path, "- [ ] [coder] T1: a\n- [ ] [coder] T2: b — Blocked by: T1\n")
    report = validate(path)
    assert format_report(report, violations_only=True) == ""
    assert "ADVISORY" in format_report(report, violations_only=False)
