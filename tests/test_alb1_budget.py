"""ALB-1 T1 (RED) — byte-ceiling tests per Plan Sec3 (Evidence baseline) and Sec2 HR3.

Mirrors the ALB-1 measurement script's logic (disk-byte basis, frontmatter/HTML-comment
bytes counted as-is -- Plan Sec3: "HTML comments and frontmatter stay in place and are never
credited [towards a token saving]... deleting them would move the disk metric without saving
a token", i.e. don't game the ceiling by stripping comments; it does not mean strip them from
the measurement). Self-contained so this suite runs standalone on a clone.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
RULES_DIR = REPO_ROOT / "rules"
CLAUDE_GLOBAL = REPO_ROOT / "CLAUDE-global.md"

FM = re.compile(r"\A---\r?\n(.*?)\r?\n---", re.S)


def _has_paths(p: Path) -> bool:
    text = p.read_text(encoding="utf-8")
    m = FM.match(text)
    return bool(m and re.search(r"(?m)^paths\s*:", m.group(1)))


def _always_loaded_files() -> list[Path]:
    """CLAUDE-global.md + every rules/**/*.md WITHOUT a `paths:` frontmatter key."""
    rules = sorted(RULES_DIR.rglob("*.md"))
    return [CLAUDE_GLOBAL] + [r for r in rules if not _has_paths(r)]


def _conditional_files() -> list[Path]:
    return [r for r in sorted(RULES_DIR.rglob("*.md")) if _has_paths(r)]


# Plan Sec3 per-file ceilings (target bytes, post-diet)
PER_FILE_CEILINGS = {
    CLAUDE_GLOBAL: 3_500,
    RULES_DIR / "common" / "orchestration.md": 9_700,
    RULES_DIR / "common" / "testing-strategy.md": 2_500,
    RULES_DIR / "common" / "model-routing.md": 3_000,
    RULES_DIR / "common" / "security.md": 1_800,  # user-approved 2026-09-30 (was 1,600): HR1 verbatim restore
    RULES_DIR / "common" / "coding-style.md": 4_900,  # user-approved 2026-09-30 (was 4,800)
}


@pytest.mark.parametrize(
    "path,ceiling",
    list(PER_FILE_CEILINGS.items()),
    ids=[p.relative_to(REPO_ROOT).as_posix() for p in PER_FILE_CEILINGS],
)
def test_per_file_ceiling(path: Path, ceiling: int) -> None:
    assert path.exists(), f"fixture stale: {path} missing"
    size = path.stat().st_size
    assert size <= ceiling, (
        f"{path.relative_to(REPO_ROOT)} is {size} B, over its Plan Sec3 ceiling of {ceiling} B "
        "-- relocate sections per Plan Sec5 before this can pass"
    )


def test_claude_md_standards_is_path_scoped_not_unconditional() -> None:
    """Plan Sec3: claude-md-standards 2,344 B -> 0 unconditional (path-scoped)."""
    p = RULES_DIR / "common" / "claude-md-standards.md"
    assert p.exists(), f"fixture stale: {p} missing"
    assert _has_paths(p), (
        f"{p.relative_to(REPO_ROOT)} still loads unconditionally (no `paths:` frontmatter) -- "
        "Plan Sec3 targets 0 B unconditional contribution via path-scoping"
    )


def test_token_economics_deleted_from_rules_common() -> None:
    """Plan Sec3: TOKEN-ECONOMICS 1,393 B -> 0 (deleted from rules/common/)."""
    p = RULES_DIR / "common" / "TOKEN-ECONOMICS.md"
    assert not p.exists(), (
        f"{p.relative_to(REPO_ROOT)} still present -- Plan Sec3 targets deletion after rehoming "
        "(see Sec5 TOKEN-ECONOMICS row; move-aside step for the deploy drift guard, T11)"
    )


def test_always_loaded_global_aggregate_ceiling() -> None:
    """Plan Sec3 binding metric: always-loaded global (CLAUDE-global.md + unconditional
    rules/**/*.md) must be <=30,200 B (user-approved 2026-09-30, was 30,000)."""
    files = _always_loaded_files()
    total = sum(f.stat().st_size for f in files)
    breakdown = ", ".join(f"{f.relative_to(REPO_ROOT)}={f.stat().st_size}" for f in files)
    assert total <= 30_200, (
        f"always-loaded global is {total} B, over the binding 30,200 B ceiling ({breakdown})"
    )


def test_all_rules_plus_claude_global_no_dup_guard() -> None:
    """Plan Sec3 no-dup guard: all rules + CLAUDE-global.md incl. conditional <=56,200 B.
    Passes today (no `paths:` files exist yet) and must keep passing as sections gain
    `paths:` homes -- this is an invariant, not a future-state row."""
    always = _always_loaded_files()
    cond = _conditional_files()
    total = sum(f.stat().st_size for f in always) + sum(f.stat().st_size for f in cond)
    assert total <= 56_200, f"all-rules total is {total} B, over the 56,200 B no-dup guard"


def test_hr3_every_rules_subdir_file_is_path_scoped() -> None:
    """Plan Sec2 HR3: no unconditional file under rules/** other than rules/common/*.md
    -- the harness walks rules/ recursively, so a subdir (e.g. rules/lang/) does not
    unload on its own; every file placed outside rules/common/ must carry `paths:`.
    Vacuously true today (no such subdir/files exist yet); becomes a real gate once
    T3/T4 create rules/lang/*.md."""
    common_dir = RULES_DIR / "common"
    outside_common = [
        p for p in sorted(RULES_DIR.rglob("*.md")) if common_dir not in p.parents
    ]
    unconditional = [p for p in outside_common if not _has_paths(p)]
    assert not unconditional, (
        f"HR3 violation: {[str(p.relative_to(REPO_ROOT)) for p in unconditional]} sit under "
        "rules/ outside rules/common/ without `paths:` frontmatter"
    )
