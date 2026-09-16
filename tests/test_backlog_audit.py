"""Tests for scripts/backlog_audit.py — BACKLOG lifecycle checker.

Covers all eight checks (size, rotation-due, unmarked, phase-dump, over-cap,
dangling-ID, deferred-dup, exit-at-filing), status classification precedence,
and exit-code contract.
"""

from __future__ import annotations

import os
import subprocess
from datetime import date
from pathlib import Path

import pytest

import backlog_audit
from backlog_audit import (
    EXIT_REQUIRED_SINCE,
    MAX_ENTRIES,
    MAX_ENTRY_LINES,
    MAX_LINES,
    STATUS_OPEN,
    STATUS_RESOLVED,
    STATUS_UNMARKED,
    audit,
    find_dangling_citations,
    find_exit_violations,
    format_archive_status,
    format_dangling_report,
    format_exit_report,
    format_report,
    git_blame_dates,
    known_backlog_ids,
    looks_like_backlog_id,
    parse_entries,
    resolve_archive_path,
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


# --------------------------------------------------------------------- over-cap


def test_over_cap_entry_is_a_violation(tmp_path: Path) -> None:
    """A single entry past the per-entry cap is a violation independent of file size."""
    filler = "\n".join(f"filler line {i}" for i in range(MAX_ENTRY_LINES + 5))
    text = f"# BACKLOG\n\n## `over_cap-entry_1` — thing\n\n**Status:** OPEN\n{filler}\n"
    report = audit(write(tmp_path, text))
    assert report.over_size is False  # isolates the cap axis from the size axis
    assert len(report.over_cap) == 1
    assert report.over_cap[0].label == "over_cap-entry_1"
    assert report.has_violations is True


def test_under_cap_entry_is_not_a_violation(tmp_path: Path) -> None:
    text = "# BACKLOG\n\n## `under_cap-entry_1` — thing\n\n**Status:** OPEN\n\nshort body\n"
    report = audit(write(tmp_path, text))
    assert report.over_cap == ()
    assert report.has_violations is False


def test_format_report_names_over_cap_entry_by_id(tmp_path: Path) -> None:
    filler = "\n".join(f"filler line {i}" for i in range(MAX_ENTRY_LINES + 5))
    text = f"# BACKLOG\n\n## `over_cap-entry_1` — thing\n\n**Status:** OPEN\n{filler}\n"
    rendered = format_report(audit(write(tmp_path, text)))
    assert "over_cap-entry_1" in rendered
    assert f"{MAX_ENTRY_LINES}-line cap" in rendered


def test_size_remedy_names_over_cap_entry_when_zero_resolved(tmp_path: Path) -> None:
    """D1 fix: 0 RESOLVED + an over-cap OPEN entry -> remedy is amendment rotation,
    not the unreachable 'rotate oldest RESOLVED'."""
    filler = "\n".join(f"filler line {i}" for i in range(MAX_LINES + 5))
    text = f"# BACKLOG\n\n## `over_cap-entry_1` — thing\n\n**Status:** OPEN\n{filler}\n"
    report = audit(write(tmp_path, text))
    assert report.over_size is True
    assert report.resolved == ()
    rendered = format_report(report)
    assert "amendment rotation" in rendered
    assert "rotate oldest RESOLVED" not in rendered


def test_size_remedy_names_triage_when_zero_resolved_and_no_over_cap(tmp_path: Path) -> None:
    """0 RESOLVED, over-threshold on entry *count*, no single entry over cap ->
    remedy is triage, not a rotation instruction that has nothing to move."""
    entries = "".join(
        f"## `e_{i}` — thing {i}\n\n**Status:** OPEN\n\n" for i in range(MAX_ENTRIES + 1)
    )
    report = audit(write(tmp_path, f"# BACKLOG\n\n{entries}"))
    assert report.over_size is True
    assert report.resolved == ()
    assert report.over_cap == ()
    rendered = format_report(report)
    assert "triage OPEN entries" in rendered


# ------------------------------------------------------------------ dangling ID


def test_looks_like_backlog_id_accepts_real_id_shapes() -> None:
    assert looks_like_backlog_id("sgh1_task-diff-guard_exit_1") is True
    assert looks_like_backlog_id("feat1_dangling-thing_1") is True


@pytest.mark.parametrize(
    "token",
    ["filtered_n", "settled_n", "tool_use_id", "test_stop_settles_returned_dispatch", "plugin_id"],
)
def test_looks_like_backlog_id_rejects_plain_snake_case(token: str) -> None:
    """Presence-control's inverse: code identifiers/JSON keys never carry a hyphen —
    this is what keeps the scan from flagging them as dangling citations."""
    assert looks_like_backlog_id(token) is False


def test_dangling_citation_found_with_no_header_anywhere(tmp_path: Path) -> None:
    backlog_path = write(tmp_path, "# BACKLOG\n\n## `feat1_other-thing_1` — thing\n\n**Status:** OPEN\n")
    archive_path = tmp_path / "History" / "BACKLOG-archive.md"
    (tmp_path / "TODO.md").write_text(
        "See `feat1_dangling-thing_1` for the deferred item.\n", encoding="utf-8"
    )
    dangling = find_dangling_citations(
        backlog_path=backlog_path, archive_path=archive_path, scan_root=tmp_path
    )
    assert len(dangling) == 1
    assert dangling[0].id == "feat1_dangling-thing_1"


def test_archived_id_is_not_dangling_but_unheadered_sibling_is(tmp_path: Path) -> None:
    """Archive-awareness presence-control: an archived ID resolves cleanly while a
    genuinely dangling sibling in the same citing file is still caught — proving the
    scan actually read the archive rather than silently seeing nothing."""
    backlog_path = write(tmp_path, "# BACKLOG\n\n## `feat1_other-thing_1` — thing\n\n**Status:** OPEN\n")
    archive_dir = tmp_path / "History"
    archive_dir.mkdir()
    archive_path = archive_dir / "BACKLOG-archive.md"
    archive_path.write_text(
        "# BACKLOG Archive\n\n## `feat1_archived-thing_1` — resolved thing — RESOLVED\n\nbody\n",
        encoding="utf-8",
    )
    (tmp_path / "DECISION_LOG.md").write_text(
        "Resolved per `feat1_archived-thing_1`. Still open: `feat1_dangling-thing_2`.\n",
        encoding="utf-8",
    )
    dangling = find_dangling_citations(
        backlog_path=backlog_path, archive_path=archive_path, scan_root=tmp_path
    )
    assert len(dangling) == 1
    assert dangling[0].id == "feat1_dangling-thing_2"


def test_all_cited_ids_resolvable_reports_zero(tmp_path: Path) -> None:
    backlog_path = write(tmp_path, "# BACKLOG\n\n## `feat1_thing_1` — thing\n\n**Status:** OPEN\n")
    archive_path = tmp_path / "History" / "BACKLOG-archive.md"
    (tmp_path / "TODO.md").write_text("Tracked at `feat1_thing_1`.\n", encoding="utf-8")
    dangling = find_dangling_citations(
        backlog_path=backlog_path, archive_path=archive_path, scan_root=tmp_path
    )
    assert dangling == ()


def test_dangling_scan_skips_dot_agent_directory(tmp_path: Path) -> None:
    """.agent/ holds hook snapshots and session state, not durable records — a
    citation there must never count toward the dangling-ID violation."""
    backlog_path = write(tmp_path, "# BACKLOG\n\n## `feat1_other-thing_1` — thing\n\n**Status:** OPEN\n")
    archive_path = tmp_path / "History" / "BACKLOG-archive.md"
    agent_dir = tmp_path / ".agent"
    agent_dir.mkdir()
    (agent_dir / "current_task.md").write_text(
        "Snapshot cites `feat1_dangling-thing_3`.\n", encoding="utf-8"
    )
    dangling = find_dangling_citations(
        backlog_path=backlog_path, archive_path=archive_path, scan_root=tmp_path
    )
    assert dangling == ()


@pytest.mark.parametrize("archive_dirname", ["History", "history"])
def test_dangling_scan_skips_archive_dir_both_casings(
    tmp_path: Path, archive_dirname: str
) -> None:
    """Check 6's creation invariant is active-only (OBL-1 T2b): a citation of an
    unfiled ID inside the phase-archive dir is a historical fact, not a dangling
    link. This repo tracks the archive dir under both `History/` and `history/`
    casings (`core.ignorecase=true` masks the split on Windows) — parametrized so
    a fix that only matches one casing still fails half these runs."""
    backlog_path = write(tmp_path, "# BACKLOG\n\n## `feat1_other-thing_1` — thing\n\n**Status:** OPEN\n")
    archive_path = tmp_path / "History" / "BACKLOG-archive.md"
    archived_dir = tmp_path / archive_dirname / "Reports"
    archived_dir.mkdir(parents=True)
    (archived_dir / "old-report.md").write_text(
        "Archived report cites `feat1_archived-only_1`.\n", encoding="utf-8"
    )
    dangling = find_dangling_citations(
        backlog_path=backlog_path, archive_path=archive_path, scan_root=tmp_path
    )
    assert dangling == ()


@pytest.mark.parametrize("archive_dirname", ["History", "history"])
def test_active_citation_of_archived_id_still_dangles(
    tmp_path: Path, archive_dirname: str
) -> None:
    """Presence-control for the archive exclusion: the SAME id, cited again from an
    active path outside the archive dir, still dangles — proves the exclusion scopes
    to the archive directory, not to the ID (i.e. the scan isn't just blind)."""
    backlog_path = write(tmp_path, "# BACKLOG\n\n## `feat1_other-thing_1` — thing\n\n**Status:** OPEN\n")
    archive_path = tmp_path / "History" / "BACKLOG-archive.md"
    archived_dir = tmp_path / archive_dirname / "Reports"
    archived_dir.mkdir(parents=True)
    (archived_dir / "old-report.md").write_text(
        "Archived report cites `feat1_archived-only_1`.\n", encoding="utf-8"
    )
    (tmp_path / "TODO.md").write_text(
        "Still open: `feat1_archived-only_1`.\n", encoding="utf-8"
    )
    dangling = find_dangling_citations(
        backlog_path=backlog_path, archive_path=archive_path, scan_root=tmp_path
    )
    assert len(dangling) == 1
    assert dangling[0].id == "feat1_archived-only_1"


def test_is_archived_path_matches_both_casings_without_touching_disk() -> None:
    """Deterministic, platform-independent check of the matcher itself — avoids
    relying on Windows' case-insensitive filesystem to prove both casings resolve."""
    root = Path("Artifacts")
    assert backlog_audit.is_archived_path(root / "History" / "Reports" / "x.md", root) is True
    assert backlog_audit.is_archived_path(root / "history" / "Reports" / "x.md", root) is True
    assert backlog_audit.is_archived_path(root / "HISTORY" / "x.md", root) is True
    assert backlog_audit.is_archived_path(root / "IMPLEMENTATION_PLAN.md", root) is False
    assert backlog_audit.is_archived_path(root / "Plans" / "history-of-thing.md", root) is False


# --------------------------------------------------------- archive resolution (OBL-1)


def test_case_insensitive_match_is_pure_and_disk_independent() -> None:
    """Proves the matching logic itself is case-insensitive without relying on a
    real filesystem's own case-folding — this repo's Windows checkouts run
    `core.ignorecase=true`, which would let a broken (single-casing) match pass by
    accident of NTFS rather than by the logic actually being case-insensitive."""
    match = backlog_audit._case_insensitive_match
    assert match(("History", "Reports"), "history") == "History"
    assert match(("history", "Reports"), "HISTORY") == "history"
    assert match(("Reports",), "history") is None
    assert match((), "history") is None


def test_resolve_archive_path_finds_lowercase_history(tmp_path: Path) -> None:
    archive_dir = tmp_path / "history"
    archive_dir.mkdir()
    archive_file = archive_dir / "BACKLOG-archive.md"
    archive_file.write_text(
        "# Archive\n\n## `feat1_archived_1` — thing — RESOLVED\n\nbody\n", encoding="utf-8"
    )
    resolution = resolve_archive_path(tmp_path)
    assert resolution.path == archive_file
    assert resolution.archive_dir_found is True


def test_resolve_archive_path_finds_capitalized_history(tmp_path: Path) -> None:
    archive_dir = tmp_path / "History"
    archive_dir.mkdir()
    archive_file = archive_dir / "BACKLOG-archive.md"
    archive_file.write_text(
        "# Archive\n\n## `feat1_archived_1` — thing — RESOLVED\n\nbody\n", encoding="utf-8"
    )
    resolution = resolve_archive_path(tmp_path)
    assert resolution.path == archive_file
    assert resolution.archive_dir_found is True


def test_resolve_archive_path_absent_directory_is_not_flagged_as_found(tmp_path: Path) -> None:
    """A project that has never rotated has no History/history directory at all —
    a legitimate state, distinct from one existing but missing its file."""
    resolution = resolve_archive_path(tmp_path)
    assert resolution.path is None
    assert resolution.archive_dir_found is False


def test_resolve_archive_path_dir_present_file_missing(tmp_path: Path) -> None:
    (tmp_path / "History").mkdir()
    resolution = resolve_archive_path(tmp_path)
    assert resolution.path is None
    assert resolution.archive_dir_found is True


def test_known_backlog_ids_nonempty_when_archive_resolves(tmp_path: Path) -> None:
    """Presence-control for the archive oracle: a resolving archive must actually
    contribute IDs — otherwise a bug that silently returns zero IDs would pass every
    'reports N dangling' assertion by coincidence."""
    backlog_path = write(tmp_path, "# BACKLOG\n\n## `feat1_active_1` — thing\n\n**Status:** OPEN\n")
    archive_dir = tmp_path / "history"
    archive_dir.mkdir()
    archive_path = archive_dir / "BACKLOG-archive.md"
    archive_path.write_text(
        "# Archive\n\n## `feat1_archived_1` — thing — RESOLVED\n\nbody\n", encoding="utf-8"
    )
    ids = known_backlog_ids(backlog_path, archive_path)
    assert ids  # non-empty: proves the archive was actually read, not silently skipped
    assert "feat1_archived_1" in ids


def _write_archive_scenario(tmp_path: Path, archive_dirname: str) -> Path:
    """1 active BACKLOG entry, 2 archived entries, and citations of 5 IDs (2
    archived, 1 active, 2 truly dangling) from an active durable record — mirrors
    this repo's real BACKLOG.md/archive shape (`obl1_t2c_audit_run.txt`: 2 dangling).
    IDs carry a hyphen (`looks_like_backlog_id` requires one — see its docstring)."""
    backlog_path = write(
        tmp_path, "# BACKLOG\n\n## `feat1_active-thing_1` — thing\n\n**Status:** OPEN\n"
    )
    archive_dir = tmp_path / archive_dirname
    archive_dir.mkdir()
    (archive_dir / "BACKLOG-archive.md").write_text(
        "# Archive\n\n"
        "## `feat1_archived-thing_1` — thing — RESOLVED\n\nbody\n\n"
        "## `feat1_archived-thing_2` — thing — RESOLVED\n\nbody\n",
        encoding="utf-8",
    )
    (tmp_path / "TODO.md").write_text(
        "Active: `feat1_active-thing_1`. Archived: `feat1_archived-thing_1`, "
        "`feat1_archived-thing_2`. Still open: `feat1_dangling-thing_1`, "
        "`feat1_dangling-thing_2`.\n",
        encoding="utf-8",
    )
    return backlog_path


@pytest.mark.parametrize("archive_dirname", ["history", "History"])
def test_resolved_archive_yields_expected_dangling_count(
    tmp_path: Path, archive_dirname: str
) -> None:
    """End-to-end through resolve_archive_path + find_dangling_citations: 2 archived
    IDs resolve as known regardless of casing, leaving exactly the 2 genuinely
    dangling IDs — parametrized so a fix that only matches one casing still fails
    half these runs (mirrors `test_dangling_scan_skips_archive_dir_both_casings`)."""
    backlog_path = _write_archive_scenario(tmp_path, archive_dirname)
    resolution = resolve_archive_path(tmp_path)
    assert resolution.path is not None
    dangling = find_dangling_citations(
        backlog_path=backlog_path, archive_path=resolution.path, scan_root=tmp_path
    )
    assert len(dangling) == 2
    assert {c.id for c in dangling} == {"feat1_dangling-thing_1", "feat1_dangling-thing_2"}


def test_format_archive_status_empty_when_resolved(tmp_path: Path) -> None:
    resolution = backlog_audit.ArchiveResolution(
        path=tmp_path / "history" / "BACKLOG-archive.md", archive_dir_found=True
    )
    assert format_archive_status(resolution, tmp_path) == ""


def test_format_archive_status_quiet_note_when_never_rotated(tmp_path: Path) -> None:
    """Fresh-project state: no archive directory at all is a legitimate state, not a
    violation — the note is suppressed entirely under --violations-only."""
    resolution = backlog_audit.ArchiveResolution(path=None, archive_dir_found=False)
    rendered = format_archive_status(resolution, tmp_path)
    assert rendered != ""
    assert "VIOLATION" not in rendered
    assert format_archive_status(resolution, tmp_path, violations_only=True) == ""


def test_format_archive_status_violation_names_searched_path_when_unresolvable(
    tmp_path: Path,
) -> None:
    """Archive directory exists but no matching file inside it — the oracle-
    discipline defect this task fixes: this must be loud, naming the searched path,
    even under --violations-only."""
    resolution = backlog_audit.ArchiveResolution(path=None, archive_dir_found=True)
    rendered = format_archive_status(resolution, tmp_path)
    assert "VIOLATION" in rendered
    assert str(tmp_path) in rendered
    assert "BACKLOG-archive.md" in rendered
    assert format_archive_status(resolution, tmp_path, violations_only=True) != ""


def test_main_flags_unresolvable_archive_and_names_searched_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """CLI-level RED case: a History/ directory present with no archive file inside
    must fail the gate and name the path it looked for, not silently audit as if
    there were zero archived IDs."""
    path = write(tmp_path, "# BACKLOG\n\n## `feat1_active_1` — thing\n\n**Status:** OPEN\n")
    (tmp_path / "History").mkdir()
    monkeypatch.setattr("sys.argv", ["backlog_audit.py", str(path)])
    exit_code = backlog_audit.main()
    out = capsys.readouterr().out
    assert exit_code == 1
    assert "VIOLATION" in out
    assert "BACKLOG-archive.md" in out
    assert str(tmp_path) in out


def test_main_does_not_flag_missing_archive_dir_as_violation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    """A project that has never rotated (no History/history dir at all) must stay
    clean — this is the distinction requirement 2 draws between 'genuinely absent'
    and 'expected but unresolvable'."""
    path = write(tmp_path, "# BACKLOG\n\n## `feat1_active_1` — thing\n\n**Status:** OPEN\n")
    monkeypatch.setattr("sys.argv", ["backlog_audit.py", str(path)])
    exit_code = backlog_audit.main()
    out = capsys.readouterr().out
    assert exit_code == 0
    assert "VIOLATION" not in out


def test_format_dangling_report_names_offending_id() -> None:
    citation = backlog_audit.Citation(
        id="feat1_dangling-thing_1", file=Path("TODO.md"), line_no=3
    )
    rendered = format_dangling_report((citation,))
    assert "feat1_dangling-thing_1" in rendered
    assert "VIOLATION" in rendered


def test_format_dangling_report_clean_when_empty() -> None:
    assert format_dangling_report(()) != ""
    assert format_dangling_report((), violations_only=True) == ""


# -------------------------------------------------------------------- --help


def test_help_lists_six_checks(capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("sys.argv", ["backlog_audit.py", "--help"])
    with pytest.raises(SystemExit):
        backlog_audit.main()
    out = capsys.readouterr().out
    for label in ("1. Size", "2. Rotation due", "3. Unmarked", "4. Phase-dump", "5. Over-cap", "6. Dangling-ID"):
        assert label in out


def test_help_lists_checks_seven_and_eight(
    capsys: pytest.CaptureFixture[str], monkeypatch: pytest.MonkeyPatch
) -> None:
    """BGR-1 T8: --help must name the two new checks, not just the original six."""
    monkeypatch.setattr("sys.argv", ["backlog_audit.py", "--help"])
    with pytest.raises(SystemExit):
        backlog_audit.main()
    out = capsys.readouterr().out
    assert "7. Deferred-dup" in out
    assert "8. Exit-at-filing" in out


# ------------------------------------------------------------- check 7: deferred-dup


def test_duplicate_deferred_lines_is_a_violation(tmp_path: Path) -> None:
    """T5's rule: `**Deferred:**` is a single status field, exactly one per entry.
    A second line means an append happened instead of an overwrite — check 7 fires."""
    text = (
        "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n\n"
        "**Deferred:** 2026-08-01 — reason one\n"
        "**Deferred:** 2026-09-01 — reason two\n"
    )
    report = audit(write(tmp_path, text))
    assert len(report.duplicate_deferred) == 1
    assert report.duplicate_deferred[0].label == "a_1"
    assert report.has_violations is True
    rendered = format_report(report)
    assert "VIOLATION" in rendered
    assert "Deferred" in rendered


def test_single_deferred_line_is_not_a_violation(tmp_path: Path) -> None:
    """The compliant shape — exactly one `**Deferred:**` line — must not fire."""
    text = (
        "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n\n"
        "**Deferred:** 2026-08-01 — reason\n"
    )
    report = audit(write(tmp_path, text))
    assert report.duplicate_deferred == ()
    assert report.has_violations is False


def test_duplicate_deferred_is_unconditional_like_over_cap(tmp_path: Path) -> None:
    """Check 7 fires regardless of file size — it never waits on the size gate,
    mirroring `over_cap`'s unconditional design (BGR-1 T8 spec)."""
    text = (
        "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n\n"
        "**Deferred:** 2026-08-01 — one\n**Deferred:** 2026-09-01 — two\n"
    )
    report = audit(write(tmp_path, text))
    assert report.over_size is False
    assert len(report.duplicate_deferred) == 1


# ----------------------------------------------------------- check 8: exit-at-filing


def _init_git_repo(repo: Path) -> None:
    subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.email", "bgr1-t8@test.local"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.name", "bgr1-t8"], cwd=repo, check=True)


