#!/usr/bin/env python3
"""
Gate Telemetry (LH-3 T1c)

Summarizes hooks/lib/gate-log.js's gate_events.jsonl into per-hook fire
counts split by decision (deny/nag), with each hook's last-fired timestamp.
This is the read side of LH-3's instrumentation (T1a/T1b write the events;
T1d surfaces this table at /handoff — a read-side with no reader is just
another write-only file).

Evidence source: Artifacts/.agent/gate_events.jsonl (one JSON object per
line: {ts, hook, event, decision, tool, ruleId}), written by
hooks/lib/gate-log.js's logGateEvent(). Malformed lines are skipped, not
fatal — the log is best-effort/fail-open by design (B4, LH-3-Plan.md).

Exit code: always 0 (a reporting tool, not a gate) unless --since is malformed.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import argparse
import io
import json
import sys


@dataclass(frozen=True)
class HookStats:
    hook: str
    deny_count: int
    nag_count: int
    last_fired: str | None


def parse_events(path: Path) -> list[dict[str, object]]:
    """Read gate_events.jsonl into a list of event dicts, skipping bad lines."""
    if not path.exists():
        return []
    events: list[dict[str, object]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(obj, dict):
            events.append(obj)
    return events


def _event_timestamp(event: dict[str, object]) -> float | None:
    """Epoch seconds for an event's `ts`, or None if missing/unparseable."""
    ts = event.get("ts")
    if not isinstance(ts, str):
        return None
    try:
        return datetime.fromisoformat(ts).timestamp()
    except ValueError:
        return None


def filter_since(events: list[dict[str, object]], since_ts: float) -> list[dict[str, object]]:
    """Keep only events whose `ts` is on/after since_ts. Unparseable ts is dropped."""
    return [e for e in events if (ts := _event_timestamp(e)) is not None and ts >= since_ts]


def aggregate(events: list[dict[str, object]]) -> list[HookStats]:
    """Roll events up into one HookStats per distinct `hook`, sorted by name."""
    deny_counts: dict[str, int] = {}
    nag_counts: dict[str, int] = {}
    last_fired: dict[str, str] = {}

    for event in events:
        hook = str(event.get("hook", "unknown"))
        decision = event.get("decision")
        ts = event.get("ts")

        if decision == "deny":
            deny_counts[hook] = deny_counts.get(hook, 0) + 1
        elif decision == "nag":
            nag_counts[hook] = nag_counts.get(hook, 0) + 1

        if isinstance(ts, str) and ts > last_fired.get(hook, ""):
            last_fired[hook] = ts

    all_hooks = sorted(set(deny_counts) | set(nag_counts) | set(last_fired))
    return [
        HookStats(
            hook=hook,
            deny_count=deny_counts.get(hook, 0),
            nag_count=nag_counts.get(hook, 0),
            last_fired=last_fired.get(hook),
        )
        for hook in all_hooks
    ]


def print_table(stats: list[HookStats]) -> None:
    print("# Gate Telemetry\n")
    print("| Hook | Deny | Nag | Last Fired |")
    print("|:---|---:|---:|:---|")
    for s in stats:
        print(f"| {s.hook} | {s.deny_count} | {s.nag_count} | {s.last_fired or '-'} |")

    total_deny = sum(s.deny_count for s in stats)
    total_nag = sum(s.nag_count for s in stats)
    print(f"\n**{total_deny} deny, {total_nag} nag across {len(stats)} hook(s).**")


def main() -> int:
    parser = argparse.ArgumentParser(description="Summarize gate_events.jsonl deny/nag fire counts per hook.")
    parser.add_argument(
        "events_file",
        nargs="?",
        default=str(Path(__file__).resolve().parent.parent / "Artifacts" / ".agent" / "gate_events.jsonl"),
        help="Path to gate_events.jsonl (default: repo Artifacts/.agent/gate_events.jsonl)",
    )
    parser.add_argument(
        "--since",
        metavar="YYYY-MM-DD",
        default=None,
        help="Only count events on/after this date.",
    )
    parser.add_argument("--json", action="store_true", help="Emit raw per-hook stats as JSON instead of a table.")
    args = parser.parse_args()

    events = parse_events(Path(args.events_file))

    if args.since is not None:
        try:
            since_ts = datetime.fromisoformat(args.since).timestamp()
        except ValueError:
            print(f"Invalid --since date (expected YYYY-MM-DD): {args.since}", file=sys.stderr)
            return 2
        events = filter_since(events, since_ts)

    stats = aggregate(events)

    if args.json:
        print(json.dumps([s.__dict__ for s in stats], indent=2))
    elif not stats:
        print("No gate events found.")
    else:
        print_table(stats)

    return 0


if __name__ == "__main__":
    # Force UTF-8 output — only when run as a script; reassigning sys.stdout
    # at import time corrupts pytest's capture fixture for any test that
    # imports this module (matches scripts/model_router.py / model_routing_audit.py).
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="")
    sys.exit(main())
