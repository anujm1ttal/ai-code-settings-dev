#!/usr/bin/env python3
"""
Model Routing Audit

Verifies that spawned subagents actually RAN on the model their agent
definition assigns — config can be perfectly wired while the runtime silently
ignores it (e.g. subagents inheriting the main-thread model).

Evidence source: Claude Code session transcripts under ~/.claude/projects/.
Each subagent run is a `<session>/subagents/agent-*.jsonl` transcript with a
sibling `agent-*.meta.json` recording its `agentType`. The transcript records
the real model ID per message; the agent's assigned model lives in the
`model:` frontmatter of `agents/<name>.md`.

Comparison is by tier/family (opus / sonnet / haiku), so dated snapshots like
`claude-haiku-4-5-20251001` correctly match an assigned `claude-haiku-4-5`.

Exit code: 0 if every managed subagent honored its assignment, 1 on any
mismatch (CI-usable).
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime
from pathlib import Path
import argparse
import io
import json
import re
import sys

Tier = str  # "opus" | "sonnet" | "haiku" | "other"
SYNTHETIC = "<synthetic>"


def model_family(model_id: str) -> Tier:
    """Collapse a concrete model ID to its tier family."""
    m = model_id.lower()
    if "opus" in m:
        return "opus"
    if "sonnet" in m:
        return "sonnet"
    if "haiku" in m:
        return "haiku"
    return "other"


def load_assigned_models(agents_dir: Path) -> dict[str, str]:
    """Map agent name -> assigned model ID, parsed from agents/*.md frontmatter."""
    assigned: dict[str, str] = {}
    for agent_file in sorted(agents_dir.glob("*.md")):
        if agent_file.name.endswith(".abstract.md") or agent_file.name == "agents.overview.md":
            continue
        try:
            content = agent_file.read_text(encoding="utf-8")
        except OSError:
            continue
        if not content.startswith("---"):
            continue
        frontmatter = content.split("---", 2)[1]
        name_match = re.search(r"^name:\s*(\S+)", frontmatter, re.MULTILINE)
        model_match = re.search(r"^model:\s*(claude-[\w.-]+)", frontmatter, re.MULTILINE)
        if name_match and model_match:
            assigned[name_match.group(1)] = model_match.group(1)
    return assigned


def dominant_model(transcript: Path) -> str | None:
    """Return the most common non-synthetic model ID in a subagent transcript."""
    counts: Counter[str] = Counter()
    try:
        with open(transcript, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                model = obj.get("message", {}).get("model") if isinstance(obj, dict) else None
                if model and model != SYNTHETIC:
                    counts[model] += 1
    except OSError:
        return None
    if not counts:
        return None
    return counts.most_common(1)[0][0]


def audit_subagent(meta_file: Path, assigned: dict[str, str]) -> dict[str, str] | None:
    """Build one audit row from a subagent .meta.json + its transcript."""
    try:
        meta = json.loads(meta_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    agent_type = meta.get("agentType", "?")
    transcript = meta_file.with_name(meta_file.name.replace(".meta.json", ".jsonl"))
    actual = dominant_model(transcript) if transcript.exists() else None

    expected = assigned.get(agent_type)
    if expected is None:
        status = "UNMANAGED"  # built-in agent (Explore, general-purpose, ...) — no assignment
    elif actual is None:
        status = "NO-DATA"
    elif model_family(actual) == model_family(expected):
        status = "OK"
    else:
        status = "MISMATCH"

    return {
        "session": meta_file.parent.parent.name[:8],
        "agent": agent_type,
        "expected": expected or "-",
        "actual": actual or "-",
        "status": status,
    }


def _transcript_mtime(meta_file: Path) -> float:
    """mtime of a subagent's transcript (falls back to the meta file)."""
    transcript = meta_file.with_name(meta_file.name.replace(".meta.json", ".jsonl"))
    probe = transcript if transcript.exists() else meta_file
    try:
        return probe.stat().st_mtime
    except OSError:
        return 0.0


def collect_rows(
    root: Path, assigned: dict[str, str], since_ts: float | None = None
) -> list[dict[str, str]]:
    """Audit every subagent transcript found under root (any depth).

    If since_ts is given, transcripts last modified before it are skipped —
    use it to exclude pre-config or deliberate alternate-model sessions that
    would otherwise register as false-positive mismatches.
    """
    rows = [
        row
        for meta_file in sorted(root.glob("**/subagents/*.meta.json"))
        if (since_ts is None or _transcript_mtime(meta_file) >= since_ts)
        and (row := audit_subagent(meta_file, assigned)) is not None
    ]
    return rows


def print_report(rows: list[dict[str, str]], violations_only: bool) -> None:
    """Print a markdown audit table plus a per-agent honored/violated summary."""
    icons = {"OK": "✅", "MISMATCH": "❌", "NO-DATA": "⚠️", "UNMANAGED": "·"}
    shown = [r for r in rows if not violations_only or r["status"] == "MISMATCH"]

    print("# Model Routing Audit\n")
    print("| Session | Agent | Assigned | Actual | Status |")
    print("|:---|:---|:---|:---|:---|")
    for r in shown:
        print(
            f"| `{r['session']}` | {r['agent']} | {r['expected']} | "
            f"{r['actual']} | {icons.get(r['status'], '?')} {r['status']} |"
        )

    print("\n## Summary (managed agents only)\n")
    print("| Agent | Honored | Violated | Honored % |")
    print("|:---|:---|:---|:---|")
    managed = [r for r in rows if r["status"] in ("OK", "MISMATCH")]
    for agent in sorted({r["agent"] for r in managed}):
        ok = sum(1 for r in managed if r["agent"] == agent and r["status"] == "OK")
        bad = sum(1 for r in managed if r["agent"] == agent and r["status"] == "MISMATCH")
        total = ok + bad
        pct = f"{100 * ok // total}%" if total else "-"
        print(f"| {agent} | {ok} | {bad} | {pct} |")

    total_ok = sum(1 for r in managed if r["status"] == "OK")
    total_bad = sum(1 for r in managed if r["status"] == "MISMATCH")
    no_data = sum(1 for r in rows if r["status"] == "NO-DATA")
    print(
        f"\n**{total_ok} honored, {total_bad} violated, {no_data} no-data "
        f"across {len(rows)} subagent runs.**"
    )
    if total_bad:
        print("\n> ❌ Routing is being bypassed for the runs above — assigned Tier does not match actual model.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit whether subagents ran on their assigned models.")
    parser.add_argument(
        "path",
        nargs="?",
        default=str(Path.home() / ".claude" / "projects"),
        help="Transcript root to scan (default: ~/.claude/projects). May be a projects root, "
        "a single project dir, or a session dir — subagents are found at any depth.",
    )
    parser.add_argument(
        "--agents-dir",
        default=str(Path(__file__).parent.parent / "agents"),
        help="Directory of agent *.md definitions (default: repo agents/). "
        "Point at ~/.claude/agents to audit against deployed config.",
    )
    parser.add_argument("--violations-only", action="store_true", help="Show only mismatched runs in the table.")
    parser.add_argument("--json", action="store_true", help="Emit raw rows as JSON instead of a report.")
    parser.add_argument(
        "--since",
        metavar="YYYY-MM-DD",
        default=None,
        help="Only audit transcripts modified on/after this date. Excludes pre-config "
        "or deliberate alternate-model sessions that would register as false positives.",
    )
    args = parser.parse_args()

    root = Path(args.path)
    agents_dir = Path(args.agents_dir)
    if not root.exists():
        print(f"Transcript root not found: {root}", file=sys.stderr)
        return 2
    if not agents_dir.exists():
        print(f"Agents dir not found: {agents_dir}", file=sys.stderr)
        return 2

    since_ts: float | None = None
    if args.since is not None:
        try:
            since_ts = datetime.fromisoformat(args.since).timestamp()
        except ValueError:
            print(f"Invalid --since date (expected YYYY-MM-DD): {args.since}", file=sys.stderr)
            return 2

    assigned = load_assigned_models(agents_dir)
    rows = collect_rows(root, assigned, since_ts)

    if args.json:
        print(json.dumps(rows, indent=2))
    else:
        if not rows:
            print("No subagent transcripts found under the given path.")
            return 0
        print_report(rows, args.violations_only)

    return 1 if any(r["status"] == "MISMATCH" for r in rows) else 0


if __name__ == "__main__":
    # Force UTF-8 output — only when run as a script; reassigning sys.stdout
    # at import time corrupts pytest's capture fixture for any test that
    # imports this module (matches scripts/model_router.py).
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="")
    sys.exit(main())
