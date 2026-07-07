"""Cross-reference integrity: CLAUDE-global.md command table <-> commands/*.md — TL-M1.

Locks the "phantom command" / "undocumented command" class of drift: every
`/slash-command` row must have a matching file, and every command file must
be documented, so the routing table in CLAUDE-global.md can never silently
diverge from the commands/ directory it claims to describe.
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CLAUDE_GLOBAL = REPO_ROOT / "CLAUDE-global.md"
COMMANDS_DIR = REPO_ROOT / "commands"

# Matches table rows like `| `/blueprint` | strategist | ... |` — the leading
# `/` distinguishes slash-commands from bare skill-name rows in the same table.
SLASH_COMMAND_ROW = re.compile(r"^\|\s*`/([\w-]+)`\s*\|", re.MULTILINE)


def _documented_commands() -> set[str]:
    content = CLAUDE_GLOBAL.read_text(encoding="utf-8")
    return set(SLASH_COMMAND_ROW.findall(content))


def _command_files() -> set[str]:
    return {f.stem for f in COMMANDS_DIR.glob("*.md")}


def test_every_documented_command_has_a_file():
    documented = _documented_commands()
    files = _command_files()
    missing = documented - files
    assert not missing, f"Commands documented in CLAUDE-global.md with no commands/*.md file: {missing}"


def test_every_command_file_is_documented():
    documented = _documented_commands()
    files = _command_files()
    orphans = files - documented
    assert not orphans, f"commands/*.md files with no row in CLAUDE-global.md: {orphans}"


def test_registry_is_non_empty():
    """Guards against a regex/path drift silently degrading both sets to empty
    (which would make the two tests above vacuously pass)."""
    assert len(_documented_commands()) >= 15
    assert len(_command_files()) >= 15
