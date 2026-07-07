# Phase 11: Technical Reference & Implementation Guide

**Companion to**: `Artifacts/PHASE_11_PLUGIN_SYSTEM.md`

This document provides technical deep-dives, code examples, and validator logic for implementing the optional plugin system.

---

## 1. Skill Movement Matrix

### Movement Phases (What Happens When)

```
PHASE 11.1 (Infrastructure Week)
├─ Create optional_plugins/ directory tree
├─ Write plugin_manifest_schema.json
├─ Update scripts/manifest_validator.py (add V2 support)
└─ Validator now accepts BOTH V1 and V2 schemas

PHASE 11.2 (Copy & Validate Week)
├─ Copy all 12 singletons to optional_plugins/[category]/[skill]/
├─ Create plugin.yaml (category-level metadata)
├─ Create METADATA.yaml (skill-level metadata)
├─ Update all 9 project templates with "plugins" key
├─ Original skills/ remains UNCHANGED (safety redundancy)
└─ Validator passes all V1 + V2 tests

PHASE 11.3 (Deactivation Week)
├─ Migration script: idempotent copytree with dry-run
├─ After auditor sign-off: Delete skills/[singleton]/
├─ Cleanup: Remove singleton entries from skills/skills.overview.md
├─ Versioning: Git tag phase-11-complete
└─ Rollback: git restore skills/ + optional_plugins/
```

### Skill Movement State Table

| Skill | Phase 11.1 | Phase 11.2 | Phase 11.3 | Final State |
|:---|:---|:---|:---|:---|
| youtube-strategy | skills/ only | skills/ + plugins/ | plugins/ only | optional_plugins/youtube/ |
| pptx | skills/ only | skills/ + plugins/ | plugins/ only | optional_plugins/pptx/ |
| python-rhino-grasshopper | skills/ only | skills/ + plugins/ | plugins/ only | optional_plugins/geometry/ |
| *other 9 singletons* | skills/ only | skills/ + plugins/ | plugins/ only | optional_plugins/[cat]/ |
| codebase-navigator (foundational) | — | — | — | skills/ (never moves) |
| python-patterns (universal) | — | — | — | skills/ (never moves) |

---

## 2. Manifest Loader Logic (Pseudocode)

### Core Load Path