def _git_commit_file(repo: Path, filename: str, content: str, when: str) -> Path:
    """Write `content` to `filename` and commit it with both author and committer
    dates pinned to `when` (ISO 8601) — deterministic, no reliance on wall-clock."""
    path = repo / filename
    path.write_text(content, encoding="utf-8")
    subprocess.run(["git", "add", filename], cwd=repo, check=True)
    env = {**os.environ, "GIT_AUTHOR_DATE": when, "GIT_COMMITTER_DATE": when}
    subprocess.run(["git", "commit", "-q", "-m", "x"], cwd=repo, check=True, env=env)
    return path


def test_git_blame_dates_resolves_commit_date_for_header_line(tmp_path: Path) -> None:
    _init_git_repo(tmp_path)
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n"
    path = _git_commit_file(tmp_path, "BACKLOG.md", text, "2026-09-17T10:00:00")
    entries = parse_entries(text)
    dates = git_blame_dates(path, [e.line_no for e in entries])
    assert dates[entries[0].line_no] == date(2026, 9, 17)


def test_check8_fires_via_git_blame_when_touched_after_cutoff(tmp_path: Path) -> None:
    """The core blame trigger: an entry with no **Exit:** whose header was last
    touched on/after EXIT_REQUIRED_SINCE (resolved via real git blame) fires."""
    _init_git_repo(tmp_path)
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n"
    path = _git_commit_file(tmp_path, "BACKLOG.md", text, "2026-09-17T10:00:00")
    entries = parse_entries(text)
    blame_dates = git_blame_dates(path, [e.line_no for e in entries])
    result = find_exit_violations(entries, blame_dates)
    assert len(result.violations) == 1
    assert result.violations[0].label == "a_1"
    assert result.collapsed is False


