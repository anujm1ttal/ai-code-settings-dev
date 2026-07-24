"""Frontmatter/transcript parsing for scripts/model_routing_audit.py — TL-M1.

Uses synthetic fixture files (tmp_path) rather than the real agents/ dir so
the test is independent of future agent roster changes.
"""

import json
from pathlib import Path

import model_routing_audit as mra


def _write_agent(agents_dir: Path, filename: str, name: str, model: str) -> None:
    agents_dir.mkdir(parents=True, exist_ok=True)
    (agents_dir / filename).write_text(
        f"---\nname: {name}\nmodel: {model}\n---\nBody.\n", encoding="utf-8"
    )


def test_load_assigned_models_parses_frontmatter(tmp_path: Path):
    agents_dir = tmp_path / "agents"
    _write_agent(agents_dir, "coder.md", "coder", "claude-sonnet-5")
    _write_agent(agents_dir, "strategist.md", "strategist", "claude-opus-5")

    assigned = mra.load_assigned_models(agents_dir)

    assert assigned == {"coder": "claude-sonnet-5", "strategist": "claude-opus-5"}


def test_load_assigned_models_skips_overview_and_abstract_files(tmp_path: Path):
    agents_dir = tmp_path / "agents"
    _write_agent(agents_dir, "coder.md", "coder", "claude-sonnet-5")
    _write_agent(agents_dir, "agents.overview.md", "overview", "claude-opus-5")
    _write_agent(agents_dir, "coder.abstract.md", "coder-abstract", "claude-opus-5")

    assigned = mra.load_assigned_models(agents_dir)

    assert assigned == {"coder": "claude-sonnet-5"}


def test_model_family_collapses_dated_snapshots():
    assert mra.model_family("claude-haiku-4-5-20251001") == "haiku"
    assert mra.model_family("claude-sonnet-5") == "sonnet"
    assert mra.model_family("claude-opus-5") == "opus"
    assert mra.model_family("gpt-4o") == "other"


def test_dominant_model_reads_transcript_and_ignores_synthetic(tmp_path: Path):
    # Fixture is 1 real : 3 synthetic — if the `!= SYNTHETIC` filter is ever
    # removed, synthetic wins the vote (3 > 1) and this assertion fails.
    # A tied/near-tied fixture would mask that regression, so don't rebalance
    # this back toward parity.
    transcript = tmp_path / "agent-1.jsonl"
    lines = [
        {"message": {"model": "claude-sonnet-5"}},
        {"message": {"model": "<synthetic>"}},
        {"message": {"model": "<synthetic>"}},
        {"message": {"model": "<synthetic>"}},
        {"not_a_message": True},
        "not even json",
    ]
    transcript.write_text(
        "\n".join(json.dumps(x) if not isinstance(x, str) else x for x in lines),
        encoding="utf-8",
    )
    assert mra.dominant_model(transcript) == "claude-sonnet-5"


def test_audit_subagent_flags_mismatch(tmp_path: Path):
    session_dir = tmp_path / "session-abcdef01" / "subagents"
    session_dir.mkdir(parents=True)
    meta = session_dir / "agent-1.meta.json"
    meta.write_text(json.dumps({"agentType": "coder"}), encoding="utf-8")
    transcript = session_dir / "agent-1.jsonl"
    transcript.write_text(json.dumps({"message": {"model": "claude-haiku-4-5"}}), encoding="utf-8")

    row = mra.audit_subagent(meta, {"coder": "claude-sonnet-5"})

    assert row is not None
    assert row["status"] == "MISMATCH"
    assert row["expected"] == "claude-sonnet-5"
    assert row["actual"] == "claude-haiku-4-5"