```python
# File: scripts/manifest_loader.py (pseudo-implementation)

from pathlib import Path
import json
import yaml
from typing import TypedDict, Literal

ProjectType = Literal["code", "geometry", "data", "pptx", "pbi-report", "youtube", "manuscript", "hybrid"]

class PluginReference(TypedDict):
    plugin_id: str
    category: str
    version: str
    enabled: bool
    skills: list[str]  # Optional; if omitted, load all skills in plugin

class SkillsConfig(TypedDict):
    auto_include: bool
    active_skills: list[str]
    disabled_skills: list[str]
    plugins: list[PluginReference]

def load_manifest(path: Path) -> dict:
    """Load and upgrade manifest to V2 if necessary."""
    with open(path) as f:
        manifest = json.load(f)
    
    # Detect schema version
    schema_version = manifest.get("schema_version", "1.0.0")
    
    if schema_version < "2.0.0":
        manifest = upgrade_v1_to_v2(manifest)
    
    return manifest

def upgrade_v1_to_v2(v1_manifest: dict) -> dict:
    """Idempotent V1 → V2 upgrade."""
    project_type: ProjectType = v1_manifest["project_type"]
    auto_include = v1_manifest.get("auto_include", True)
    
    # Get default plugins for this project type
    default_plugins = get_default_plugins_for_type(project_type)
    
    v1_manifest["schema_version"] = "2.0.0"
    v1_manifest["skills_config"] = SkillsConfig(
        auto_include=auto_include,
        active_skills=v1_manifest.get("active_skills", []),
        disabled_skills=v1_manifest.get("disabled_skills", []),
        plugins=default_plugins
    )
    
    # Remove deprecated top-level keys
    v1_manifest.pop("auto_include", None)
    v1_manifest.pop("active_skills", None)
    v1_manifest.pop("disabled_skills", None)
    
    return v1_manifest

def get_default_plugins_for_type(project_type: ProjectType) -> list[PluginReference]:
    """Return default plugin references for a project type."""
    DEFAULT_PLUGIN_MAP: dict[ProjectType, list[PluginReference]] = {
        "youtube": [
            PluginReference(
                plugin_id="youtube-core",
                category="youtube",
                version="1.0.0",
                enabled=True,
                skills=["youtube-strategy", "youtube-scriptwriting", "youtube-retention"]
            )
        ],
        "pptx": [
            PluginReference(
                plugin_id="pptx-core",
                category="pptx",
                version="1.0.0",
                enabled=True,
                skills=["pptx"]
            )
        ],
        "pbi-report": [
            PluginReference(
                plugin_id="pbi-core",
                category="pbi-report",
                version="1.0.0",
                enabled=True,
                skills=["powerbi-report"]
            )
        ],
        "code": [
            PluginReference(
                plugin_id="code-mcp",
                category="code-mcp",
                version="1.0.0",
                enabled=True,
                skills=["typescript-mcp", "python-mcp"]
            )
        ],
        "geometry": [
            PluginReference(
                plugin_id="geometry-core",
                category="geometry",
                version="1.0.0",
                enabled=True,
                skills=["cd-foundations", "python-rhino-grasshopper", "rhino-e2e-testing", "rhino-unit-testing"]
            )
        ],
        "data": [
            # data type has no singleton plugins (dax-modeling, powerbi-report are shared)
        ],
        "manuscript": [
            PluginReference(
                plugin_id="manuscript-core",
                category="manuscript",
                version="1.0.0",
                enabled=True,
                skills=["manuscript-review"]
            )
        ],
        "hybrid": [
            # hybrid auto-enables all applicable plugins based on detected project structure
        ],
    }
    
    return DEFAULT_PLUGIN_MAP.get(project_type, [])

def resolve_skills_for_project(manifest: dict, registry_path: Path) -> set[str]:
    """
    Resolve all effective skills for a project.
    Accounts for: foundational + universal + plugin-based + explicit declarations.
    """
    project_type: ProjectType = manifest["project_type"]
    skills_config: SkillsConfig = manifest["skills_config"]
    auto_include = skills_config["auto_include"]
    
    effective_skills = set()
    
    # 1. Always include foundational + universal
    effective_skills.update(FOUNDATIONAL_SKILLS)
    if auto_include:
        effective_skills.update(UNIVERSAL_SKILLS)
    
    # 2. Load plugins
    for plugin_ref in skills_config.get("plugins", []):
        if not plugin_ref.get("enabled", True):
            continue
        
        plugin_skills = plugin_ref.get("skills", [])
        if plugin_skills:
            effective_skills.update(plugin_skills)
        else:
            # Load all skills from plugin
            category = plugin_ref["category"]
            category_skills = load_plugin_skills(registry_path, category)
            effective_skills.update(category_skills)
    
    # 3. Add explicit active_skills
    effective_skills.update(skills_config.get("active_skills", []))
    
    # 4. Remove explicitly disabled skills
    effective_skills.difference_update(skills_config.get("disabled_skills", []))
    
    # 5. Validate all skills exist in registry
    validate_skill_existence(effective_skills, registry_path)
    
    return effective_skills

def load_plugin_skills(registry_path: Path, category: str) -> set[str]:
    """List all skills in a plugin category."""
    plugin_path = registry_path / "optional_plugins" / category
    
    if not plugin_path.exists():
        raise FileNotFoundError(f"Plugin category not found: {category}")
    
    skills = set()
    for skill_dir in plugin_path.iterdir():
        if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
            skills.add(skill_dir.name)
    
    return skills

FOUNDATIONAL_SKILLS = {
    "codebase-navigator",
    "systematic-debugging",
    "implementation-dispatch",
    "verification-gate",
    "project-planner",
    "project-journal",
    "doc-updater",
}

UNIVERSAL_SKILLS = {
    "python-patterns",
    "visual-composition",
    "dax-modeling",
    "business-analyst",
    "skill-creator",
    "banana-prompt",
    "glossary-extraction",
    "docx",
    "xlsx",
}

def validate_skill_existence(skills: set[str], registry_path: Path):
    """Verify all skills exist in either skills/ or optional_plugins/."""
    core_path = registry_path / "skills"
    plugin_path = registry_path / "optional_plugins"
    
    available = set()
    
    # Scan core skills
    for skill_dir in core_path.iterdir():
        if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
            available.add(skill_dir.name)
    
    # Scan plugin skills
    for category_dir in plugin_path.iterdir():
        if category_dir.is_dir():
            for skill_dir in category_dir.iterdir():
                if skill_dir.is_dir() and (skill_dir / "SKILL.md").exists():
                    available.add(skill_dir.name)
    
    # Check for missing
    missing = skills - available
    if missing:
        raise ValueError(f"Skills not found in registry: {missing}")
```

