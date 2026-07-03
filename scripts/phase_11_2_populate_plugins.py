#!/usr/bin/env python3
"""
Phase 11.2: Populate plugin.yaml files with skill details.

This script:
1. Reads METADATA.yaml from each skill directory
2. Updates each category's plugin.yaml with complete skill array
3. Maintains existing plugin metadata (category, version, description, etc.)
"""

import sys
from pathlib import Path
from typing import Any

import yaml

# Skill mapping: skill_name -> (category, load_policy)
SINGLETON_SKILLS = {
    "youtube-strategy": ("youtube", "auto"),
    "youtube-scriptwriting": ("youtube", "auto"),
    "youtube-retention": ("youtube", "auto"),
    "pptx": ("pptx", "auto"),
    "powerbi-report": ("pbi-report", "auto"),
    "typescript-mcp": ("code-mcp", "auto"),
    "python-mcp": ("code-mcp", "auto"),
    "cd-foundations": ("geometry", "auto"),
    "python-rhino-grasshopper": ("geometry", "auto"),
    "rhino-e2e-testing": ("geometry", "auto"),
    "rhino-unit-testing": ("geometry", "auto"),
    "manuscript-review": ("manuscript", "auto"),
}

def read_metadata(skill_path: Path) -> dict[str, Any]:
    """Read METADATA.yaml from a skill directory."""
    metadata_file = skill_path / "METADATA.yaml"
    if not metadata_file.exists():
        return {}

    try:
        with open(metadata_file, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        print(f"  Warning: Failed to read metadata for {skill_path.name}: {e}")
        return {}

def update_plugin_yaml(plugin_yaml_path: Path, skills_data: list[dict[str, Any]]) -> bool:
    """Update plugin.yaml with skills array."""
    if not plugin_yaml_path.exists():
        print(f"  Error: {plugin_yaml_path} does not exist")
        return False

    try:
        with open(plugin_yaml_path, "r", encoding="utf-8") as f:
            plugin_data = yaml.safe_load(f) or {}

        # Update skills array
        plugin_data["skills"] = skills_data

        # Write back
        with open(plugin_yaml_path, "w", encoding="utf-8") as f:
            yaml.dump(plugin_data, f, default_flow_style=False, sort_keys=False)

        print(f"  [OK] Updated {plugin_yaml_path.name} with {len(skills_data)} skills")
        return True
    except Exception as e:
        print(f"  Error: Failed to update {plugin_yaml_path}: {e}")
        return False

def main():
    """Main execution."""
    root = Path(__file__).parent.parent
    plugins_dir = root / "optional_plugins"

    print("=" * 70)
    print("Phase 11.2: Populate plugin.yaml with Skill Details")
    print("=" * 70)

    # Group skills by category
    categories: dict[str, list[tuple[str, str]]] = {}
    for skill_name, (category, load_policy) in SINGLETON_SKILLS.items():
        if category not in categories:
            categories[category] = []
        categories[category].append((skill_name, load_policy))

    success_count = 0
    total_count = len(categories)

    for category in sorted(categories.keys()):
        skills_list = categories[category]
        print(f"\n[{category}] ({len(skills_list)} skills)")

        category_dir = plugins_dir / category
        plugin_yaml_path = category_dir / "plugin.yaml"

        if not category_dir.exists():
            print(f"  Error: {category_dir} does not exist")
            continue

        # Build skills array for plugin.yaml
        skills_data = []
        for skill_name, load_policy in skills_list:
            skill_path = category_dir / skill_name
            metadata = read_metadata(skill_path)

            skill_entry = {
                "name": skill_name,
                "version": metadata.get("version", "1.0.0"),
                "load_policy": load_policy,
            }
            skills_data.append(skill_entry)

        # Update plugin.yaml
        if update_plugin_yaml(plugin_yaml_path, skills_data):
            success_count += 1

    print("\n" + "=" * 70)
    print(f"Results: {success_count}/{total_count} plugin.yaml files updated")
    return success_count == total_count

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
