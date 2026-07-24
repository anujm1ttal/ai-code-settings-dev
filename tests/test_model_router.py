"""Lookup matrix for scripts/model_router.py — regression-locks TL-H1/M9.

The manuscript-review case is the load-bearing regression test: that skill
only ships in `optional_plugins/manuscript/skills/manuscript-review/`, never
under `skills/`, so it only resolves if the plugin-root lookup (TL-H1) is in
place. Reverting that fix drops the skill's `model:` override, falling back
to the owning agent (scribe -> haiku) instead of sonnet.
"""

from pathlib import Path

import pytest

import model_router

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"


def test_agent_model_mandatory_binding():
    assert model_router.get_agent_model("coder") == ("sonnet", "claude-sonnet-5")
    assert model_router.get_agent_model("strategist") == ("opus", "claude-opus-5")
    assert model_router.get_agent_model("nonexistent-agent") is None


def test_manuscript_review_plugin_skill_resolves_to_sonnet():
    """The acceptance test from OSH-6-Plan.md verification section."""
    tier, model_id = model_router.get_skill_model("manuscript-review", "scribe", SKILLS_DIR)
    assert (tier, model_id) == ("sonnet", "claude-sonnet-5")


def test_find_skill_file_checks_plugin_root():
    found = model_router.find_skill_file("manuscript-review", SKILLS_DIR)
    assert found is not None
    assert found.match("optional_plugins/*/skills/manuscript-review/SKILL.md")


def test_find_skill_file_unknown_skill_returns_none():
    assert model_router.find_skill_file("does-not-exist-anywhere", SKILLS_DIR) is None


def test_skill_without_override_falls_back_to_owning_agent(tmp_path: Path):
    """A skill with no `model:` frontmatter inherits its owning agent's model."""
    skill_dir = tmp_path / "skills" / "no-override-skill"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(
        "---\nname: no-override-skill\ndescription: test fixture\n---\nBody.\n",
        encoding="utf-8",
    )
    tier, model_id = model_router.get_skill_model("no-override-skill", "coder", tmp_path / "skills")
    assert (tier, model_id) == ("sonnet", "claude-sonnet-5")


def test_malformed_frontmatter_does_not_crash(tmp_path: Path):
    """A SKILL.md with no closing `---` must not raise — falls back to agent."""
    skill_dir = tmp_path / "skills" / "broken-skill"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text("---\nname: broken-skill\nno closing fence", encoding="utf-8")
    tier, model_id = model_router.get_skill_model("broken-skill", "auditor", tmp_path / "skills")
    assert (tier, model_id) == ("sonnet", "claude-sonnet-5")


def test_estimate_cost_scales_with_tokens():
    assert model_router.estimate_cost(1_000_000, "claude-sonnet-5") == pytest.approx(3.0)
    assert model_router.estimate_cost(100_000, "claude-haiku-4-5") == pytest.approx(0.08)