---

## 3. Token Cost Calculation Logic

### Calculation Method

```python
# File: scripts/token_analyzer.py

class SkillMetrics(TypedDict):
    name: str
    file_size_bytes: int
    estimated_tokens_standalone: int
    estimated_tokens_bundled: int  # Cost when loaded as part of plugin

def estimate_skill_tokens(skill_path: Path) -> SkillMetrics:
    """
    Estimate token cost for a skill.
    Heuristic: 1,000 bytes ≈ 250 tokens (conservative).
    """
    skill_md = skill_path / "SKILL.md"
    total_bytes = sum(f.stat().st_size for f in skill_path.rglob("*") if f.is_file())
    
    # L0 Abstract (always loaded for active skills)
    abstract_path = skill_path / "abstract.md"
    abstract_bytes = abstract_path.stat().st_size if abstract_path.exists() else 0
    
    # Estimate
    tokens_standalone = (total_bytes / 1000) * 250
    tokens_abstract = (abstract_bytes / 1000) * 250
    tokens_bundled = (total_bytes / 1000) * 250 * 0.85  # 15% discount for shared plugin context
    
    return SkillMetrics(
        name=skill_path.name,
        file_size_bytes=total_bytes,
        estimated_tokens_standalone=int(tokens_standalone),
        estimated_tokens_bundled=int(tokens_bundled)
    )

def calculate_project_tokens(project_type: ProjectType, include_plugins: bool = True) -> dict:
    """Calculate total token cost for a project type's skill bootstrap."""
    
    # Foundational + Universal (always loaded)
    foundational_cost = sum(estimate_skill_tokens(Path(f"skills/{s}")).estimated_tokens_standalone 
                            for s in FOUNDATIONAL_SKILLS)
    universal_cost = sum(estimate_skill_tokens(Path(f"skills/{s}")).estimated_tokens_standalone 
                        for s in UNIVERSAL_SKILLS)
    
    # Project-type-specific skills
    default_skills = get_default_skills_for_type(project_type)
    default_cost = sum(estimate_skill_tokens(Path(f"skills/{s}")).estimated_tokens_standalone 
                       for s in default_skills)
    
    # Singleton plugins (if using plugin system)
    plugin_cost = 0
    if include_plugins:
        plugins = get_default_plugins_for_type(project_type)
        for plugin_ref in plugins:
            for skill_name in plugin_ref["skills"]:
                plugin_path = Path(f"optional_plugins/{plugin_ref['category']}/{skill_name}")
                plugin_cost += estimate_skill_tokens(plugin_path).estimated_tokens_bundled
    
    return {
        "foundational": foundational_cost,
        "universal": universal_cost,
        "project_specific": default_cost if not include_plugins else 0,
        "plugins": plugin_cost,
        "total": foundational_cost + universal_cost + (default_cost if not include_plugins else plugin_cost),
        "savings": (default_cost - plugin_cost) if include_plugins else 0
    }

# Example output
example_youtube_tokens = calculate_project_tokens("youtube", include_plugins=True)
# {
#   "foundational": 1800,
#   "universal": 1200,
#   "project_specific": 0,
#   "plugins": 2200,
#   "total": 5200,
#   "savings": 2800  # Difference between old (8000) and new (5200)
# }
```

---

## 4. Plugin Discovery & Caching

### Plugin Registry Cache (For Performance)

