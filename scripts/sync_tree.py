"""Mirror a source directory into a destination, rewriting only files whose bytes differ.

Used by deploy.sh step 5 instead of `rm -rf` + `cp -r`: an identical file keeps its mtime,
so open Claude Code sessions do not re-inject it as "changed on disk".

Usage: python scripts/sync_tree.py [--preserve PREFIX ...] SRC DST

`--preserve PREFIX` (repeatable, must end with "/") leaves dest-only files under that
dst-relative prefix alone instead of deleting them — for content installed only in the
destination that must never be vendored (licensed skills). Scoped to the exact prefix.
"""
from __future__ import annotations

import argparse
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


def mirror(src: Path, dst: Path, preserve: tuple[str, ...] = ()) -> SyncResult:
    if not src.is_dir():
        raise NotADirectoryError(f"sync source is not a directory: {src}")
    for prefix in preserve:
        if len(prefix) < 2 or not prefix.endswith("/"):
            raise ValueError(f"preserve prefix must be a non-root path ending in '/': {prefix!r}")
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
        if rel.as_posix().startswith(preserve):
            continue
        if p.is_file() or p.is_symlink():
            if rel not in src_files:
                p.unlink()
                removed += 1
        elif p.is_dir() and not any(p.iterdir()) and not (src / rel).is_dir():
            p.rmdir()

    return SyncResult(copied=copied, removed=removed, unchanged=unchanged)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="sync_tree.py")
    parser.add_argument("--preserve", action="append", default=[], metavar="PREFIX")
    parser.add_argument("src")
    parser.add_argument("dst")
    args = parser.parse_args(argv)
    try:
        result = mirror(Path(args.src), Path(args.dst), tuple(args.preserve))
    except ValueError as exc:
        print(f"sync_tree.py: {exc}", file=sys.stderr)
        return 2
    print(f"copied {result.copied}, removed {result.removed}, unchanged {result.unchanged}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