def test_check8_grandfathers_entry_touched_before_cutoff(tmp_path: Path) -> None:
    """Pre-cutoff entries are grandfathered — no **Exit:** required, no fire."""
    _init_git_repo(tmp_path)
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n"
    path = _git_commit_file(tmp_path, "BACKLOG.md", text, "2026-01-01T10:00:00")
    entries = parse_entries(text)
    blame_dates = git_blame_dates(path, [e.line_no for e in entries])
    result = find_exit_violations(entries, blame_dates)
    assert result.violations == ()


def test_check8_does_not_fire_when_exit_field_present(tmp_path: Path) -> None:
    """Post-cutoff touch is not itself the violation — missing **Exit:** is."""
    _init_git_repo(tmp_path)
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n\n**Exit:** ship T9\n"
    path = _git_commit_file(tmp_path, "BACKLOG.md", text, "2026-09-17T10:00:00")
    entries = parse_entries(text)
    blame_dates = git_blame_dates(path, [e.line_no for e in entries])
    result = find_exit_violations(entries, blame_dates)
    assert result.violations == ()


def test_check8_filed_field_fallback_fires_when_blame_unavailable() -> None:
    """Resolution order's second rung: no blame data (empty dict, as when git
    could not resolve the line) falls back to the entry's own **Filed:** date."""
    text = "## `a_1` — thing\n\n**Status:** OPEN\n\n**Filed:** 2026-09-20\n"
    entries = parse_entries(text)
    result = find_exit_violations(entries, blame_dates={})
    assert len(result.violations) == 1
    assert result.violations[0].label == "a_1"


