"""Tests for scripts/backlog_audit.py — BACKLOG lifecycle checker.

Covers the four checks (size, rotation-due, unmarked, phase-dump), status
classification precedence, and exit-code contract.
"""

from __future__ import annotations

from pathlib import Path

import pytest

import backlog_audit
from backlog_audit import (
    MAX_ENTRIES,
    MAX_LINES,
    STATUS_OPEN,
    STATUS_RESOLVED,
    STATUS_UNMARKED,
    audit,
    format_report,
    parse_entries,
)


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "BACKLOG.md"
    path.write_text(text, encoding="utf-8")
    return path


# --------------------------------------------------------------------------- parsing


def test_parse_entries_counts_h2_sections() -> None:
    text = "# BACKLOG\n\n## `a_1` — first\n\nbody\n\n## `b_2` — second\n\nbody\n"
    entries = parse_entries(text)
    assert len(entries) == 2
    assert [e.label for e in entries] == ["a_1", "b_2"]


def test_parse_entries_ignores_h3_and_h1() -> None:
    text = "# Title\n\n## `a_1` — entry\n\n### subsection\n\n#### deeper\n"
    assert len(parse_entries(text)) == 1


def test_label_falls_back_to_title_when_no_backticked_id() -> None:
    entries = parse_entries("## plain heading with no id\n\nbody\n")
    assert entries[0].label.startswith("plain heading")


# ------------------------------------------------------------------- classification


@pytest.mark.parametrize(
    "heading",
    [
        "## ~~`a_1` — struck~~ — RESOLVED",
        "## `a_1` — thing — RESOLVED",
        "## `a_1` — thing — CLOSED (by design)",
        "## `a_1` — thing — GRADUATED to LH",
    ],
)
def test_heading_markers_classify_resolved(heading: str) -> None:
    entries = parse_entries(f"{heading}\n\nbody text\n")
    assert entries[0].status == STATUS_RESOLVED


def test_body_status_marker_classifies_resolved() -> None:
    text = "## `a_1` — thing\n\n**Status:** RESOLVED · **Severity:** LOW\n"
    assert parse_entries(text)[0].status == STATUS_RESOLVED


def test_explicit_open_marker_classifies_open() -> None:
    text = "## `a_1` — thing\n\n**Status:** OPEN · **Severity:** MEDIUM\n"
    assert parse_entries(text)[0].status == STATUS_OPEN


def test_entry_without_marker_is_unmarked() -> None:
    text = "## `a_1` — thing\n\n**Filed:** 2026-07-24 · **Severity:** MEDIUM\n\nSome prose.\n"
    assert parse_entries(text)[0].status == STATUS_UNMARKED


def test_explicit_open_marker_wins_over_resolved_prose_in_body() -> None:
    """An OPEN entry may legitimately discuss a RESOLVED sibling without becoming RESOLVED."""
    text = (
        "## `a_1` — thing\n\n"
        "**Status:** OPEN · **Severity:** LOW\n\n"
        "Superseded by `b_2`, which was RESOLVED in Phase 3.\n"
    )
    assert parse_entries(text)[0].status == STATUS_OPEN


def test_heading_marker_wins_over_body() -> None:
    """Heading is checked first — a RESOLVED heading is not overridden by body prose."""
    text = "## `a_1` — thing — RESOLVED\n\n**Status:** OPEN\n"
    assert parse_entries(text)[0].status == STATUS_RESOLVED


# ----------------------------------------------------------------------- phase dumps


def test_phase_dump_heading_detected() -> None:
    text = "## 5c. gBlox upstream-schema audit (2026-07-10) — findings here\n\nbody\n"
    assert parse_entries(text)[0].is_phase_dump is True


def test_numbered_findings_section_detected() -> None:
    text = "## 19. Phase F1 findings (2026-07-24) — option-injection close\n\nbody\n"
    assert parse_entries(text)[0].is_phase_dump is True


def test_normal_entry_is_not_phase_dump() -> None:
    text = "## `rdt_graduate-source-vs-deployed_1` — /graduate resolves wrong dir\n\nbody\n"
    assert parse_entries(text)[0].is_phase_dump is False


