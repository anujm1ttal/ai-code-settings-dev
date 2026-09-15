#!/usr/bin/env python3
"""
BACKLOG Audit

Reports lifecycle violations in an `Artifacts/BACKLOG.md` against the rules in
`rules/common/orchestration.md` §BACKLOG Lifecycle.

BACKLOG is searchable memory, not a work queue — nothing schedules off it. So this
tool checks *hygiene* (is it small enough to search, is every entry classifiable),
never "is this item overdue". An aged OPEN entry is not a violation; that is the
artifact working as intended.

Checks:
  1. Size          — active file over >600 lines OR >20 entries
  2. Rotation due  — RESOLVED entries still present while over threshold
  3. Unmarked      — entries carrying no OPEN/RESOLVED status marker
  4. Phase-dump    — `## N. <something> findings` headings, i.e. per-phase append
                     sections instead of entries (the failure mode that grew one
                     project's backlog to 1228 lines across 17 such sections)
  5. Over-cap      — a single entry exceeds the 30-line per-entry cap (the growth
                     axis: one entry re-amended over weeks, not accrual)
  6. Dangling-ID   — an *active* durable record (`Artifacts/**/*.md`) cites a
                     `<phase>_<component>_<n>`-shaped ID with no `## ` header in
                     BACKLOG.md or its resolved archive (archive-aware). The archive
                     is located case-insensitively (`History/` or `history/`, both
                     tracked casings in this repo under `core.ignorecase=true`) — see
                     `resolve_archive_path`. If an archive directory exists but no
                     matching file is found inside it, that is its own [VIOLATION]
                     rather than a silent zero-IDs oracle; a project that has never
                     rotated (no archive directory at all) is reported as a note, not
                     a violation.
                     Active-only scope: the creation invariant binds live records,
                     not history — a citation inside the phase archive directory
                     itself is a historical fact, not a live broken link, and is
                     excluded from the scan.

Read-only by contract: this tool never edits, rotates, or deletes. Mutation stays
human-confirmed (see `/clean`).

Zero repo imports — stdlib only, single file, copyable into any project.

Exit code: 0 clean, 1 on any violation (CI-usable).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import argparse
import re
import sys

MAX_LINES = 600
MAX_ENTRIES = 20
MAX_ENTRY_LINES = 30

DEFAULT_BACKLOG = Path("Artifacts/BACKLOG.md")

CHECKS_HELP = """\
Checks:
  1. Size        - active file over 600 lines OR 20 entries
  2. Rotation due - RESOLVED entries still present while over threshold
  3. Unmarked     - entries carrying no OPEN/RESOLVED status marker
  4. Phase-dump   - per-phase append sections instead of entries
  5. Over-cap     - a single entry exceeds the 30-line per-entry cap
  6. Dangling-ID  - an active durable record cites an ID with no BACKLOG/archive header