def test_check8_filed_field_fallback_grandfathers_pre_cutoff() -> None:
    text = "## `a_1` — thing\n\n**Status:** OPEN\n\n**Filed:** 2026-01-01\n"
    entries = parse_entries(text)
    result = find_exit_violations(entries, blame_dates={})
    assert result.violations == ()


def test_check8_skips_entirely_on_non_git_checkout(tmp_path: Path) -> None:
    """Design constraint: a non-git checkout must skip check 8 entirely — never
    crash, never manufacture a false violation. `tmp_path` here has no `.git`."""
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n"
    path = write(tmp_path, text)
    entries = parse_entries(text)
    blame_dates = git_blame_dates(path, [e.line_no for e in entries])
    assert all(v is None for v in blame_dates.values())
    result = find_exit_violations(entries, blame_dates)
    assert result.violations == ()
    assert result.collapsed is False


def test_check8_collapses_to_one_advisory_when_over_half_fire() -> None:
    """Hard Rule 2 — the bulk-retrofit guard: >50% of entries firing collapses to
    a single advisory, never N per-entry violations."""
    text = "".join(f"## `e_{i}_1` — thing {i}\n\n**Status:** OPEN\n\n" for i in range(4))
    text += "## `f_1_1` — has exit\n\n**Status:** OPEN\n\n**Exit:** done\n"
    entries = parse_entries(text)
    since = date(2026, 9, 16)
    blame_dates = {e.line_no: date(2026, 9, 17) for e in entries}
    result = find_exit_violations(entries, blame_dates, since=since)
    assert result.fired_count == 4
    assert len(entries) == 5
    assert result.fired_count > len(entries) / 2
    assert result.collapsed is True
    assert result.violations == ()


