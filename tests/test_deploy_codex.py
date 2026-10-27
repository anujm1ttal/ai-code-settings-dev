"""Codex deployment copies shared guidance without replacing personal config."""

import subprocess
import tomllib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "deploy-codex.ps1"


def test_codex_deploy_preserves_config_and_installs_guidance(tmp_path: Path) -> None:
    codex_home = tmp_path / "codex"
    skills_home = tmp_path / "skills"
    codex_home.mkdir()
    (codex_home / "config.toml").write_text('model = "personal"\n', encoding="utf-8")
    (codex_home / "hooks.json").write_text('{"hooks":{}}\n', encoding="utf-8")
    (codex_home / "AGENTS.md").write_text("previous instructions\n", encoding="utf-8")
    old_skill = skills_home / "codebase-navigator" / "SKILL.md"
    old_skill.parent.mkdir(parents=True)
    old_skill.write_text("previous skill\n", encoding="utf-8")
    old_prompt = codex_home / "prompts" / "audit.md"
    old_prompt.parent.mkdir(parents=True)
    old_prompt.write_text("personal audit prompt\n", encoding="utf-8")

    result = subprocess.run(
        [
            "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", str(SCRIPT), "-DestinationRoot", str(codex_home),
            "-SkillsRoot", str(skills_home),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert (codex_home / "AGENTS.md").read_text(encoding="utf-8") == (
        ROOT / "Codex-global.md"
    ).read_text(encoding="utf-8")
    assert (codex_home / "rules" / "common" / "orchestration.md").is_file()
    assert (codex_home / "reference" / "commands" / "blueprint.md").is_file()
    assert (codex_home / "reference" / "agents" / "agents.overview.md").is_file()
    expected_roles = {
        "strategist", "coder", "auditor", "scribe", "concierge",
        "council", "creative-director", "geometry-validator",
    }
    assert {path.stem for path in (codex_home / "agents").glob("*.toml")} == expected_roles
    for role in expected_roles:
        data = tomllib.loads((codex_home / "agents" / f"{role}.toml").read_text(encoding="utf-8"))
        assert data["name"] == role
        assert data["model"] == "gpt-6-sol"
        assert data["model_reasoning_effort"] in {"low", "medium", "high", "xhigh"}
        assert "claude-" not in data["developer_instructions"].lower()
    assert (codex_home / "hooks" / "guard-paths.js").read_bytes() == (
        ROOT / "hooks" / "guard-paths.js"
    ).read_bytes()
    assert (skills_home / "codebase-navigator" / "SKILL.md").is_file()
    command_skills = list(skills_home.glob("source-command-*/SKILL.md"))
    assert len(command_skills) == len(list((ROOT / "commands").glob("*.md")))
    audit_skill = (skills_home / "source-command-audit" / "SKILL.md").read_text(
        encoding="utf-8"
    )
    assert "name: source-command-audit" in audit_skill
    assert "# Command: /audit" in audit_skill
    assert "model: claude-" not in audit_skill
    assert "Codex agent TOML" in audit_skill
    prompts = {path.stem: path for path in (codex_home / "prompts").glob("*.md")}
    assert set(prompts) == {"audit"}
    assert prompts["audit"].read_text(encoding="utf-8") == "personal audit prompt\n"
    assert (codex_home / "config.toml").read_text(encoding="utf-8") == 'model = "personal"\n'
    assert (codex_home / "hooks.json").read_text(encoding="utf-8") == '{"hooks":{}}\n'
    backups = list((codex_home / "backups" / "ai-code-settings").iterdir())
    assert len(backups) == 1
    assert (backups[0] / "codex" / "AGENTS.md").read_text(encoding="utf-8") == "previous instructions\n"
    assert not (backups[0] / "codex" / "prompts" / "audit.md").exists()
    assert (backups[0] / "skills" / "codebase-navigator" / "SKILL.md").read_text(encoding="utf-8") == "previous skill\n"

    repeated = subprocess.run(
        [
            "powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
            "-File", str(SCRIPT), "-DestinationRoot", str(codex_home),
            "-SkillsRoot", str(skills_home),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert repeated.returncode == 0, repeated.stdout + repeated.stderr
    assert (codex_home / "config.toml").read_text(encoding="utf-8") == 'model = "personal"\n'
