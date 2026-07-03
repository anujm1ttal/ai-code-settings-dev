#!/usr/bin/env python3
"""
Migration script: Move singleton skills from skills/ to optional_plugins/

Supports three modes:
  --dry-run   Show what would be done without making changes (exit 0)
  --apply     Execute the migration with validation (exit 0 on success, 1 on error)
  --rollback  Undo a previous --apply using git (exit 0 on success, 1 on error)

Idempotent: Running --apply twice is safe (second run detects already-migrated state).
Reversible: --rollback restores skills from git history.
"""

import json
import shutil
import subprocess
import sys
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional

from loguru import logger


# 13 singleton skills to migrate
SINGLETON_SKILLS = [
    "cd-foundations",
    "youtube-strategy",
    "youtube-scriptwriting",
    "youtube-retention",
    "pptx",
    "powerbi-report",
    "python-mcp",
    "typescript-mcp",
    "python-rhino-grasshopper",
    "rhino-e2e-testing",
    "rhino-unit-testing",
    "manuscript-review",
    "business-analyst",
]

MIGRATION_STATE_FILE = Path(__file__).parent.parent / "Artifacts" / ".agent" / "migration_state.json"


@dataclass
class MigrationState:
    """Tracks migration execution state for idempotency and rollback."""
    timestamp: str
    mode: str
    skills_removed: list[str]

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> "MigrationState":
        return cls(**data)


def setup_logging():
    """Configure loguru for structured logging."""
    logger.remove()
    logger.add(
        sys.stderr,
        format="[{level}] {message}",
        level="INFO",
    )