def test_check8_does_not_collapse_at_or_under_half() -> None:
    """Presence-control for the collapse threshold: exactly half (or fewer) firing
    must NOT collapse — proves the boundary is `>`, not `>=`."""
    text = "".join(f"## `e_{i}_1` — thing {i}\n\n**Status:** OPEN\n\n" for i in range(2))
    text += "".join(f"## `f_{i}_1` — has exit {i}\n\n**Status:** OPEN\n\n**Exit:** done\n" for i in range(2))
    entries = parse_entries(text)
    since = date(2026, 9, 16)
    blame_dates = {e.line_no: date(2026, 9, 17) for e in entries}
    result = find_exit_violations(entries, blame_dates, since=since)
    assert len(entries) == 4
    assert result.fired_count == 2
    assert result.collapsed is False
    assert len(result.violations) == 2


def test_format_exit_report_collapse_is_not_bracket_violation() -> None:
    """The collapse renders as plain advisory text (matching `format_archive_status`'s
    quiet-note idiom), never as a `[VIOLATION]` — it must not gate the exit code."""
    result = backlog_audit.ExitCheckResult(violations=(), collapsed=True, fired_count=4, total=5)
    rendered = format_exit_report(result)
    assert "VIOLATION" not in rendered
    assert rendered != ""
    assert format_exit_report(result, violations_only=True) == ""


