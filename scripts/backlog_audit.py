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
  1. Size          — active file over >250 lines OR >20 entries
  2. Rotation due  — RESOLVED entries still present while over threshold
  3. Unmarked      — entries carrying no OPEN/RESOLVED status marker
  4. Phase-dump    — `## N. <something> findings` headings, i.e. per-phase append
                     sections instead of entries (the failure mode that grew one
                     project's backlog to 1228 lines across 17 such sections)

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

MAX_LINES = 250
MAX_ENTRIES = 20

DEFAULT_BACKLOG = Path("Artifacts/BACKLOG.md")

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
    def has_violations(self) -> bool:
        return bool(self.over_size or self.rotation_due or self.unmarked or self.phase_dumps)


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
        f"(threshold {MAX_LINES}/{MAX_ENTRIES}: {size_flag})"
    )
    if not violations_only or report.has_violations:
        out.append(header)

    if report.over_size:
        out.append("  [VIOLATION] size — rotate oldest RESOLVED to History/BACKLOG-archive.md")
    if report.rotation_due:
        ids = ", ".join(e.label for e in report.rotation_due)
        out.append(f"  [VIOLATION] {len(report.rotation_due)} RESOLVED unrotated — {ids}")
    if report.unmarked:
        ids = ", ".join(e.label for e in report.unmarked)
        out.append(f"  [VIOLATION] {len(report.unmarked)} entries lack an OPEN/RESOLVED marker — {ids}")
    if report.phase_dumps:
        ids = ", ".join(e.label for e in report.phase_dumps)
        out.append(f"  [VIOLATION] {len(report.phase_dumps)} per-phase dump sections — {ids}")

    if not report.has_violations and not violations_only:
        out.append("  clean — no lifecycle violations")
    return "\n".join(out)


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit an Artifacts/BACKLOG.md for lifecycle violations.")
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

    if not args.path.is_file():
        # A project with no deferred work has no BACKLOG — that is not a violation.
        if not args.violations_only:
            print(f"No BACKLOG at {args.path} — nothing to audit.")
        return 0

    report = audit(args.path)
    rendered = format_report(report, violations_only=args.violations_only)
    if rendered:
        print(rendered)
    return 1 if report.has_violations else 0


if __name__ == "__main__":
    # Report text carries em-dashes; Windows consoles default to cp1252 and mangle them.
    # Done only at CLI entry — reassigning sys.stdout inside main() would close pytest's
    # capture buffer and cascade teardown errors across the whole suite.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