"""

ENTRY_RE = re.compile(r"^##\s+(?P<title>.+?)\s*$")
# Per-phase dump shape: "## 5c. Track 16.RT-T.3b findings (2026-07-10) — ..."
PHASE_DUMP_RE = re.compile(r"^##\s+\d+[a-z]?\.\s+.*\bfindings\b", re.IGNORECASE)
RESOLVED_RE = re.compile(r"~~|\bRESOLVED\b|\bCLOSED\b|\bGRADUATED\b|\bSTRUCK\b")
OPEN_RE = re.compile(r"\bOPEN\b")

STATUS_OPEN = "OPEN"
STATUS_RESOLVED = "RESOLVED"
STATUS_UNMARKED = "UNMARKED"


@dataclass(frozen=True)
class Entry:
    """One `## ` section of a BACKLOG file."""

    title: str
    line_no: int
    status: str
    is_phase_dump: bool
    line_count: int

    @property
    def label(self) -> str:
        """Short identifier for reporting — the entry ID if one is recognizable."""
        ident = re.search(r"`([^`]+)`", self.title)
        return ident.group(1) if ident else self.title[:60]


@dataclass(frozen=True)
class Report:
    """Audit outcome for a single BACKLOG file."""

    path: Path
    line_count: int
    entries: tuple[Entry, ...]

    @property
    def over_size(self) -> bool:
        return self.line_count > MAX_LINES or len(self.entries) > MAX_ENTRIES

    @property
    def resolved(self) -> tuple[Entry, ...]:
        return tuple(e for e in self.entries if e.status == STATUS_RESOLVED)

    @property
    def unmarked(self) -> tuple[Entry, ...]:
        return tuple(e for e in self.entries if e.status == STATUS_UNMARKED)

    @property
    def phase_dumps(self) -> tuple[Entry, ...]:
        return tuple(e for e in self.entries if e.is_phase_dump)

    @property
    def rotation_due(self) -> tuple[Entry, ...]:
        """RESOLVED entries are only a violation once the file is over threshold."""
        return self.resolved if self.over_size else ()

    @property
    def over_cap(self) -> tuple[Entry, ...]:
        """Per-entry cap breach — unconditional, unlike rotation_due. A single
        fat OPEN entry is the growth axis; it never waits on file-level size."""
        return tuple(e for e in self.entries if e.line_count > MAX_ENTRY_LINES)

    @property
    def has_violations(self) -> bool:
        return bool(
            self.over_size or self.rotation_due or self.unmarked or self.phase_dumps or self.over_cap
        )


def classify(title: str, body: str) -> str:
    """Resolve an entry's status from its heading first, then its body."""
    if RESOLVED_RE.search(title):
        return STATUS_RESOLVED
    if OPEN_RE.search(title):
        return STATUS_OPEN
    # An explicit body marker wins over keyword scanning — an OPEN entry may legitimately
    # discuss a RESOLVED sibling in its prose.
    if re.search(r"\*\*Status\:?\*\*[^\n]*\bOPEN\b", body):
        return STATUS_OPEN
    # Body markers: "**Status:** RESOLVED", "**Resolved:** 2026-07-08"
    if re.search(r"\*\*(?:Status|Resolved|Closed)\:?\*\*[^\n]*", body) and RESOLVED_RE.search(body):
        return STATUS_RESOLVED
    return STATUS_UNMARKED


def parse_entries(text: str) -> tuple[Entry, ...]:
    """Split a BACKLOG file into `## ` entries with resolved status."""
    lines = text.splitlines()
    starts: list[tuple[int, str]] = [
        (i, m.group("title")) for i, line in enumerate(lines) if (m := ENTRY_RE.match(line))
    ]
    entries: list[Entry] = []
    for idx, (line_idx, title) in enumerate(starts):
        end = starts[idx + 1][0] if idx + 1 < len(starts) else len(lines)
        body = "\n".join(lines[line_idx + 1 : end])
        entries.append(
            Entry(
                title=title,
                line_no=line_idx + 1,
                status=classify(title, body),
                is_phase_dump=bool(PHASE_DUMP_RE.match(lines[line_idx])),
                # Lines this entry occupies: its header through the line before the
                # next `## ` header (or EOF). This is the growth axis T1 caps —
                # in-place amendment of one entry, not accrual of many.
                line_count=end - line_idx,
            )
        )
    return tuple(entries)


def audit(path: Path) -> Report:
    """Read and audit a BACKLOG file. Raises FileNotFoundError if absent."""
    text = path.read_text(encoding="utf-8")
    return Report(
        path=path,
        line_count=len(text.splitlines()),
        entries=parse_entries(text),
    )


