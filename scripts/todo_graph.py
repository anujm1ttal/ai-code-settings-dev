#!/usr/bin/env python3
"""
Task-Graph Validator

Checks the task-dependency grammar defined in `rules/common/orchestration.md`
§Artifacts/TODO.md Authority (Extended format + Mode tag) and consumed by
`commands/afk.md` §2 Frontier Definition:

    - [ ] [agent] Tn: Description — Success: metric — Mode: AFK — Blocked by: Tm, Tk

Until this tool existed the grammar was defined in one file, consumed by another,
and checked by nothing. IGH-1 shipped four redundant chain edges — the exact
anti-pattern `orchestration.md` names verbatim — through a passing auditor gate.

Checks:
  1. Cycle          — a blocker loop; deadlocks `/afk` as "frontier empty, work remains"
  2. Unknown ID     — `Blocked by:` naming a task that does not exist in the file
  3. Malformed      — bad status marker, or a checkbox task line with no `[agent]`
  4. Empty parse    — a non-empty TODO yielding zero tasks (the blind-zero guard)
  5. Redundant edge — ADVISORY only; never changes the exit code

A redundant edge is defined tightly to avoid false positives: a task's blocker set
is exactly `{the immediately preceding task}`. A task blocked by a non-adjacent
predecessor, or by two or more tasks, is never flagged — those are precisely the
cases where the graph diverges from list order and the clause earns its place.

Scope: phase TODOs (`Artifacts/Plans/*-TODO.md`). The top-level `Artifacts/TODO.md`
uses an initiative-level format (`- [x] **NAME — Title**`, no `[agent]` field) and is
deliberately NOT a target.

Known limitation: duplicate task IDs within one file are not detected; ID resolution
is set-based, so a duplicate silently collapses. No instance has been observed.

Read-only by contract: this tool never edits, marks, or rotates any TODO file.
Marking `[-]` and `[x]` stays with the coder and auditor per TODO Authority.

Zero repo imports — stdlib only, single file, copyable into any project.

Exit code: 0 clean (advisories allowed), 1 on any violation (CI-usable).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import argparse
import re
import sys

DEFAULT_PLANS_DIR = Path("Artifacts/Plans")
PHASE_TODO_GLOB = "*-TODO.md"

# `- [x] [auditor] T1: … — Mode: AFK — Blocked by: T1`
TASK_RE = re.compile(r"^- \[(?P<status>[ x\-])\] \[(?P<agent>[a-z][a-z\-]*)\]\s*(?P<rest>.*)$")
# A checkbox line whose status char is not one of ` `, `-`, `x`.
BAD_STATUS_RE = re.compile(r"^- \[(?P<status>[^ x\-\]])\]")
# A checkbox line with a valid status but no `[agent]` field.
NO_AGENT_RE = re.compile(r"^- \[[ x\-]\](?!\s*\[[a-z])")

ID_RE = re.compile(r"^(?P<id>T\d+):")
# Tag separators are em-dashes in practice, but matching on the label alone avoids a
# blind zero if someone types a hyphen — a silently dropped tag is worse than a loose match.
MODE_RE = re.compile(r"\bMode:\s*(?P<mode>[A-Za-z]+)")
BLOCKED_RE = re.compile(r"\bBlocked by:\s*(?P<ids>T\d+(?:\s*,\s*T\d+)*)")

SEVERITY_VIOLATION = "VIOLATION"
SEVERITY_ADVISORY = "ADVISORY"


@dataclass(frozen=True)
class Task:
    """One `- [ ] [agent] …` line of a phase TODO."""

    task_id: str | None
    status: str
    agent: str
    mode: str | None
    blockers: tuple[str, ...]
    line_no: int
    order: int

    @property
    def label(self) -> str:
        return self.task_id or f"line {self.line_no}"


@dataclass(frozen=True)
class Finding:
    """One check result. Advisories never affect the exit code."""

    severity: str
    code: str
    message: str


@dataclass(frozen=True)
class Report:
    """Validation outcome for a single phase TODO file."""

    path: Path
    line_count: int
    tasks: tuple[Task, ...]
    findings: tuple[Finding, ...]

    @property
    def violations(self) -> tuple[Finding, ...]:
        return tuple(f for f in self.findings if f.severity == SEVERITY_VIOLATION)

    @property
    def advisories(self) -> tuple[Finding, ...]:
        return tuple(f for f in self.findings if f.severity == SEVERITY_ADVISORY)

    @property
    def edge_count(self) -> int:
        return sum(len(t.blockers) for t in self.tasks)

    @property
    def has_violations(self) -> bool:
        return bool(self.violations)


def parse_tasks(text: str) -> tuple[Task, ...]:
    """Extract every task line from a phase TODO, in list order."""
    tasks: list[Task] = []
    for line_idx, line in enumerate(text.splitlines()):
        match = TASK_RE.match(line)
        if not match:
            continue
        rest = match.group("rest")
        id_match = ID_RE.match(rest)
        mode_match = MODE_RE.search(rest)
        blocked_match = BLOCKED_RE.search(rest)
        blockers = (
            tuple(part.strip() for part in blocked_match.group("ids").split(","))
            if blocked_match
            else ()
        )
        tasks.append(
            Task(
                task_id=id_match.group("id") if id_match else None,
                status=match.group("status"),
                agent=match.group("agent"),
                mode=mode_match.group("mode") if mode_match else None,
                blockers=blockers,
                line_no=line_idx + 1,
                order=len(tasks),
            )
        )
    return tuple(tasks)


def check_malformed(text: str) -> tuple[Finding, ...]:
    """Bad status markers and checkbox task lines missing an `[agent]` field."""
    findings: list[Finding] = []
    for line_idx, line in enumerate(text.splitlines()):
        if BAD_STATUS_RE.match(line):
            findings.append(
                Finding(
                    SEVERITY_VIOLATION,
                    "MALFORMED_STATUS",
                    f"line {line_idx + 1}: status marker is not one of `[ ]`, `[-]`, `[x]`",
                )
            )
        elif NO_AGENT_RE.match(line):
            findings.append(
                Finding(
                    SEVERITY_VIOLATION,
                    "MISSING_AGENT",
                    f"line {line_idx + 1}: task line has no `[agent]` field",
                )
            )
    return tuple(findings)


def check_unknown_blockers(tasks: tuple[Task, ...]) -> tuple[Finding, ...]:
    """`Blocked by:` naming an ID that does not exist in this file."""
    known = {t.task_id for t in tasks if t.task_id}
    return tuple(
        Finding(
            SEVERITY_VIOLATION,
            "UNKNOWN_BLOCKER",
            f"{task.label}: `Blocked by: {blocker}` — no such task in this file",
        )
        for task in tasks
        for blocker in task.blockers
        if blocker not in known
    )


def find_cycle(tasks: tuple[Task, ...]) -> tuple[str, ...]:
    """Return one cycle as an ID path, or () if the graph is acyclic (three-colour DFS)."""
    graph = {t.task_id: t.blockers for t in tasks if t.task_id}
    visiting: set[str] = set()
    done: set[str] = set()
    path: list[str] = []

    def walk(node: str) -> tuple[str, ...]:
        if node in done or node not in graph:
            return ()
        if node in visiting:
            return tuple(path[path.index(node) :]) + (node,)
        visiting.add(node)
        path.append(node)
        for blocker in graph[node]:
            if cycle := walk(blocker):
                return cycle
        path.pop()
        visiting.discard(node)
        done.add(node)
        return ()

    for task_id in graph:
        if cycle := walk(task_id):
            return cycle
    return ()


def check_redundant_edges(tasks: tuple[Task, ...]) -> tuple[Finding, ...]:
    """ADVISORY: a blocker set of exactly `{immediately preceding task}` adds nothing to list order."""
    findings: list[Finding] = []
    for task in tasks:
        if task.order == 0 or len(task.blockers) != 1:
            continue
        previous = tasks[task.order - 1]
        if previous.task_id and task.blockers[0] == previous.task_id:
            findings.append(
                Finding(
                    SEVERITY_ADVISORY,
                    "REDUNDANT_EDGE",
                    f"{task.label}: `Blocked by: {previous.task_id}` is implied by list order — "
                    f"omit it (orchestration.md §TODO Authority)",
                )
            )
    return tuple(findings)


def validate(path: Path) -> Report:
    """Read and validate one phase TODO. Raises FileNotFoundError if absent."""
    text = path.read_text(encoding="utf-8")
    tasks = parse_tasks(text)
    findings: list[Finding] = list(check_malformed(text))

    # Blind-zero guard: a non-empty TODO that parses to nothing means the grammar drifted
    # or the parser broke. Reporting "clean" there would be exactly the false negative
    # `testing-strategy.md` §Oracle Discipline forbids.
    if not tasks and text.strip():
        findings.append(
            Finding(
                SEVERITY_VIOLATION,
                "EMPTY_PARSE",
                "file is non-empty but no task lines parsed — grammar drift or parser regression",
            )
        )

    findings.extend(check_unknown_blockers(tasks))
    if cycle := find_cycle(tasks):
        findings.append(
            Finding(SEVERITY_VIOLATION, "CYCLE", f"dependency cycle: {' -> '.join(cycle)}")
        )
    findings.extend(check_redundant_edges(tasks))

    return Report(
        path=path,
        line_count=len(text.splitlines()),
        tasks=tasks,
        findings=tuple(findings),
    )


def format_report(report: Report, violations_only: bool = False) -> str:
    """Render a human-readable validation summary for one file."""
    out: list[str] = []
    show_header = not violations_only or report.has_violations
    if show_header:
        out.append(
            f"Task graph — {report.path}\n"
            f"  {len(report.tasks)} tasks / {report.edge_count} dependency edges"
        )
    for finding in report.violations:
        out.append(f"  [VIOLATION] {finding.code} — {finding.message}")
    if not violations_only:
        for finding in report.advisories:
            out.append(f"  [ADVISORY]  {finding.code} — {finding.message}")
        if not report.findings:
            out.append("  clean — no graph violations")
    return "\n".join(out)


def resolve_targets(path: Path | None) -> list[Path]:
    """One explicit file, or every phase TODO under Artifacts/Plans/."""
    if path is not None:
        return [path]
    if not DEFAULT_PLANS_DIR.is_dir():
        return []
    return sorted(DEFAULT_PLANS_DIR.glob(PHASE_TODO_GLOB))


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate the task-dependency graph in phase TODO files."
    )
    parser.add_argument(
        "path",
        nargs="?",
        type=Path,
        default=None,
        help=f"A phase TODO file (default: every {PHASE_TODO_GLOB} under {DEFAULT_PLANS_DIR})",
    )
    parser.add_argument(
        "--violations-only",
        action="store_true",
        help="Suppress advisories and clean-file output.",
    )
    args = parser.parse_args()

    targets = resolve_targets(args.path)
    if not targets:
        # A project with no phase TODOs has no graph to check — not a violation.
        if not args.violations_only:
            print(f"No phase TODOs found under {DEFAULT_PLANS_DIR} — nothing to validate.")
        return 0

    failed = False
    for target in targets:
        if not target.is_file():
            print(f"No such TODO: {target}")
            return 1
        report = validate(target)
        rendered = format_report(report, violations_only=args.violations_only)
        if rendered:
            print(rendered)
        failed = failed or report.has_violations
    return 1 if failed else 0


if __name__ == "__main__":
    # Report text carries em-dashes; Windows consoles default to cp1252 and mangle them.
    # Done only at CLI entry — reassigning sys.stdout inside main() would close pytest's
    # capture buffer and cascade teardown errors across the whole suite.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