```python
# File: scripts/plugin_registry.py

from functools import lru_cache
import json

class PluginRegistry:
    """Lazy-load and cache plugin metadata."""
    
    def __init__(self, registry_path: Path):
        self.registry_path = registry_path
        self._plugin_cache: dict[str, dict] = {}
    
    @lru_cache(maxsize=32)
    def get_plugin_metadata(self, category: str) -> dict:
        """Load plugin.yaml for a category (cached)."""
        plugin_yaml_path = self.registry_path / "optional_plugins" / category / "plugin.yaml"
        
        if not plugin_yaml_path.exists():
            raise FileNotFoundError(f"Plugin metadata not found: {category}")
        
        with open(plugin_yaml_path) as f:
            return yaml.safe_load(f)
    
    def list_available_plugins(self) -> list[str]:
        """List all available plugin categories."""
        optional_plugins_path = self.registry_path / "optional_plugins"
        
        categories = [d.name for d in optional_plugins_path.iterdir() 
                      if d.is_dir() and (d / "plugin.yaml").exists()]
        
        return sorted(categories)
    
    def get_plugin_skills(self, category: str) -> list[str]:
        """List all skills in a plugin category."""
        plugin_meta = self.get_plugin_metadata(category)
        return [s["name"] for s in plugin_meta.get("skills", [])]
    
    def validate_plugin(self, category: str) -> tuple[bool, list[str]]:
        """
        Validate a plugin against schema.
        Returns: (is_valid, error_messages)
        """
        errors = []
        
        try:
            plugin_meta = self.get_plugin_metadata(category)
        except FileNotFoundError as e:
            return False, [str(e)]
        
        # Validate required fields
        required_fields = ["plugin_category", "version", "compatibility", "skills"]
        for field in required_fields:
            if field not in plugin_meta:
                errors.append(f"Missing required field: {field}")
        
        # Validate compatibility matrix
        if "compatibility" in plugin_meta:
            comp = plugin_meta["compatibility"]
            if "project_types" not in comp:
                errors.append("Missing compatibility.project_types")
            if "min_ai_os_version" not in comp:
                errors.append("Missing compatibility.min_ai_os_version")
        
        # Validate skills
        for skill in plugin_meta.get("skills", []):
            skill_path = self.registry_path / "optional_plugins" / category / skill["name"]
            if not (skill_path / "SKILL.md").exists():
                errors.append(f"Skill not found: {skill['name']}")
            if not (skill_path / "METADATA.yaml").exists():
                errors.append(f"Skill metadata missing: {skill['name']}")
        
        return len(errors) == 0, errors

# Usage
registry = PluginRegistry(Path("optional_plugins"))
for category in registry.list_available_plugins():
    is_valid, errors = registry.validate_plugin(category)
    print(f"{category}: {'PASS' if is_valid else 'FAIL'}")
    for error in errors:
        print(f"  - {error}")
```

---

## 5. Backward Compatibility Harness

### Test Cases for V1 ↔ V2 Conversion

```python
# File: tests/test_manifest_upgrade.py

import json
from pathlib import Path
from scripts.manifest_loader import load_manifest, upgrade_v1_to_v2

def test_upgrade_v1_youtube_to_v2():
    """V1 YouTube manifest should upgrade to V2 with plugins."""
    v1_manifest = {
        "project_name": "My YouTube Channel",
        "project_type": "youtube",
        "auto_include": True,
        "active_skills": [],
        "disabled_skills": []
    }
    
    v2_manifest = upgrade_v1_to_v2(v1_manifest)
    
    assert v2_manifest["schema_version"] == "2.0.0"
    assert "skills_config" in v2_manifest
    assert len(v2_manifest["skills_config"]["plugins"]) == 1
    assert v2_manifest["skills_config"]["plugins"][0]["plugin_id"] == "youtube-core"
    assert set(v2_manifest["skills_config"]["plugins"][0]["skills"]) == {
        "youtube-strategy", "youtube-scriptwriting", "youtube-retention"
    }

def test_upgrade_preserves_auto_include():
    """auto_include setting should carry over to skills_config."""
    v1 = {"project_type": "code", "auto_include": False}
    v2 = upgrade_v1_to_v2(v1)
    assert v2["skills_config"]["auto_include"] == False

def test_upgrade_preserves_custom_skills():
    """Custom active_skills and disabled_skills should carry over."""
    v1 = {
        "project_type": "code",
        "active_skills": ["my-custom-skill"],
        "disabled_skills": ["codebase-navigator"]
    }
    v2 = upgrade_v1_to_v2(v1)
    assert "my-custom-skill" in v2["skills_config"]["active_skills"]
    assert "codebase-navigator" in v2["skills_config"]["disabled_skills"]

def test_v2_manifest_loads_as_is():
    """V2 manifest should not be re-upgraded."""
    v2_manifest = {
        "project_type": "pptx",
        "schema_version": "2.0.0",
        "skills_config": {
            "auto_include": True,
            "plugins": [
                {
                    "plugin_id": "pptx-core",
                    "category": "pptx",
                    "version": "1.0.0",
                    "enabled": True
                }
            ]
        }
    }
    
    loaded = load_manifest_from_dict(v2_manifest)
    assert loaded["schema_version"] == "2.0.0"  # Unchanged

def test_hybrid_project_loads_default_plugins():
    """Hybrid project should auto-enable all applicable plugins."""
    v1 = {"project_type": "hybrid"}
    v2 = upgrade_v1_to_v2(v1)
    
    # Hybrid should have EMPTY plugin list initially (filled by project detection)
    assert v2["skills_config"]["plugins"] == []
```