def format_report(report: Report, violations_only: bool = False) -> str:
    """Render a human-readable audit summary."""
    out: list[str] = []
    size_flag = "OVER" if report.over_size else "ok"
    header = (
        f"BACKLOG health — {report.path}\n"
        f"  {report.line_count} lines / {len(report.entries)} entries "
        f"(threshold {MAX_LINES} ln / {MAX_ENTRIES} entries / {MAX_ENTRY_LINES} ln per entry: {size_flag})"
    )
    if not violations_only or report.has_violations:
        out.append(header)

    if report.over_size:
        # Name the action achievable in the state actually observed — prescribing
        # "rotate RESOLVED" when there are none is an unreachable remedy (D1).
        if report.resolved:
            out.append(
                f"  [VIOLATION] size — rotate {len(report.resolved)} oldest RESOLVED "
                "entries to History/BACKLOG-archive.md"
            )
        elif report.over_cap:
            ids = ", ".join(e.label for e in report.over_cap)
            out.append(
                "  [VIOLATION] size — 0 RESOLVED entries to rotate; apply amendment "
                f"rotation (move superseded text, not the entry, to History/BACKLOG-archive.md) "
                f"to the over-cap entry first — {ids}"
            )
        else:
            out.append(
                "  [VIOLATION] size — 0 RESOLVED entries and no entry over the "
                f"{MAX_ENTRY_LINES}-line cap; triage OPEN entries via /sync or "
                "/blueprint reconciliation before filing anything new"
            )
    if report.rotation_due:
        ids = ", ".join(e.label for e in report.rotation_due)
        out.append(f"  [VIOLATION] {len(report.rotation_due)} RESOLVED unrotated — {ids}")
    if report.unmarked:
        ids = ", ".join(e.label for e in report.unmarked)
        out.append(f"  [VIOLATION] {len(report.unmarked)} entries lack an OPEN/RESOLVED marker — {ids}")
    if report.phase_dumps:
        ids = ", ".join(e.label for e in report.phase_dumps)
        out.append(f"  [VIOLATION] {len(report.phase_dumps)} per-phase dump sections — {ids}")
    if report.over_cap:
        ids = ", ".join(f"{e.label} ({e.line_count} ln)" for e in report.over_cap)
        out.append(
            f"  [VIOLATION] {len(report.over_cap)} entr"
            f"{'y' if len(report.over_cap) == 1 else 'ies'} over the {MAX_ENTRY_LINES}-line cap — {ids}"
        )

    if not report.has_violations and not violations_only:
        out.append("  clean — no lifecycle violations")
    return "\n".join(out)


# ------------------------------------------------------------------ dangling IDs


# BACKLOG IDs are `<phase>_<component>_<n>` (`sgh1_task-diff-guard_exit_1`). Plain
# snake_case code identifiers and test names (`filtered_n`, `test_stop_settles_...`)
# never contain a hyphen — Python/JSON identifiers can't. Requiring one keeps this
# scan from flagging function/field names as dangling citations, at the cost of the
# handful of real IDs coined without one (`oxl_wayfinder_1`) going unscanned — a
# documented gap, not a bug: a checker with a high false-positive rate gets ignored.
#
# Backticks are the citation contract, not a formatting choice: wrapping an ID in
# backticks asserts "this points at a filed entry" and this scan enforces that
# assertion (a match with no `## ` header in BACKLOG.md or the archive is a
# [VIOLATION]). Plain text is invisible to CITATION_RE on purpose — it lets a
# document *discuss* an ID (e.g. explain why it's out of scope) without asserting
# a live pointer to it. Reformatting a plain-text mention into backticks turns a
# discussion into a citation; if that ID has no header yet, the scan is right to
# flag it as newly dangling — that is not a false positive introduced by this tool.
CITATION_RE = re.compile(r"`([a-z][a-z0-9_-]*)`")
ID_SHAPE_RE = re.compile(r"^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)+$")

# The phase-archive directory is tracked under two casings in this repo — `History/`
# (32 files) and `history/` (50 files) — coexisting only because `core.ignorecase=true`
# masks the split on Windows checkouts (a separate, out-of-scope defect). Matching must
# therefore be case-insensitive or the scan silently misses one casing on a
# case-sensitive checkout.
ARCHIVE_DIR_NAME = "history"
ARCHIVE_BASENAME = "BACKLOG-archive.md"


def looks_like_backlog_id(token: str) -> bool:
    """Heuristic filter — see module comment above `CITATION_RE`."""
    return bool(ID_SHAPE_RE.fullmatch(token)) and "-" in token and "_" in token


def is_archived_path(md_path: Path, root: Path) -> bool:
    """True if `md_path`'s top-level component under `root` is the phase-archive
    directory (`History/` or `history/`, matched case-insensitively — see
    `ARCHIVE_DIR_NAME`)."""
    try:
        rel = md_path.relative_to(root)
    except ValueError:
        rel = md_path
    parts = rel.parts
    return bool(parts) and parts[0].lower() == ARCHIVE_DIR_NAME


def _case_insensitive_match(names: tuple[str, ...], target: str) -> str | None:
    """Return the entry of `names` matching `target` case-insensitively, or None.

    Pure string comparison — no disk access — so this is unit-testable independent of
    the filesystem's own case-folding. This repo's Windows checkouts run
    `core.ignorecase=true`, which would otherwise mask a broken match entirely: a test
    built only on a real directory (`tmp_path`) can pass by accident of NTFS case
    folding rather than by the matching logic actually being case-insensitive.
    """
    target_lower = target.lower()
    for name in names:
        if name.lower() == target_lower:
            return name
    return None


