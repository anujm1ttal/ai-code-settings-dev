#!/usr/bin/env python3
"""Deployed-vs-Source Drift Detector (DSD-1 T1)

Compares `~/.claude/` (deployed) against this repo (source) over EXACTLY the
surface `scripts/deploy.sh` step 5 writes: 6 directories, recursively
(`agents`, `rules`, `skills`, `templates`, `commands`, `hooks`) plus 3 file
mappings (`CLAUDE-global.md` -> `CLAUDE.md`, `cheatsheet.md`, `README.md`).
Nothing else is read or written — see EXCLUDED_PATHS for what is deliberately
out of scope and why.

Read-and-report only (Hard Rule 1, DSD-1-Plan.md Sec.4): this module contains
no write-capable calls of any kind. A tool that "fixes" drift by picking a
winner unattended is the one outcome worse than drift itself.

Discriminator (the core design decision, DSD-1-Plan.md Sec.T1):
When a source/deployed pair differs after CR-insensitive normalisation, the
mismatch is classified by asking whether the DEPLOYED content has ever
existed as a committed blob anywhere in the SOURCE file's git history
(`content_matches_git_history`):

  - Match found  -> the deployed copy is simply an older, already-committed
    revision that source has since moved past. This is the normal pre-deploy
    state -> "source-ahead". Not a loss; must not block a deploy (Risk 2).
  - No match anywhere in history -> the deployed content was typed directly
    into the deployed location and captured in NO commit of this repo. This
    is exactly the `fd7af9b` signature (see that commit's message): a
    production-only edit one un-run `deploy.sh` away from silent, permanent
    loss -> "deployed-ahead".

This fails CLOSED: any git invocation failure (source root is not a git
repository, `git` itself is unavailable, or the file was never tracked) is
treated as "no match", i.e. deployed-ahead. Silence about history is never
treated as proof of staleness.

Usage:
    python scripts/verify_deploy_parity.py [--source-root PATH] [--dest-root PATH]

Exit code: 0 if no drift, or only source-ahead/source-only mismatches exist.
           1 if any deployed-ahead or deployed-only mismatch is found.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
import argparse
import subprocess
import sys

SURFACE_DIRS: tuple[str, ...] = ("agents", "rules", "skills", "templates", "commands", "hooks")

# (source-repo-relative name, deployed-relative name) — CLAUDE-global.md is
# the deployable global; the repo's own CLAUDE.md is repo-specific and is
# NOT part of this mapping.
SURFACE_FILES: tuple[tuple[str, str], ...] = (
    ("CLAUDE-global.md", "CLAUDE.md"),
    ("cheatsheet.md", "cheatsheet.md"),
    ("README.md", "README.md"),
)

EXCLUDED_PATHS: tuple[str, ...] = (
    "optional_plugins/ - deliberately excluded by deploy.sh (see the optional_plugins "
    "note above deploy.sh's step-5 copy loop); "
    "real plugin installs live in ~/.claude/plugins/ via the marketplace, not a raw copy.",
    "settings.json - never written by deploy.sh; hook wiring is validated separately "
    "by scripts/verify_hook_wiring.py.",
)

DEFAULT_SOURCE_ROOT: Path = Path(__file__).resolve().parent.parent
DEFAULT_DEST_ROOT: Path = Path.home() / ".claude"


class Classification(str, Enum):
    """One of the four mismatch polarities (DSD-1-Plan.md Sec.T1)."""

    SOURCE_AHEAD = "source-ahead"
    DEPLOYED_AHEAD = "deployed-ahead"
    DEPLOYED_ONLY = "deployed-only"
    SOURCE_ONLY = "source-only"


LOSS_CLASSIFICATIONS: tuple[Classification, ...] = (
    Classification.DEPLOYED_AHEAD,
    Classification.DEPLOYED_ONLY,
)


@dataclass(frozen=True)
class Mismatch:
    """A single path where source and deployed content disagree."""

    relpath: str
    classification: Classification
    source_path: Path | None
    deployed_path: Path | None


@dataclass(frozen=True)
class ParityReport:
    """The full result of one comparison run."""

    mismatches: tuple[Mismatch, ...]

    @property
    def loss_mismatches(self) -> tuple[Mismatch, ...]:
        return tuple(m for m in self.mismatches if m.classification in LOSS_CLASSIFICATIONS)

    @property
    def has_loss(self) -> bool:
        return bool(self.loss_mismatches)


def normalize_content(raw: bytes) -> bytes:
    """CR-insensitive, binary-safe normalisation (Risk 1).

    Operates purely on bytes — never decodes to str — so this is safe to
    apply to non-text/binary files without a decode error; the only
    transform is collapsing CRLF/CR sequences to LF.
    """
    return raw.replace(b"\r\n", b"\n").replace(b"\r", b"\n")


def content_matches_git_history(repo_root: Path, relpath: str, content: bytes) -> bool:
    """True if `content` (normalised) equals the blob at `relpath` in ANY
    commit reachable from `repo_root`'s current HEAD. See module docstring
    "Discriminator" for the reasoning; fails closed (returns False) on any
    git invocation failure.
    """
    target = normalize_content(content)
    try:
        log_result = subprocess.run(
            ["git", "-C", str(repo_root), "log", "--format=%H", "--", relpath],
            capture_output=True,
            text=True,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

    commit_hashes = [line for line in log_result.stdout.splitlines() if line]
    for commit_hash in commit_hashes:
        try:
            blob_result = subprocess.run(
                ["git", "-C", str(repo_root), "show", f"{commit_hash}:{relpath}"],
                capture_output=True,
                check=True,
            )
        except subprocess.CalledProcessError:
            continue
        if normalize_content(blob_result.stdout) == target:
            return True
    return False


def _relative_files(root: Path) -> set[str]:
    """Every regular file under `root`, as forward-slash relative paths."""
    if not root.is_dir():
        return set()
    return {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()}


def classify_pair(
    source_path: Path, deployed_path: Path, relpath: str, repo_root: Path
) -> Mismatch | None:
    """Classify one (source, deployed) path pair. Returns None if identical
    (after CR-insensitive normalisation) or both absent."""
    source_exists = source_path.is_file()
    deployed_exists = deployed_path.is_file()

    if not source_exists and not deployed_exists:
        return None
    if source_exists and not deployed_exists:
        return Mismatch(relpath, Classification.SOURCE_ONLY, source_path, None)
    if deployed_exists and not source_exists:
        return Mismatch(relpath, Classification.DEPLOYED_ONLY, None, deployed_path)

    source_bytes = source_path.read_bytes()
    deployed_bytes = deployed_path.read_bytes()
    if normalize_content(source_bytes) == normalize_content(deployed_bytes):
        return None

    if content_matches_git_history(repo_root, relpath, deployed_bytes):
        classification = Classification.SOURCE_AHEAD
    else:
        classification = Classification.DEPLOYED_AHEAD
    return Mismatch(relpath, classification, source_path, deployed_path)


def compare_directory(
    source_dir: Path, deployed_dir: Path, dirname: str, repo_root: Path
) -> list[Mismatch]:
    """Compare every file recursively under one of the 6 surface dirs."""
    relpaths = _relative_files(source_dir) | _relative_files(deployed_dir)
    mismatches: list[Mismatch] = []
    for rel in sorted(relpaths):
        result = classify_pair(
            source_dir / rel, deployed_dir / rel, f"{dirname}/{rel}", repo_root
        )
        if result is not None:
            mismatches.append(result)
    return mismatches


def build_report(source_root: Path, dest_root: Path) -> ParityReport:
    """Run the full comparison over the deploy.sh step-5 surface."""
    mismatches: list[Mismatch] = []
    for dirname in SURFACE_DIRS:
        mismatches.extend(
            compare_directory(source_root / dirname, dest_root / dirname, dirname, source_root)
        )
    for source_name, dest_name in SURFACE_FILES:
        result = classify_pair(
            source_root / source_name, dest_root / dest_name, source_name, source_root
        )
        if result is not None:
            mismatches.append(result)
    return ParityReport(mismatches=tuple(mismatches))


def format_scope(source_root: Path, dest_root: Path) -> str:
    """Print covered surface AND stated exclusions (Risk 3) — a checker that
    silently ignores paths while reporting 'no drift' overstates its own
    coverage."""
    lines = [f"Deploy parity scope: {source_root} -> {dest_root}", "Covered:"]
    for dirname in SURFACE_DIRS:
        lines.append(f"  - {dirname}/ (recursive)")
    for source_name, dest_name in SURFACE_FILES:
        lines.append(f"  - {source_name} -> {dest_name}")
    lines.append("Excluded (by design, not covered by this check):")
    for excluded in EXCLUDED_PATHS:
        lines.append(f"  - {excluded}")
    return "\n".join(lines)


def format_report(report: ParityReport, source_root: Path, dest_root: Path) -> str:
    lines = [format_scope(source_root, dest_root), ""]
    if not report.mismatches:
        lines.append("OK: no drift detected across the covered surface.")
        return "\n".join(lines)

    for classification in Classification:
        subset = [m for m in report.mismatches if m.classification is classification]
        if not subset:
            continue
        lines.append(f"{classification.value} ({len(subset)}):")
        for mismatch in subset:
            lines.append(f"  [{mismatch.classification.value}] {mismatch.relpath}")
        lines.append("")

    if report.has_loss:
        lines.append("DRIFT DETECTED - the deployed copy carries content the source lacks.")
        lines.append(
            "Back-port instruction: copy the deployed-ahead/deployed-only files listed "
            "above into the source tree (git add + commit) BEFORE running deploy.sh - "
            "the next deploy's `rm -rf` will silently delete this content otherwise."
        )
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Compare deployed ~/.claude/ content against source (DSD-1)."
    )
    parser.add_argument(
        "--source-root", default=None, help="Repo root (default: inferred from script location)"
    )
    parser.add_argument("--dest-root", default=None, help="Deployed root (default: ~/.claude)")
    args = parser.parse_args(argv)

    source_root = Path(args.source_root).resolve() if args.source_root else DEFAULT_SOURCE_ROOT
    dest_root = Path(args.dest_root).resolve() if args.dest_root else DEFAULT_DEST_ROOT

    report = build_report(source_root, dest_root)
    print(format_report(report, source_root, dest_root))
    return 1 if report.has_loss else 0


if __name__ == "__main__":
    sys.exit(main())
