#!/usr/bin/env python3
"""
Phase 11.2: Copy singleton skills to optional_plugins and generate metadata.

This script:
1. Copies all 12 singleton skills from skills/ to optional_plugins/[category]/[skill]/
2. Generates METADATA.yaml for each skill with extracted frontmatter
3. Updates plugin.yaml files with skill details

Idempotent: Safe to run multiple times.
"""

import json
import shutil
import sys
from pathlib import Path
from typing import Any
import yaml

# Singleton skill mapping: skill_name -> (category, load_policy)
SINGLETON_SKILLS = {
    # YouTube (3)
    "youtube-strategy": ("youtube", "auto"),
    "youtube-scriptwriting": ("youtube", "auto"),
    "youtube-retention": ("youtube", "auto"),
    # PPTX (1)
    "pptx": ("pptx", "auto"),
    # Power BI (1)
    "powerbi-report": ("pbi-report", "auto"),
    # Code MCP (2)
    "typescript-mcp": ("code-mcp", "auto"),
    "python-mcp": ("code-mcp", "auto"),
    # Geometry (4)
    "cd-foundations": ("geometry", "auto"),
    "python-rhino-grasshopper": ("geometry", "auto"),
    "rhino-e2e-testing": ("geometry", "auto"),
    "rhino-unit-testing": ("geometry", "auto"),
    # Manuscript (1)
    "manuscript-review": ("manuscript", "auto"),
}

def extract_skill_frontmatter(skill_path: Path) -> dict[str, Any]:
    """Extract YAML frontmatter from SKILL.md."""
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return {}

    content = skill_md.read_text(encoding='utf-8')
    if not content.startswith("---"):
        return {}

    # Find the closing ---
    end_idx = content.find("---", 3)
    if end_idx == -1:
        return {}

    frontmatter_str = content[3:end_idx].strip()
    try:
        return yaml.safe_load(frontmatter_str) or {}
    except Exception as e:
        print(f"Warning: Failed to parse frontmatter for {skill_path.name}: {e}")
        return {}

def generate_metadata_yaml(skill_name: str, frontmatter: dict[str, Any]) -> dict[str, Any]:
    """Generate METADATA.yaml content from skill frontmatter."""
    version = frontmatter.get("metadata", {}).get("version", "1.0.0")

    return {
        "skill_id": skill_name,
        "name": frontmatter.get("name", skill_name),
        "description": frontmatter.get("description", ""),
        "version": version,
        "tags": frontmatter.get("tags", []),
        "auto_activate": frontmatter.get("auto_activate", False),
        "compatibility": {
            "min_os_version": "2.5.0",
            "max_os_version": None,
        },
    }

def copy_skill(src: Path, dst: Path) -> bool:
    """Copy skill directory to destination. Return True if successful."""
    if dst.exists():
        print(f"  Skipping {dst.name} (already exists)")
        return True

    try:
        shutil.copytree(src, dst)
        print(f"  [OK] Copied {src.name}")
        return True
    except Exception as e:
        print(f"  [FAIL] Failed to copy {src.name}: {e}")
        return False

def create_metadata_yaml(skill_path: Path, skill_name: str, frontmatter: dict[str, Any]) -> bool:
    """Create METADATA.yaml in the skill directory."""
    metadata = generate_metadata_yaml(skill_name, frontmatter)
    metadata_path = skill_path / "METADATA.yaml"

    try:
        with open(metadata_path, "w") as f:
            yaml.dump(metadata, f, default_flow_style=False, sort_keys=False)
        print(f"  [OK] Created METADATA.yaml for {skill_name}")
        return True
    except Exception as e:
        print(f"  [FAIL] Failed to create METADATA.yaml for {skill_name}: {e}")
        return False

def main():
    """Main execution."""
    root = Path(__file__).parent.parent
    skills_dir = root / "skills"
    plugins_dir = root / "optional_plugins"

    print("=" * 70)
    print("Phase 11.2: Copy Singleton Skills to Optional Plugins")
    print("=" * 70)

    if not skills_dir.exists():
        print(f"✗ Error: skills/ not found at {skills_dir}")
        return False

    if not plugins_dir.exists():
        print(f"✗ Error: optional_plugins/ not found at {plugins_dir}")
        return False

    success_count = 0
    failed_skills = []

    for skill_name, (category, load_policy) in SINGLETON_SKILLS.items():
        src_skill = skills_dir / skill_name

        if not src_skill.exists():
            print(f"✗ Skill not found: {skill_name}")
            failed_skills.append(skill_name)
            continue

        # Determine destination path
        category_dir = plugins_dir / category
        dst_skill = category_dir / skill_name

        print(f"\n[{skill_name}]")

        # 1. Extract frontmatter
        frontmatter = extract_skill_frontmatter(src_skill)
        print(f"  Frontmatter: {frontmatter.get('name', 'N/A')} v{frontmatter.get('metadata', {}).get('version', '?')}")

        # 2. Copy skill directory
        if not copy_skill(src_skill, dst_skill):
            failed_skills.append(skill_name)
            continue

        # 3. Create METADATA.yaml
        if not create_metadata_yaml(dst_skill, skill_name, frontmatter):
            failed_skills.append(skill_name)
            continue

        success_count += 1

    print("\n" + "=" * 70)
    print(f"Results: {success_count}/{len(SINGLETON_SKILLS)} skills copied successfully")

    if failed_skills:
        print(f"Failed skills: {', '.join(failed_skills)}")
        return False

    print("[OK] All skills copied and metadata generated!")
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
