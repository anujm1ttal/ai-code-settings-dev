#!/usr/bin/env python3
"""
Model Router

Routes agents and skills to the appropriate Claude model based on task type and reasoning complexity.
Supports model overrides at the skill level for specialized tasks.
"""

from pathlib import Path
from typing import Literal
import re
import io
import sys

ModelTier = Literal["opus", "sonnet", "haiku"]
ModelID = Literal["claude-opus-5", "claude-sonnet-5", "claude-haiku-4-5"]

# Agent-to-model binding (mandatory)
AGENT_MODELS: dict[str, tuple[ModelTier, ModelID]] = {
    "strategist": ("opus", "claude-opus-5"),
    "coder": ("sonnet", "claude-sonnet-5"),
    "auditor": ("sonnet", "claude-sonnet-5"),
    "scribe": ("haiku", "claude-haiku-4-5"),
    "concierge": ("haiku", "claude-haiku-4-5"),
    "council": ("opus", "claude-opus-5"),
    "creative-director": ("haiku", "claude-haiku-4-5"),
    "geometry-validator": ("sonnet", "claude-sonnet-5"),
}

# Model pricing (per 1M tokens, input/output averaged)
MODEL_PRICING: dict[ModelID, float] = {
    "claude-opus-5": 15.0,
    "claude-sonnet-5": 3.0,
    "claude-haiku-4-5": 0.8,
}

# Reasoning effort mapping to model tier
REASONING_TO_MODEL: dict[str, tuple[ModelTier, str]] = {
    "low": ("haiku", "Routine tasks, docs, state management"),
    "medium": ("sonnet", "Implementation, testing, schemas"),
    "high": ("sonnet", "Code review, complex logic, bug fixing"),
    "xhigh": ("opus", "Strategic decisions, architecture, deliberation"),
    "deep": ("opus", "Deep reasoning, multi-phase planning, conflict resolution"),
}


def find_skill_file(skill_name: str, skills_dir: Path) -> Path | None:
    """Locate a skill's SKILL.md.

    Checks the primary skills dir first, then falls back to native plugin
    skills under `optional_plugins/*/skills/<name>/SKILL.md` (plugins are not
    mirrored into `skills/`, so lookups must span both roots).
    """
    primary = skills_dir / skill_name / "SKILL.md"
    if primary.exists():
        return primary

    plugins_root = skills_dir.parent / "optional_plugins"
    if plugins_root.is_dir():
        for match in plugins_root.glob(f"*/skills/{skill_name}/SKILL.md"):
            return match

    return None


def _tier_for_model(model_id: ModelID) -> ModelTier:
    """Infer the routing tier from a model id."""
    if "opus" in model_id:
        return "opus"
    if "sonnet" in model_id:
        return "sonnet"
    return "haiku"


def load_skill_model_override(skill_name: str, skills_dir: Path) -> ModelID | None:
    """Load model override from skill SKILL.md frontmatter if it exists."""
    skill_file = find_skill_file(skill_name, skills_dir)
    if skill_file is None:
        return None

    try:
        content = skill_file.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None

    if not content.startswith("---"):
        return None

    parts = content.split("---", 2)
    if len(parts) < 3:
        return None

    match = re.search(r"model:\s+(claude-[\w-]+)", parts[1])
    if match:
        model_id = match.group(1)
        if model_id in MODEL_PRICING:
            return model_id

    return None


def get_agent_model(agent_name: str) -> tuple[ModelTier, ModelID] | None:
    """Get the mandatory model for an agent."""
    return AGENT_MODELS.get(agent_name)


def get_skill_model(
    skill_name: str, agent_name: str, skills_dir: Path
) -> tuple[ModelTier, ModelID]:
    """Get the model for a skill, considering overrides and owning agent."""
    # Check for skill-level override
    override = load_skill_model_override(skill_name, skills_dir)
    if override:
        return (_tier_for_model(override), override)

    # Fall back to owning agent
    agent_model = get_agent_model(agent_name)
    if agent_model:
        return agent_model

    # Default to haiku if unknown
    return ("haiku", "claude-haiku-4-5")