---

## 6. Dependency Resolution for Plugins

### Plugin Dependency Graph

```python
# File: scripts/plugin_dependencies.py

from typing import set
from dataclasses import dataclass

@dataclass
class PluginDependency:
    plugin_id: str
    requires: list[str]  # List of plugin_ids this depends on
    conflicts_with: list[str]  # List of plugin_ids this conflicts with

def load_plugin_dependencies(registry_path: Path) -> dict[str, PluginDependency]:
    """Load dependency metadata for all plugins."""
    dependencies = {}
    
    for category_dir in (registry_path / "optional_plugins").iterdir():
        plugin_yaml = category_dir / "plugin.yaml"
        if plugin_yaml.exists():
            meta = yaml.safe_load(open(plugin_yaml))
            plugin_id = meta["plugin_category"]
            
            dependencies[plugin_id] = PluginDependency(
                plugin_id=plugin_id,
                requires=meta.get("dependencies", []),
                conflicts_with=meta.get("conflicts", [])
            )
    
    return dependencies

def validate_plugin_dependencies(selected_plugins: list[str], 
                                 dependencies: dict[str, PluginDependency]) -> tuple[bool, list[str]]:
    """
    Check if plugin selections are valid (no conflicts, all deps satisfied).
    Returns: (is_valid, error_messages)
    """
    errors = []
    selected_set = set(selected_plugins)
    
    for plugin_id in selected_plugins:
        if plugin_id not in dependencies:
            errors.append(f"Plugin not found: {plugin_id}")
            continue
        
        dep = dependencies[plugin_id]
        
        # Check dependencies
        for required in dep.requires:
            if required not in selected_set:
                errors.append(f"Plugin '{plugin_id}' requires '{required}' but it is not enabled")
        
        # Check conflicts
        for conflict in dep.conflicts_with:
            if conflict in selected_set:
                errors.append(f"Plugin '{plugin_id}' conflicts with '{conflict}'")
    
    return len(errors) == 0, errors

# Example: geometry plugin might depend on python-patterns
# geometry-core.plugin.yaml:
# dependencies: [python-patterns]
# conflicts_with: []
```

---

## 7. Migration Script (Idempotent & Safe)

### Full Implementation

