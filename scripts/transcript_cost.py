#!/usr/bin/env python3
"""Transcript cost instrument -- where do tool calls, output tokens and result bytes go?

Reads Claude Code transcript JSONL (main sessions and `<session>/subagents/*.jsonl`) and
attributes every tool call to one category, so a workflow change (e.g. fewer `Artifacts/Temp/`
evidence captures) can be measured before/after rather than asserted.

Attribution rules:
  - calls: one per `tool_use` block.
  - out_tokens: the assistant message's `output_tokens`, split evenly across its tool_use blocks.
  - result_bytes: UTF-8 size of the matching `tool_result` text.
  - Duplicate assistant rows (same message id + tool_use ids) are counted once.

A measurement tool, not a gate: always exits 0 unless a path is missing (2).

Usage:
    python -I scripts/transcript_cost.py <file.jsonl | dir> [...]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable, Sequence

CATEGORIES: tuple[str, ...] = (
    "evidence-files",
    "state-docs",
    "artifacts-other",
    "code",
    "git",
    "tests",
    "subagent-dispatch",
    "other",
)

DISPATCH_TOOLS = frozenset({"Agent", "Task"})
FILE_TOOLS = frozenset({"Read", "Edit", "Write"})

# Substrings marking evidence capture/read-back (the `Temp/` + `Evidence/` convention).
EVIDENCE_MARKERS: tuple[str, ...] = ("Artifacts/Temp/", "Artifacts/Evidence")
ARTIFACTS_MARKER = "Artifacts"
STATE_DOC_RE = re.compile(
    r"Artifacts/(TODO|DECISION_LOG|BACKLOG|HANDOFF|LEARNINGS|HOT|learnings|History|history"
    r"|Reports|Plans|current_task|MEMORY)"
)
GIT_RE = re.compile(r"git (add|commit|merge|branch|checkout|push|-C)")
TESTS_RE = re.compile(r"pytest|dotnet test|ruff|mypy")
CODE_EXT_RE = re.compile(r"\.(py|cs|ts|json|toml|yaml|yml)$")

TRANSCRIPT_GLOB = "*.jsonl"
NO_ID = ""
STAT_KEYS: tuple[str, ...] = ("calls", "out_tokens", "result_bytes")


def categorize(name: str, inp: dict[str, Any]) -> str:
    """Map one tool call to a category in CATEGORIES. Pure; never mutates `inp`."""
    if name in DISPATCH_TOOLS:
        return "subagent-dispatch"
    path = inp.get("file_path") or inp.get("path") or ""
    cmd = inp.get("command") or ""
    # Normalise Windows separators so one pattern set covers both platforms.
    blob = f"{path} {cmd}".replace("\\", "/")
    if any(m in blob for m in EVIDENCE_MARKERS):
        return "evidence-files"
    if STATE_DOC_RE.search(blob):
        return "state-docs"
    if ARTIFACTS_MARKER in blob:
        return "artifacts-other"
    if GIT_RE.search(cmd):
        return "git"
    if TESTS_RE.search(cmd):
        return "tests"
    if name in FILE_TOOLS and CODE_EXT_RE.search(path):
        return "code"
    return "other"


def _result_bytes(content: Any) -> int:
    """UTF-8 size of a tool_result `content` (plain string or list of text blocks)."""
    if isinstance(content, str):
        return len(content.encode("utf-8"))
    if isinstance(content, list):
        return sum(
            len(x.get("text", "").encode("utf-8")) for x in content if isinstance(x, dict)
        )
    return 0


def _read_rows(path: Path) -> Iterable[dict[str, Any]]:
    with path.open(encoding="utf-8") as fh:
        for line in fh:
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue  # truncated/partial transcript lines are expected; skip
            if isinstance(row, dict):
                yield row


def analyze_paths(paths: Sequence[Path]) -> dict[str, dict[str, float]]:
    """Aggregate per-category stats over all transcripts. Returns a new dict."""
    totals = {c: dict.fromkeys(STAT_KEYS, 0.0) for c in CATEGORIES}
    seen: set[tuple[str, tuple[str, ...]]] = set()
    for path in paths:
        pending: dict[str, str] = {}
        for row in _read_rows(path):
            msg = row.get("message") or {}
            content = msg.get("content")
            if not isinstance(content, list):
                continue
            if row.get("type") == "assistant":
                uses = [c for c in content if isinstance(c, dict) and c.get("type") == "tool_use"]
                key = (msg.get("id") or NO_ID, tuple(c.get("id", NO_ID) for c in uses))
                if key in seen:
                    continue
                seen.add(key)
                share = (msg.get("usage") or {}).get("output_tokens", 0) / max(len(uses), 1)
                for use in uses:
                    cat = categorize(use.get("name", ""), use.get("input") or {})
                    totals[cat]["calls"] += 1
                    totals[cat]["out_tokens"] += share
                    pending[use.get("id", NO_ID)] = cat
            elif row.get("type") == "user":
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "tool_result":
                        cat = pending.get(block.get("tool_use_id", NO_ID))
                        if cat:
                            totals[cat]["result_bytes"] += _result_bytes(block.get("content"))
    return totals


def collect_paths(args: Sequence[Path]) -> list[Path]:
    """Expand files/dirs to transcript files. A dir yields every `*.jsonl` beneath it
    (main sessions plus `<session>/subagents/*.jsonl`)."""
    out: list[Path] = []
    for arg in args:
        if arg.is_dir():
            out.extend(sorted(arg.rglob(TRANSCRIPT_GLOB)))
        elif arg.is_file():
            out.append(arg)
        else:
            raise FileNotFoundError(f"transcript path not found: {arg}")
    return out


def format_table(stats: dict[str, dict[str, float]]) -> str:
    """Render stats as a fixed-width table with % of total calls."""
    total_calls = sum(v['calls'] for v in stats.values())
    denom = total_calls or 1
    lines = [
        f"total_calls={total_calls}",
        f"{'category':<20}{'calls':>8}{'%calls':>8}{'out_tokens':>12}{'result_bytes':>14}",
    ]
    for cat in CATEGORIES:
        v = stats[cat]
        lines.append(
            f"{cat:<20}{v['calls']:>8.0f}{100 * v['calls'] / denom:>8.1f}"
            f"{v['out_tokens']:>12.0f}{v['result_bytes']:>14.0f}"
        )
    return "\n".join(lines)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Per-category tool-call cost from transcripts.")
    parser.add_argument("paths", nargs="+", type=Path, help="transcript .jsonl file(s) or dir(s)")
    ns = parser.parse_args(argv)
    try:
        files = collect_paths(ns.paths)
    except FileNotFoundError as e:
        print(str(e), file=sys.stderr)
        return 2
    print(format_table(analyze_paths(files)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