def test_format_exit_report_violation_names_offending_entries() -> None:
    entries = parse_entries("## `a_1` — thing\n\n**Status:** OPEN\n")
    result = find_exit_violations(entries, blame_dates={e.line_no: date(2026, 9, 17) for e in entries})
    rendered = format_exit_report(result)
    assert "[VIOLATION]" in rendered
    assert "a_1" in rendered
    assert EXIT_REQUIRED_SINCE.isoformat() in rendered


def test_main_exits_one_when_check8_fires(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """CLI-level integration: a real git repo with a post-cutoff, Exit-less entry
    must fail the gate through `main()`, not just the unit-level function."""
    _init_git_repo(tmp_path)
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n"
    path = _git_commit_file(tmp_path, "BACKLOG.md", text, "2026-09-17T10:00:00")
    monkeypatch.setattr("sys.argv", ["backlog_audit.py", str(path)])
    assert backlog_audit.main() == 1


def test_main_exits_zero_when_check8_grandfathered(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _init_git_repo(tmp_path)
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n"
    path = _git_commit_file(tmp_path, "BACKLOG.md", text, "2026-01-01T10:00:00")
    monkeypatch.setattr("sys.argv", ["backlog_audit.py", str(path)])
    assert backlog_audit.main() == 0


# --------------------------------------------------------- entry-count advisory


def test_format_report_entry_count_carries_advisory_label(tmp_path: Path) -> None:
    """Advisory labelling requirement (BGR-1 T8): the entry-count figure in the
    header must always carry an explicit advisory annotation."""
    text = "# BACKLOG\n\n## `a_1` — thing\n\n**Status:** OPEN\n"
    report = audit(write(tmp_path, text))
    rendered = format_report(report)
    assert "advisory" in rendered.lower()


def test_over_entry_count_violation_names_it_advisory(tmp_path: Path) -> None:
    """When entry count alone (not line count) trips the size gate, the
    [VIOLATION] line itself must say so is advisory — never silently gate on an
    unreliable count without saying which measure triggered it."""
    entries = "".join(
        f"## `e_{i}` — thing {i}\n\n**Status:** OPEN\n\n" for i in range(MAX_ENTRIES + 1)
    )
    report = audit(write(tmp_path, f"# BACKLOG\n\n{entries}"))
    assert report.over_size is True
    assert report.entry_count_over_cap is True
    rendered = format_report(report)
    assert "entry count only — advisory" in rendered