```bash
#!/usr/bin/env python3
"""
migrate_skills_to_plugins.py

Idempotent migration of 12 singleton skills from skills/ to optional_plugins/.
Safe: Does not delete originals until auditor approves.
Reversible: All changes tracked in git.

Usage:
    python migrate_skills_to_plugins.py --dry-run    # Show what would happen
    python migrate_skills_to_plugins.py --apply       # Perform migration
    python migrate_skills_to_plugins.py --rollback    # Revert via git
"""

import argparse
import shutil
import json
from pathlib import Path
from typing import list

SINGLETONS: dict[str, list[str]] = {
    "youtube": ["youtube-strategy", "youtube-scriptwriting", "youtube-retention"],
    "pptx": ["pptx"],
    "pbi-report": ["powerbi-report"],
    "code-mcp": ["typescript-mcp", "python-mcp"],
    "geometry": ["cd-foundations", "python-rhino-grasshopper", "rhino-e2e-testing", "rhino-unit-testing"],
    "manuscript": ["manuscript-review"],
}

REGISTRY_ROOT = Path(__file__).parent.parent

def copy_skill(src: Path, dst: Path, dry_run: bool = True) -> bool:
    """Copy a single skill; return True if successful."""
    if dst.exists():
        print(f"[SKIP] Already exists: {dst}")
        return True
    
    if dry_run:
        print(f"[DRY-RUN] cp -r {src} {dst}")
        return True
    else:
        try:
            shutil.copytree(src, dst)
            print(f"[OK] Copied {src.name} -> {dst}")
            return True
        except Exception as e:
            print(f"[FAIL] {e}")
            return False

def apply_migration(dry_run: bool = True) -> bool:
    """Apply migration: copy all singletons to optional_plugins/."""
    all_ok = True
    
    for category, skills in SINGLETONS.items():
        category_dir = REGISTRY_ROOT / "optional_plugins" / category
        category_dir.mkdir(parents=True, exist_ok=True)
        
        for skill in skills:
            src = REGISTRY_ROOT / "skills" / skill
            dst = category_dir / skill
            
            if not src.exists():
                print(f"[WARN] Source not found: {src}")
                all_ok = False
                continue
            
            if not copy_skill(src, dst, dry_run=dry_run):
                all_ok = False
    
    return all_ok

def validate_after_migration() -> bool:
    """Verify that all skills were copied correctly."""
    for category, skills in SINGLETONS.items():
        for skill in skills:
            dst = REGISTRY_ROOT / "optional_plugins" / category / skill / "SKILL.md"
            if not dst.exists():
                print(f"[FAIL] Validation: {dst} not found")
                return False
    
    print("[OK] All skills migrated successfully")
    return True

def main():
    parser = argparse.ArgumentParser(description="Migrate singleton skills to optional plugins")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="Show what would happen (no changes)")
    group.add_argument("--apply", action="store_true", help="Perform migration")
    group.add_argument("--rollback", action="store_true", help="Revert via git")
    
    args = parser.parse_args()
    
    if args.dry_run:
        print("=== DRY RUN (No changes will be made) ===\n")
        apply_migration(dry_run=True)
    
    elif args.apply:
        print("=== APPLYING MIGRATION ===\n")
        if apply_migration(dry_run=False):
            if validate_after_migration():
                print("\n[SUCCESS] Migration complete. Run: git status")
                return 0
        print("\n[FAIL] Migration did not complete successfully")
        return 1
    
    elif args.rollback:
        print("=== ROLLBACK (Reverting to git HEAD) ===\n")
        # Let git handle the rollback
        import subprocess
        result = subprocess.run(["git", "restore", "skills/", "optional_plugins/"], 
                                cwd=REGISTRY_ROOT)
        return result.returncode

if __name__ == "__main__":
    exit(main())
```

---

## 8. Rollback Checklist

### Pre-Merge Rollback Validation

```bash
#!/bin/bash
# scripts/validate_rollback.sh

set -e  # Exit on error

REGISTRY_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REGISTRY_ROOT"

echo "=== ROLLBACK VALIDATION ==="
echo

# Step 1: Check git status
echo "[1/5] Checking git status..."
git diff --quiet || echo "  ✓ Uncommitted changes present"

# Step 2: Backup current state
echo "[2/5] Backing up current state..."
BACKUP_DIR="/tmp/plugin-system-rollback-$(date +%s)"
mkdir -p "$BACKUP_DIR"
cp -r skills/ "$BACKUP_DIR/"
cp -r optional_plugins/ "$BACKUP_DIR/" 2>/dev/null || true
echo "  ✓ Backup created: $BACKUP_DIR"

# Step 3: Simulate rollback
echo "[3/5] Simulating rollback..."
git restore --staged .
git restore .
echo "  ✓ Rollback simulated"

# Step 4: Validate V1 manifest format
echo "[4/5] Validating V1 manifest format..."
python scripts/manifest_validator.py validate-schema templates/project-youtube.json "1.0.0" || exit 1
echo "  ✓ V1 manifests valid"

# Step 5: Restore current state
echo "[5/5] Restoring current state..."
cp -r "$BACKUP_DIR/skills/" .
cp -r "$BACKUP_DIR/optional_plugins/" . 2>/dev/null || true
git add .
echo "  ✓ Restored"

echo
echo "[SUCCESS] Rollback procedure validated"
```

