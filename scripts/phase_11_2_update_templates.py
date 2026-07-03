#!/usr/bin/env python3
"""
Phase 11.2: Update project templates with plugins array (V2 schema).

Maps project_type to auto-enable plugins:
- youtube → youtube-core
- pptx → pptx-core
- pbi-report, data → pbi-core
- code → code-mcp-tools
- geometry → geometry-rhino
- manuscript → manuscript-tools
- hybrid → [] (no auto-plugins)
- minimal → [] (no plugins)
"""

import json
import sys
from pathlib import Path

# Mapping: project_type -> list of plugin_ids to auto-enable
PLUGIN_MAPPING = {
    "youtube": ["youtube-core"],
    "pptx": ["pptx-core"],
    "pbi": ["pbi-core"],  # project-pbi.json
    "data": ["pbi-core"],  # project-data.json
    "code": ["code-mcp-tools"],
    "geometry": ["geometry-rhino"],
    "manuscript": ["manuscript-tools"],
    "hybrid": [],
    "minimal": [],
}

def update_template(template_path: Path, plugins: list[str]) -> bool:
    """Update a project template with plugins array."""
    try:
        with open(template_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Add schema_version (optional, defaults to 1.0.0 if missing)
        # We'll add it as a comment indicator
        if "schema_version" not in data:
            data["schema_version"] = "2.0.0"

        # Add or update plugins array
        data["plugins"] = [
            {
                "plugin_id": plugin_id,
                "enabled": True,
                "version": "1.0.0",
            }
            for plugin_id in plugins
        ]

        # Write back with nice formatting
        with open(template_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")

        num_plugins = len(plugins)
        print(f"  [OK] Updated {template_path.name} with {num_plugins} plugin(s)")
        return True
    except Exception as e:
        print(f"  [FAIL] Failed to update {template_path.name}: {e}")
        return False

def main():
    """Main execution."""
    root = Path(__file__).parent.parent
    templates_dir = root / "templates"

    print("=" * 70)
    print("Phase 11.2: Update Project Templates with Plugins")
    print("=" * 70)

    success_count = 0
    total_count = 0

    for template_name, plugins in PLUGIN_MAPPING.items():
        template_path = templates_dir / f"project-{template_name}.json"

        if not template_path.exists():
            print(f"  Warning: {template_path.name} not found")
            continue

        total_count += 1
        print(f"\n[{template_name}] ({len(plugins)} plugin(s))")

        if update_template(template_path, plugins):
            success_count += 1

    print("\n" + "=" * 70)
    print(f"Results: {success_count}/{total_count} templates updated")
    return success_count == total_count

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