def resolve_paths() -> tuple[Path, Path, Path]:
    """Resolve project root, skills, and plugins directories."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    skills_dir = project_root / "skills"
    plugins_dir = project_root / "optional_plugins"
    return project_root, skills_dir, plugins_dir


def verify_plugin_skill_exists(skill_id: str, plugins_dir: Path) -> bool:
    """
    Verify that a skill exists in optional_plugins/[category]/[skill]/SKILL.md.

    Returns True if found, False otherwise.
    """
    for category_dir in plugins_dir.iterdir():
        if not category_dir.is_dir():
            continue
        skill_dir = category_dir / skill_id
        skill_file = skill_dir / "SKILL.md"
        if skill_file.exists():
            return True
    return False


def find_skill_in_plugins(skill_id: str, plugins_dir: Path) -> Optional[Path]:
    """
    Find a skill directory in optional_plugins.

    Returns Path to skill directory if found, None otherwise.
    """
    for category_dir in plugins_dir.iterdir():
        if not category_dir.is_dir():
            continue
        skill_dir = category_dir / skill_id
        if skill_dir.exists():
            return skill_dir
    return None


def update_skills_overview(skills_dir: Path, removed_skills: list[str]) -> bool:
    """
    Remove singleton skill references from skills/skills.overview.md.

    Returns True on success, False on error.
    """
    overview_path = skills_dir / "skills.overview.md"
    if not overview_path.exists():
        logger.warning(f"skills.overview.md not found at {overview_path}")
        return False

    try:
        content = overview_path.read_text()

        for skill in removed_skills:
            # Match table rows like: `| python-mcp | ... |`
            # This is a simple pattern-based removal
            lines = content.split("\n")
            new_lines = []
            for line in lines:
                # Skip lines that contain the skill name in a table row
                if f"| `{skill}`" in line or f"| {skill} " in line:
                    logger.info(f"Removing skill reference: {skill}")
                    continue
                new_lines.append(line)

            content = "\n".join(new_lines)

        overview_path.write_text(content)
        logger.info(f"Updated skills/skills.overview.md")
        return True
    except Exception as e:
        logger.error(f"Failed to update skills.overview.md: {e}")
        return False


def dry_run(skills_dir: Path, plugins_dir: Path) -> int:
    """
    Show what would be migrated without making changes.

    Returns 0.
    """
    logger.info("=== DRY RUN: Migration Preview ===")
    logger.info(f"Project root: {skills_dir.parent}")
    logger.info(f"Skills directory: {skills_dir}")
    logger.info(f"Plugins directory: {plugins_dir}")
    logger.info("")

    to_remove = []
    already_migrated = []
    missing_from_plugins = []

    for skill_id in SINGLETON_SKILLS:
        skill_path = skills_dir / skill_id
        plugin_exists = verify_plugin_skill_exists(skill_id, plugins_dir)

        if not skill_path.exists():
            already_migrated.append(skill_id)
        elif plugin_exists:
            to_remove.append(skill_id)
        else:
            missing_from_plugins.append(skill_id)

    if to_remove:
        logger.info(f"[WOULD REMOVE] ({len(to_remove)} skills):")
        for skill in sorted(to_remove):
            logger.info(f"  - {skill}")
        logger.info("")

    if already_migrated:
        logger.info(f"[ALREADY MIGRATED] ({len(already_migrated)} skills):")
        for skill in sorted(already_migrated):
            logger.info(f"  - {skill}")
        logger.info("")

    if missing_from_plugins:
        logger.warning(f"[MISSING FROM PLUGINS] ({len(missing_from_plugins)} skills):")
        for skill in sorted(missing_from_plugins):
            logger.warning(f"  - {skill} (skipped: not found in optional_plugins)")
        logger.info("")

    logger.info(f"Summary: {len(to_remove)} to remove, {len(already_migrated)} already migrated")

    return 0


def apply_migration(project_root: Path, skills_dir: Path, plugins_dir: Path) -> int:
    """
    Execute the migration: remove skills/ directories and update docs.

    Returns 0 on success, 1 on error.
    """
    logger.info("=== APPLY: Executing Migration ===")

    # Check if already migrated
    if MIGRATION_STATE_FILE.exists():
        try:
            state_data = json.loads(MIGRATION_STATE_FILE.read_text())
            state = MigrationState.from_dict(state_data)
            logger.warning(f"Migration already applied at {state.timestamp}")
            logger.warning(f"Previously removed: {', '.join(state.skills_removed)}")
            logger.warning("Run with --rollback to undo, or use --dry-run to preview further changes")
            return 0
        except Exception as e:
            logger.error(f"Failed to read migration state: {e}")
            return 1

    to_remove = []
    skipped = []

    # Validation phase: verify all skills exist in plugins before removing anything
    logger.info("Validating skill locations...")
    for skill_id in SINGLETON_SKILLS:
        skill_path = skills_dir / skill_id
        plugin_exists = verify_plugin_skill_exists(skill_id, plugins_dir)

        if not skill_path.exists():
            logger.info(f"Skipping {skill_id} (already removed from skills/)")
            continue

        if not plugin_exists:
            logger.warning(f"Skipping {skill_id} (not found in optional_plugins - may need to copy first)")
            skipped.append(skill_id)
            continue

        to_remove.append(skill_id)

    if not to_remove:
        logger.warning("No skills to remove (all already migrated or missing from plugins)")
        return 0

    logger.info(f"Ready to remove {len(to_remove)} skills")
    logger.info("")

    # Removal phase
    for skill_id in to_remove:
        skill_path = skills_dir / skill_id
        try:
            shutil.rmtree(skill_path)
            logger.info(f"Removed: {skill_path}")
        except Exception as e:
            logger.error(f"Failed to remove {skill_id}: {e}")
            return 1

    # Update documentation
    logger.info("Updating documentation...")
    if not update_skills_overview(skills_dir, to_remove):
        logger.error("Failed to update skills.overview.md")
        return 1

    # Record migration state
    MIGRATION_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    state = MigrationState(
        timestamp=datetime.now().isoformat(),
        mode="--apply",
        skills_removed=sorted(to_remove),
    )
    try:
        MIGRATION_STATE_FILE.write_text(json.dumps(state.to_dict(), indent=2))
        logger.info(f"Saved migration state to {MIGRATION_STATE_FILE}")
    except Exception as e:
        logger.error(f"Failed to save migration state: {e}")
        return 1

    logger.info("")
    logger.info(f"✓ Migration successful: {len(to_remove)} skills removed")
    if skipped:
        logger.info(f"⚠ {len(skipped)} skills skipped (not in optional_plugins)")

    return 0


def rollback_migration(project_root: Path, skills_dir: Path, plugins_dir: Path) -> int:
    """
    Undo a previous --apply: restore skills from git.

    Returns 0 on success, 1 on error.
    """
    logger.info("=== ROLLBACK: Restoring Skills ===")

    # Check if a migration state exists
    if not MIGRATION_STATE_FILE.exists():
        logger.warning("No migration state found (nothing to rollback)")
        return 0

    try:
        state_data = json.loads(MIGRATION_STATE_FILE.read_text())
        state = MigrationState.from_dict(state_data)
    except Exception as e:
        logger.error(f"Failed to read migration state: {e}")
        return 1

    logger.info(f"Previous migration: {state.timestamp}")
    logger.info(f"Skills to restore: {', '.join(state.skills_removed)}")
    logger.info("")

    # Use git to restore each skill
    logger.info("Restoring skills from git...")
    for skill_id in state.skills_removed:
        skill_path = skills_dir / skill_id
        try:
            # Use git checkout to restore the skill directory
            result = subprocess.run(
                ["git", "checkout", "HEAD~1", "--", f"skills/{skill_id}/"],
                cwd=project_root,
                capture_output=True,
                text=True,
                timeout=30,
            )
            if result.returncode != 0:
                logger.warning(f"Git restore failed for {skill_id}: {result.stderr}")
                # Try alternative: check if it exists in current HEAD
                result2 = subprocess.run(
                    ["git", "checkout", "HEAD", "--", f"skills/{skill_id}/"],
                    cwd=project_root,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if result2.returncode != 0:
                    logger.error(f"Could not restore {skill_id} from git")
                    return 1
            logger.info(f"Restored: {skill_id}")
        except subprocess.TimeoutExpired:
            logger.error(f"Git timeout while restoring {skill_id}")
            return 1
        except Exception as e:
            logger.error(f"Failed to restore {skill_id}: {e}")
            return 1

    # Restore skills.overview.md
    logger.info("Restoring skills/skills.overview.md...")
    try:
        result = subprocess.run(
            ["git", "checkout", "HEAD", "--", "skills/skills.overview.md"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            logger.warning(f"Could not restore skills.overview.md: {result.stderr}")
    except Exception as e:
        logger.error(f"Failed to restore skills.overview.md: {e}")
        return 1

    # Clear migration state
    try:
        MIGRATION_STATE_FILE.unlink()
        logger.info(f"Cleared migration state")
    except Exception as e:
        logger.error(f"Failed to clear migration state: {e}")
        return 1

    logger.info("")
    logger.info(f"✓ Rollback successful: {len(state.skills_removed)} skills restored")

    return 0


def main():
    """Main entry point."""
    setup_logging()

    if len(sys.argv) < 2:
        logger.error("Usage: python migrate_skills_to_plugins.py [--dry-run|--apply|--rollback]")
        return 1

    mode = sys.argv[1]
    project_root, skills_dir, plugins_dir = resolve_paths()

    if mode == "--dry-run":
        return dry_run(skills_dir, plugins_dir)
    elif mode == "--apply":
        return apply_migration(project_root, skills_dir, plugins_dir)
    elif mode == "--rollback":
        return rollback_migration(project_root, skills_dir, plugins_dir)
    else:
        logger.error(f"Unknown mode: {mode}")
        logger.error("Valid modes: --dry-run, --apply, --rollback")
        return 1


if __name__ == "__main__":
    sys.exit(main())
