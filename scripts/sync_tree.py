"""Mirror a source directory into a destination, rewriting only files whose bytes differ.

Used by deploy.sh step 5 instead of `rm -rf` + `cp -r`: an identical file keeps its mtime,
so open Claude Code sessions do not re-inject it as "changed on disk".

Usage: python scripts/sync_tree.py SRC DST
"""
from __future__ import annotations

import filecmp
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SyncResult:
    copied: int
    removed: int
    unchanged: int


def mirror(src: Path, dst: Path) -> SyncResult:
    if not src.is_dir():
        raise NotADirectoryError(f"sync source is not a directory: {src}")
    dst.mkdir(parents=True, exist_ok=True)

    src_files = {p.relative_to(src) for p in src.rglob("*") if p.is_file()}
    copied = unchanged = 0
    for rel in sorted(src_files):
        s, d = src / rel, dst / rel
        if d.is_file() and filecmp.cmp(s, d, shallow=False):
            unchanged += 1
            continue
        if d.is_dir():
            shutil.rmtree(d)
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(s, d)
        copied += 1

    removed = 0
    for p in sorted(dst.rglob("*"), key=lambda q: len(q.parts), reverse=True):
        rel = p.relative_to(dst)
        if p.is_file() or p.is_symlink():
            if rel not in src_files:
                p.unlink()
                removed += 1
        elif p.is_dir() and not any(p.iterdir()) and not (src / rel).is_dir():
            p.rmdir()

    return SyncResult(copied=copied, removed=removed, unchanged=unchanged)


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: sync_tree.py SRC DST", file=sys.stderr)
        return 2
    result = mirror(Path(argv[0]), Path(argv[1]))
    print(f"copied {result.copied}, removed {result.removed}, unchanged {result.unchanged}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