@dataclass(frozen=True)
class ArchiveResolution:
    """Outcome of locating the phase-archive file on disk.

    `path` is the resolved archive file, or `None` if it could not be found. When
    `path` is `None`, `archive_dir_found` distinguishes *why*, so a reader (and
    `format_archive_status`) can tell a genuinely fresh project (no archive directory
    at all — quiet, legitimate) from an archive that is expected but unresolvable
    (the directory exists but no matching file is inside it — loud, a defect).
    """

    path: Path | None
    archive_dir_found: bool


def resolve_archive_path(scan_root: Path) -> ArchiveResolution:
    """Locate `<scan_root>/<History|history>/BACKLOG-archive.md`, matching both the
    directory and file component case-insensitively via `_case_insensitive_match` —
    reusing the same convention as `ARCHIVE_DIR_NAME`/`is_archived_path` rather than
    assuming one casing (this repo tracks both `History/` and `history/` on disk;
    see `is_archived_path`'s docstring). Never raises for a missing `scan_root`,
    archive directory, or archive file — all three resolve to `path=None`.
    """
    if not scan_root.is_dir():
        return ArchiveResolution(path=None, archive_dir_found=False)
    dir_name = _case_insensitive_match(
        tuple(p.name for p in scan_root.iterdir() if p.is_dir()), ARCHIVE_DIR_NAME
    )
    if dir_name is None:
        return ArchiveResolution(path=None, archive_dir_found=False)
    archive_dir = scan_root / dir_name
    file_name = _case_insensitive_match(
        tuple(p.name for p in archive_dir.iterdir() if p.is_file()), ARCHIVE_BASENAME
    )
    if file_name is None:
        return ArchiveResolution(path=None, archive_dir_found=True)
    return ArchiveResolution(path=archive_dir / file_name, archive_dir_found=True)


def format_archive_status(
    resolution: ArchiveResolution, scan_root: Path, violations_only: bool = False
) -> str:
    """Render check 6's own archive-resolution outcome.

    Reports a [VIOLATION] when an archive directory exists but no matching file was
    found inside it — an oracle-discipline defect (testing-strategy.md §3): silently
    treating that as "0 known archived IDs" would make every archived-entry citation
    read as dangling. A genuinely fresh project (no archive directory at all) gets a
    quiet note instead, never a hard failure — that state is legitimate, not a defect.
    """
    if resolution.path is not None:
        return ""
    searched = scan_root / ARCHIVE_DIR_NAME / ARCHIVE_BASENAME
    if resolution.archive_dir_found:
        return (
            f"  [VIOLATION] archive unresolved — a {ARCHIVE_DIR_NAME}/ directory "
            f"exists under {scan_root} but no {ARCHIVE_BASENAME} was found inside it "
            f"(case-insensitive match failed); searched for {searched}"
        )
    if violations_only:
        return ""
    return (
        f"  archive — no {ARCHIVE_DIR_NAME}/ directory under {scan_root} yet; "
        "nothing has been rotated, not a violation"
    )


@dataclass(frozen=True)
class Citation:
    """One backtick-quoted, ID-shaped token found in a durable record."""

    id: str
    file: Path
    line_no: int


def known_backlog_ids(backlog_path: Path, archive_path: Path | None) -> frozenset[str]:
    """Every `## ` header ID defined in the active BACKLOG or its resolved archive.

    `archive_path` is `None` when `resolve_archive_path` could not locate an archive
    file — contributes zero IDs in that case, same as a missing `backlog_path`.
    """
    ids: set[str] = set()
    paths = (backlog_path,) if archive_path is None else (backlog_path, archive_path)
    for path in paths:
        if path.is_file():
            text = path.read_text(encoding="utf-8", errors="ignore")
            ids.update(e.label for e in parse_entries(text))
    return frozenset(ids)