def get_model_for_task(
    task_type: str, agent_name: str | None = None, skill_name: str | None = None, skills_dir: Path | None = None
) -> tuple[ModelTier, ModelID, str]:
    """
    Route a task to the appropriate model.

    Args:
        task_type: "thinking", "implementation", "review", "documentation", "routine"
        agent_name: Optional agent name (overrides task_type reasoning)
        skill_name: Optional skill name (may have override)
        skills_dir: Path to skills directory (for override lookup)

    Returns:
        (tier, model_id, reasoning)
    """
    # Priority 1: Agent explicit assignment
    if agent_name:
        model = get_agent_model(agent_name)
        if model:
            return (model[0], model[1], f"Agent binding: {agent_name}")

    # Priority 2: Skill override
    if skill_name and skills_dir:
        tier, model_id = get_skill_model(skill_name, agent_name or "coder", skills_dir)
        return (tier, model_id, f"Skill override: {skill_name}")

    # Priority 3: Task type reasoning
    reasoning = REASONING_TO_MODEL.get(task_type, ("sonnet", "Medium complexity"))
    tier = reasoning[0]
    model_id: ModelID = {
        "opus": "claude-opus-5",
        "sonnet": "claude-sonnet-5",
        "haiku": "claude-haiku-4-5",
    }[tier]  # type: ignore

    return (tier, model_id, f"Task type: {task_type}")


def estimate_cost(tokens: int, model_id: ModelID) -> float:
    """Estimate cost in dollars for a given model and token count."""
    price_per_1m = MODEL_PRICING.get(model_id, 0.8)
    return (tokens / 1_000_000) * price_per_1m


def print_routing_table():
    """Print the agent-to-model routing table."""
    print("# Agent-to-Model Routing Table\n")
    print("| Agent | Model | Tier | Price/1M Tokens |")
    print("|:---|:---|:---|:---|")

    for agent, (tier, model_id) in AGENT_MODELS.items():
        price = MODEL_PRICING[model_id]
        print(f"| `{agent}` | `{model_id}` | {tier} | ${price:.2f} |")

    print("\n# Reasoning-to-Model Mapping\n")
    print("| Reasoning | Tier | Model | Use Case |")
    print("|:---|:---|:---|:---|")

    seen = set()
    for reasoning, (tier, use_case) in REASONING_TO_MODEL.items():
        model_id = {
            "opus": "claude-opus-5",
            "sonnet": "claude-sonnet-5",
            "haiku": "claude-haiku-4-5",
        }[tier]
        key = (reasoning, tier)
        if key not in seen:
            print(f"| `{reasoning}` | {tier} | `{model_id}` | {use_case} |")
            seen.add(key)


def main():
    import json

    if len(sys.argv) < 2:
        print("Usage: python model_router.py [--table | --lookup <agent|skill> <name> [skills_dir]]")
        sys.exit(1)

    if sys.argv[1] == "--table":
        print_routing_table()
    elif sys.argv[1] == "--lookup":
        if len(sys.argv) < 4:
            print("Usage: python model_router.py --lookup <agent|skill> <name> [skills_dir]")
            sys.exit(1)

        lookup_type = sys.argv[2]
        name = sys.argv[3]
        skills_dir = Path(sys.argv[4]) if len(sys.argv) > 4 else Path(__file__).parent.parent / "skills"

        if lookup_type == "agent":
            model = get_agent_model(name)
            if model:
                tier, model_id = model
                cost = estimate_cost(100_000, model_id)
                result = {
                    "agent": name,
                    "tier": tier,
                    "model": model_id,
                    "cost_per_100k_tokens": f"${cost:.2f}",
                }
                print(json.dumps(result, indent=2))
            else:
                print(f"Unknown agent: {name}")
                sys.exit(1)

        elif lookup_type == "skill":
            agent = sys.argv[4] if len(sys.argv) > 4 else "coder"
            skills_dir_path = Path(sys.argv[5]) if len(sys.argv) > 5 else Path(__file__).parent.parent / "skills"
            tier, model_id = get_skill_model(name, agent, skills_dir_path)
            cost = estimate_cost(100_000, model_id)
            result = {
                "skill": name,
                "owned_by": agent,
                "tier": tier,
                "model": model_id,
                "cost_per_100k_tokens": f"${cost:.2f}",
            }
            print(json.dumps(result, indent=2))


if __name__ == "__main__":
    # Force UTF-8 output — only when run as a script; reassigning sys.stdout
    # at import time corrupts pytest's capture fixture for any test that
    # imports this module (surfaced while writing tests/test_model_router.py).
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="")
    main()