---

## 9. Summary: Validator Updates

### Lines Changed in `scripts/manifest_validator.py`

**Estimated changes**: ~150 lines (non-breaking)

```python
# BEFORE: Only V1 schema
DEFAULT_SKILLS: dict[ProjectType, list[str]] = {
    "youtube": ["youtube-strategy", ...],
    ...
}

# AFTER: V1 + V2 schemas
DEFAULT_PLUGINS: dict[ProjectType, list[dict]] = {
    "youtube": [
        {
            "plugin_id": "youtube-core",
            "category": "youtube",
            "version": "1.0.0",
            "enabled": True,
            "skills": ["youtube-strategy", ...]
        }
    ],
    ...
}

def validate_manifest(manifest_path) -> ValidationResult:
    # Add version detection
    schema_version = manifest.get("schema_version", "1.0.0")
    
    if schema_version == "1.0.0":
        # Use V1 validation logic
        validate_v1(manifest)
    elif schema_version == "2.0.0":
        # Use V2 validation logic
        validate_v2(manifest)
    else:
        errors.append(f"Unknown schema version: {schema_version}")
```

---

## 10. File Checklist for Phase 11.3 Cleanup

### Files to Delete (After Auditor Approval)

```
skills/youtube-strategy/               (entire directory)
skills/youtube-scriptwriting/          (entire directory)
skills/youtube-retention/              (entire directory)
skills/pptx/                           (entire directory)
skills/powerbi-report/                 (entire directory)
skills/typescript-mcp/                 (entire directory)
skills/cd-foundations/                 (entire directory)
skills/python-rhino-grasshopper/       (entire directory)
skills/rhino-e2e-testing/              (entire directory)
skills/rhino-unit-testing/             (entire directory)
skills/manuscript-review/              (entire directory)
skills/python-mcp/                     (entire directory)
```

### Files to Update (After Auditor Approval)

```
skills/skills.overview.md              (remove singleton references; add plugin registry link)
Artifacts/MEMORY_ANCHORS.md            (add plugin system anchor)
CLAUDE.md                              (update routing to mention plugins)
rules/common/orchestration.md          (reference plugin discovery in task lifecycle)
```

---

## Appendix: JSON Schema for Plugin Manifest

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Plugin Manifest Schema",
  "type": "object",
  "required": ["plugin_category", "version", "compatibility", "skills"],
  "properties": {
    "plugin_category": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Unique identifier for the plugin category"
    },
    "display_name": {
      "type": "string",
      "description": "Human-readable plugin name"
    },
    "description": {
      "type": "string",
      "description": "Purpose of the plugin"
    },
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Semantic version (MAJOR.MINOR.PATCH)"
    },
    "released_date": {
      "type": "string",
      "format": "date",
      "description": "ISO 8601 release date"
    },
    "stability": {
      "type": "string",
      "enum": ["beta", "stable", "deprecated"],
      "default": "stable"
    },
    "compatibility": {
      "type": "object",
      "required": ["project_types", "min_ai_os_version"],
      "properties": {
        "project_types": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["youtube", "pptx", "pbi-report", "geometry", "code", "data", "manuscript", "hybrid"]
          }
        },
        "min_ai_os_version": {
          "type": "string",
          "pattern": "^\\d+\\.\\d+\\.\\d+$"
        },
        "max_ai_os_version": {
          "type": ["string", "null"]
        },
        "deprecated": {
          "type": "boolean",
          "default": false
        }
      }
    },
    "skills": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "version"],
        "properties": {
          "name": {
            "type": "string",
            "pattern": "^[a-z0-9-]+$"
          },
          "version": {
            "type": "string",
            "pattern": "^\\d+\\.\\d+\\.\\d+$"
          },
          "trigger": {
            "type": "string"
          },
          "agents": {
            "type": "array",
            "items": { "type": "string" }
          }
        }
      }
    },
    "dependencies": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "conflicts_with": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "auto_enable": {
      "type": "object",
      "properties": {
        "project_types": {
          "type": "array",
          "items": { "type": "string" }
        },
        "conditions": {
          "type": "array",
          "items": { "type": "object" }
        }
      }
    }
  }
}
```

---

**Status**: Ready for Phase 11.1 kickoff.