def scan_citations(root: Path, exclude: frozenset[Path]) -> tuple[Citation, ...]:
    """Find every ID-shaped backtick token under `root/**/*.md`.

    Active-only scope: skips `.agent/` — hook-generated snapshots and session state,
    not durable records (the creation invariant scopes to PLAN/TODO/DECISION_LOG/
    AUDIT_REPORT/phase reports/`learnings/`, none of which live there) — and skips
    the phase-archive directory itself (`History/`/`history/`, see `is_archived_path`):
    a citation inside an already-archived record is a historical fact about what that
    record said at the time, not a live broken link the creation invariant governs.
    """
    citations: list[Citation] = []
    for md_path in sorted(root.rglob("*.md")):
        if (
            md_path.resolve() in exclude
            or ".agent" in md_path.parts
            or is_archived_path(md_path, root)
        ):
            continue
        text = md_path.read_text(encoding="utf-8", errors="ignore")
        for line_no, line in enumerate(text.splitlines(), start=1):
            for token in CITATION_RE.findall(line):
                if looks_like_backlog_id(token):
                    citations.append(Citation(id=token, file=md_path, line_no=line_no))
    return tuple(citations)


def find_dangling_citations(
    *, backlog_path: Path, archive_path: Path | None, scan_root: Path
) -> tuple[Citation, ...]:
    """Citations of IDs with no header in BACKLOG.md or the archive (archive-aware).

    `archive_path` may be `None` (see `resolve_archive_path`) — the scan still runs,
    it simply contributes zero archived IDs.
    """
    known = known_backlog_ids(backlog_path, archive_path)
    exclude = {backlog_path.resolve()}
    if archive_path is not None:
        exclude.add(archive_path.resolve())
    citations = scan_citations(scan_root, exclude=frozenset(exclude))
    return tuple(c for c in citations if c.id not in known)


def format_dangling_report(citations: tuple[Citation, ...], violations_only: bool = False) -> str:
    """Render the dangling-ID scan result — one line per unique offending ID."""
    if not citations:
        return "" if violations_only else "  dangling-ID scan — clean, 0 unresolved citations"
    unique_ids = sorted({c.id for c in citations})
    lines = [f"  [VIOLATION] {len(unique_ids)} dangling ID citation(s) — {', '.join(unique_ids)}"]
    for cid in unique_ids:
        first = next(c for c in citations if c.id == cid)
        lines.append(
            f"    {cid}: first cited {first.file}:{first.line_no} — no header in "
            "BACKLOG.md or History/BACKLOG-archive.md"
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit an Artifacts/BACKLOG.md for lifecycle violations.\n\n" + CHECKS_HELP,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "path",
        nargs="?",
        type=Path,
        default=DEFAULT_BACKLOG,
        help=f"Path to the BACKLOG file (default: {DEFAULT_BACKLOG})",
    )
    parser.add_argument(
        "--violations-only",
        action="store_true",
        help="Suppress output entirely when the file is clean.",
    )
    args = parser.parse_args()

    rendered_parts: list[str] = []
    exit_code = 0

    if not args.path.is_file():
        # A project with no deferred work has no BACKLOG — that is not a violation.
        if not args.violations_only:
            print(f"No BACKLOG at {args.path} — nothing to audit.")
    else:
        report = audit(args.path)
        rendered = format_report(report, violations_only=args.violations_only)
        if rendered:
            rendered_parts.append(rendered)
        if report.has_violations:
            exit_code = 1

    # Check 6 spans files beyond the single audited path — scoped to the BACKLOG's
    # own Artifacts/ directory (sibling `history/BACKLOG-archive.md`, either tracked
    # casing — see `resolve_archive_path`), never absent just because `path` itself
    # is missing.
    scan_root = args.path.parent
    if scan_root.is_dir():
        resolution = resolve_archive_path(scan_root)
        archive_status = format_archive_status(
            resolution, scan_root, violations_only=args.violations_only
        )
        if archive_status:
            rendered_parts.append(archive_status)
        if resolution.archive_dir_found and resolution.path is None:
            exit_code = 1

        dangling = find_dangling_citations(
            backlog_path=args.path, archive_path=resolution.path, scan_root=scan_root
        )
        dangling_rendered = format_dangling_report(dangling, violations_only=args.violations_only)
        if dangling_rendered:
            rendered_parts.append(dangling_rendered)
        if dangling:
            exit_code = 1

    if rendered_parts:
        print("\n".join(rendered_parts))
    return exit_code


if __name__ == "__main__":
    # Report text carries em-dashes; Windows consoles default to cp1252 and mangle them.
    # Done only at CLI entry — reassigning sys.stdout inside main() would close pytest's
    # capture buffer and cascade teardown errors across the whole suite.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