# ---------------------------------------------------------------------------- report


def test_clean_file_has_no_violations(tmp_path: Path) -> None:
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n"
    report = audit(write(tmp_path, text))
    assert report.has_violations is False
    assert report.over_size is False


def test_over_entry_count_is_a_violation(tmp_path: Path) -> None:
    entries = "".join(
        f"## `e_{i}` — thing {i}\n\n**Status:** OPEN\n\n" for i in range(MAX_ENTRIES + 1)
    )
    report = audit(write(tmp_path, f"# BACKLOG\n\n{entries}"))
    assert report.over_size is True
    assert report.has_violations is True


def test_over_line_count_is_a_violation(tmp_path: Path) -> None:
    body = "\n".join(f"filler line {i}" for i in range(MAX_LINES + 5))
    report = audit(write(tmp_path, f"# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n{body}\n"))
    assert report.over_size is True


def test_resolved_entries_are_not_a_violation_under_threshold(tmp_path: Path) -> None:
    """Rotation triggers on size — a small file may hold RESOLVED entries."""
    text = "# BACKLOG\n\n## `a_1` — thing — RESOLVED\n\nbody\n"
    report = audit(write(tmp_path, text))
    assert report.resolved
    assert report.rotation_due == ()
    assert report.has_violations is False


def test_resolved_entries_become_rotation_due_over_threshold(tmp_path: Path) -> None:
    entries = "".join(
        f"## `e_{i}` — thing {i} — RESOLVED\n\nbody\n\n" for i in range(MAX_ENTRIES + 1)
    )
    report = audit(write(tmp_path, f"# BACKLOG\n\n{entries}"))
    assert len(report.rotation_due) == MAX_ENTRIES + 1
    assert report.has_violations is True


def test_unmarked_entry_is_a_violation(tmp_path: Path) -> None:
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Filed:** 2026-07-24\n"
    report = audit(write(tmp_path, text))
    assert len(report.unmarked) == 1
    assert report.has_violations is True


def test_phase_dump_is_a_violation(tmp_path: Path) -> None:
    text = "# BACKLOG\n\n## 7. Phase P3a findings (2026-07-14) — close\n\n**Status:** OPEN\n"
    report = audit(write(tmp_path, text))
    assert len(report.phase_dumps) == 1
    assert report.has_violations is True


# ------------------------------------------------------------------------ formatting


def test_violations_only_suppresses_clean_output(tmp_path: Path) -> None:
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n"
    report = audit(write(tmp_path, text))
    assert format_report(report, violations_only=True) == ""
    assert "clean" in format_report(report, violations_only=False)


def test_report_names_offending_ids(tmp_path: Path) -> None:
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Filed:** 2026-07-24\n"
    rendered = format_report(audit(write(tmp_path, text)))
    assert "a_1" in rendered
    assert "VIOLATION" in rendered


# ------------------------------------------------------------------------ exit codes


def test_main_returns_zero_on_clean_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = write(tmp_path, "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n")
    monkeypatch.setattr("sys.argv", ["backlog_audit.py", str(path)])
    assert backlog_audit.main() == 0


def test_main_returns_one_on_violation(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = write(tmp_path, "# BACKLOG\n\n## `a_1` — thing\n\n**Filed:** today\n")
    monkeypatch.setattr("sys.argv", ["backlog_audit.py", str(path)])
    assert backlog_audit.main() == 1


def test_main_returns_zero_when_backlog_absent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A project with no deferred work has no BACKLOG — not a violation."""
    missing = tmp_path / "nope" / "BACKLOG.md"
    monkeypatch.setattr("sys.argv", ["backlog_audit.py", str(missing)])
    assert backlog_audit.main() == 0


def test_script_has_no_repo_imports() -> None:
    """Hard requirement: single-file, stdlib-only, copyable into any project."""
    source = Path(backlog_audit.__file__).read_text(encoding="utf-8")
    repo_modules = ("model_router", "model_routing_audit", "gate_telemetry", "skill_graph")
    for module in repo_modules:
        assert f"import {module}" not in source
        assert f"from {module}" not in source
