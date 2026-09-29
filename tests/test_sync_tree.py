"""scripts/sync_tree.py — content-aware mirror used by deploy.sh step 5.

Unchanged files must keep their mtime: a rewritten-but-identical file makes every open
Claude Code session re-inject it as "changed on disk", which is pure cache cost.
"""
import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import sync_tree  # noqa: E402

OLD = 1_000_000_000


def _tree(root: Path, files: dict[str, str]) -> None:
    for rel, text in files.items():
        p = root / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)


def test_identical_file_is_not_rewritten(tmp_path: Path):
    src, dst = tmp_path / "src", tmp_path / "dst"
    _tree(src, {"a.md": "same"})
    _tree(dst, {"a.md": "same"})
    os.utime(dst / "a.md", (OLD, OLD))
    result = sync_tree.mirror(src, dst)
    assert (dst / "a.md").stat().st_mtime == OLD
    assert result == sync_tree.SyncResult(copied=0, removed=0, unchanged=1)


def test_changed_and_new_files_are_copied(tmp_path: Path):
    src, dst = tmp_path / "src", tmp_path / "dst"
    _tree(src, {"a.md": "new", "sub/b.md": "added"})
    _tree(dst, {"a.md": "old"})
    result = sync_tree.mirror(src, dst)
    assert (dst / "a.md").read_text() == "new"
    assert (dst / "sub" / "b.md").read_text() == "added"
    assert result.copied == 2


def test_dest_only_files_and_empty_dirs_are_removed(tmp_path: Path):
    src, dst = tmp_path / "src", tmp_path / "dst"
    _tree(src, {"keep.md": "k"})
    _tree(dst, {"keep.md": "k", "gone/stale.md": "x", "stale.md": "y"})
    result = sync_tree.mirror(src, dst)
    assert sorted(p.relative_to(dst).as_posix() for p in dst.rglob("*")) == ["keep.md"]
    assert result.removed == 2


def test_missing_dest_is_created(tmp_path: Path):
    src, dst = tmp_path / "src", tmp_path / "dst"
    _tree(src, {"x/y.md": "z"})
    sync_tree.mirror(src, dst)
    assert (dst / "x" / "y.md").read_text() == "z"


def test_cli_exits_zero_and_reports_counts(tmp_path: Path):
    src, dst = tmp_path / "src", tmp_path / "dst"
    _tree(src, {"a.md": "1"})
    proc = subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "sync_tree.py"), str(src), str(dst)],
        capture_output=True, text=True,
    )
    assert proc.returncode == 0, proc.stderr
    assert "copied 1" in proc.stdout
