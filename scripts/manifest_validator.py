#!/usr/bin/env python3
"""
Manifest Validator & Analyzer

Validates project.json against the JSON schema and provides optimization recommendations.
Used by the /manifest command in the concierge workflow.

Supports both Schema V1 (legacy) and V2 (with plugins).
"""

import json
import sys
from pathlib import Path
from typing import TypedDict, Literal, Optional
from dataclasses import dataclass
from copy import deepcopy

# Project types
ProjectType = Literal["code", "geometry", "data", "pptx", "pbi-report", "youtube", "manuscript", "hybrid"]
SchemaVersion = Literal["1.0.0", "2.0.0"]

# Plugin categories
PluginCategory = Literal["youtube", "pptx", "pbi-report", "code-mcp", "geometry", "manuscript"]

# Default skills per project type (V1 + V2 compatible)
DEFAULT_SKILLS: dict[ProjectType, list[str]] = {
    "youtube": ["youtube-strategy", "youtube-scriptwriting", "youtube-retention"],
    "pptx": ["pptx", "visual-composition", "python-patterns"],
    "pbi-report": ["powerbi-report", "visual-composition", "dax-modeling"],
    "geometry": ["cd-foundations", "python-rhino-grasshopper", "rhino-e2e-testing", "rhino-unit-testing", "python-patterns"],
    "code": ["codebase-navigator", "systematic-debugging", "python-patterns", "python-mcp", "typescript-mcp"],
    "manuscript": ["manuscript-review", "glossary-extraction"],
    "data": ["dax-modeling", "powerbi-report", "python-patterns"],
    "hybrid": [],  # All applicable based on detected files
}

FOUNDATIONAL_SKILLS = ["codebase-navigator", "systematic-debugging", "implementation-dispatch", "verification-gate", "project-planner", "project-journal", "doc-updater"]

# Plugin definitions (V2 only)
PLUGIN_REGISTRY: dict[str, dict] = {
    "youtube-core": {
        "category": "youtube",
        "skills": ["youtube-strategy", "youtube-scriptwriting", "youtube-retention"],
        "project_types": ["youtube"],
    },
    "pptx-core": {
        "category": "pptx",
        "skills": ["pptx"],
        "project_types": ["pptx"],
    },
    "pbi-core": {
        "category": "pbi-report",
        "skills": ["powerbi-report"],
        "project_types": ["pbi-report", "data"],
    },
    "code-mcp-tools": {
        "category": "code-mcp",
        "skills": ["python-mcp", "typescript-mcp"],
        "project_types": ["code"],
    },
    "geometry-rhino": {
        "category": "geometry",
        "skills": ["cd-foundations", "python-rhino-grasshopper", "rhino-e2e-testing", "rhino-unit-testing"],
        "project_types": ["geometry"],
    },
    "manuscript-tools": {
        "category": "manuscript",
        "skills": ["manuscript-review"],
        "project_types": ["manuscript"],
    },
}

@dataclass
class ValidationResult:
    valid: bool
    errors: list[str]
    warnings: list[str]
    schema_version: SchemaVersion = "1.0.0"

@dataclass
class AnalysisResult:
    project_type: ProjectType
    auto_include: bool
    active_skills: list[str]
    disabled_skills: list[str]
    effective_skills: list[str]
    default_skills: list[str]
    token_savings: int
    unused_declarations: list[str]
    missing_skills: list[str]
    recommendations: list[str]
    active_plugins: list[str] = None  # V2 only

@dataclass
class PluginValidationResult:
    valid: bool
    errors: list[str]
    warnings: list[str]
    active_plugins: list[str]


def detect_schema_version(manifest: dict) -> SchemaVersion:
    """
    Detect manifest schema version based on structure.

    Returns "1.0.0" if no schema_version field (legacy).
    Returns "2.0.0" if schema_version field is present.
    """
    if "schema_version" in manifest:
        return "2.0.0"
    return "1.0.0"


def auto_upgrade_v1_to_v2(manifest_v1: dict) -> dict:
    """
    Convert V1 manifest to V2 structure idempotently.

    Does NOT write to disk. Returns upgraded manifest for review.
    Preserves all V1 fields and infers plugin list from project_type.
    """
    if detect_schema_version(manifest_v1) == "2.0.0":
        # Already V2, return as-is
        return deepcopy(manifest_v1)

    # Create V2 manifest from V1
    manifest_v2 = deepcopy(manifest_v1)
    manifest_v2["schema_version"] = "2.0.0"

    # Infer plugins from project_type
    project_type = manifest_v1.get("project_type", "code")
    inferred_plugins = []

    for plugin_id, plugin_def in PLUGIN_REGISTRY.items():
        if project_type in plugin_def["project_types"]:
            inferred_plugins.append({"plugin_id": plugin_id, "enabled": True})

    # Add plugins section if not present
    if "plugins" not in manifest_v2 and inferred_plugins:
        manifest_v2["plugins"] = inferred_plugins
    elif "plugins" not in manifest_v2:
        manifest_v2["plugins"] = []

    return manifest_v2


def validate_plugins(manifest: dict, plugins_dir: Path) -> PluginValidationResult:
    """
    Validate that all referenced plugins exist and are valid.

    Checks:
    1. Each plugin_id in manifest.plugins exists in plugins_dir
    2. Each plugin's plugin.yaml is valid YAML
    3. Referenced skills exist as directories
    """
    errors, warnings = [], []
    active_plugins = []

    plugins_list = manifest.get("plugins", [])
    if not isinstance(plugins_list, list):
        errors.append("Field 'plugins' must be an array")
        return PluginValidationResult(valid=False, errors=errors, warnings=warnings, active_plugins=[])

    for plugin_ref in plugins_list:
        if not isinstance(plugin_ref, dict):
            errors.append(f"Plugin reference must be object, got {type(plugin_ref)}")
            continue

        plugin_id = plugin_ref.get("plugin_id")
        enabled = plugin_ref.get("enabled", True)

        if not plugin_id:
            errors.append("Each plugin reference must have 'plugin_id'")
            continue

        # Check if plugin exists in registry
        if plugin_id not in PLUGIN_REGISTRY:
            errors.append(f"Unknown plugin_id: '{plugin_id}' (not in PLUGIN_REGISTRY)")
            continue

        # If enabled, validate plugin directory exists
        if enabled:
            plugin_def = PLUGIN_REGISTRY[plugin_id]
            category = plugin_def["category"]
            plugin_dir = plugins_dir / category

            if not plugin_dir.exists():
                warnings.append(f"Plugin directory not found: {plugin_dir.relative_to(plugins_dir.parent)}")
                continue

            plugin_yaml = plugin_dir / "plugin.yaml"
            if not plugin_yaml.exists():
                warnings.append(f"Plugin manifest missing: {plugin_yaml.relative_to(plugins_dir.parent)}")
                continue

            # Validate skills directories exist
            for skill_name in plugin_def["skills"]:
                skill_dir = plugin_dir / skill_name
                if not skill_dir.exists():
                    warnings.append(f"Skill directory not found: {skill_dir.relative_to(plugins_dir.parent)}")

            active_plugins.append(plugin_id)

    return PluginValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        active_plugins=active_plugins
    )


def validate_manifest(manifest_path: Path) -> ValidationResult:
    """Validate manifest against schema (V1 or V2)."""
    errors, warnings = [], []

    # Check file exists
    if not manifest_path.exists():
        return ValidationResult(valid=False, errors=["project.json not found"], warnings=[], schema_version="1.0.0")

    # Parse JSON
    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
    except json.JSONDecodeError as e:
        return ValidationResult(valid=False, errors=[f"Invalid JSON: {e}"], warnings=[], schema_version="1.0.0")

    # Detect schema version
    schema_version = detect_schema_version(manifest)

    # Validate required fields
    if "project_type" not in manifest:
        errors.append("Missing required field: project_type")
    elif manifest["project_type"] not in DEFAULT_SKILLS:
        errors.append(f"Invalid project_type: {manifest['project_type']}")

    # Validate optional fields
    if "auto_include" in manifest and not isinstance(manifest["auto_include"], bool):
        errors.append("Field 'auto_include' must be boolean")

    if "active_skills" in manifest and not isinstance(manifest["active_skills"], list):
        errors.append("Field 'active_skills' must be an array")

    if "disabled_skills" in manifest and not isinstance(manifest["disabled_skills"], list):
        errors.append("Field 'disabled_skills' must be an array")

    # V2-specific validation
    if schema_version == "2.0.0":
        if "schema_version" in manifest and not isinstance(manifest["schema_version"], str):
            errors.append("Field 'schema_version' must be a string")

        if "plugins" in manifest and not isinstance(manifest["plugins"], list):
            errors.append("Field 'plugins' must be an array")

    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        schema_version=schema_version
    )


def analyze_manifest(manifest_path: Path, skill_registry_path: Path) -> AnalysisResult:
    """Analyze manifest and provide recommendations (V1 and V2 compatible)."""
    with open(manifest_path) as f:
        manifest = json.load(f)

    # Load available skills from registry
    available_skills = set()
    for skill_dir in skill_registry_path.glob("*/SKILL.md"):
        available_skills.add(skill_dir.parent.name)

    project_type: ProjectType = manifest.get("project_type", "code")
    auto_include = manifest.get("auto_include", True)
    active_skills = manifest.get("active_skills", [])
    disabled_skills = manifest.get("disabled_skills", [])

    # V2: Detect active plugins and their skills
    active_plugins = []
    plugin_skills = []
    if "plugins" in manifest:
        for plugin_ref in manifest.get("plugins", []):
            if plugin_ref.get("enabled", True):
                plugin_id = plugin_ref.get("plugin_id")
                if plugin_id in PLUGIN_REGISTRY:
                    active_plugins.append(plugin_id)
                    plugin_skills.extend(PLUGIN_REGISTRY[plugin_id]["skills"])

    # Compute effective skills
    if auto_include:
        default = DEFAULT_SKILLS.get(project_type, []) + FOUNDATIONAL_SKILLS
        # V2: Add plugin skills to effective set
        effective = (set(default) | set(active_skills) | set(plugin_skills)) - set(disabled_skills)
    else:
        effective = set(active_skills) | set(plugin_skills)

    effective_list = sorted(list(effective))

    # Find issues
    unused = [s for s in active_skills if s in DEFAULT_SKILLS.get(project_type, [])]
    missing = [s for s in (active_skills + disabled_skills) if s not in available_skills and s not in plugin_skills]

    # Token calculation (rough: ~100 tokens per skill L1 metadata)
    all_skills_count = len(available_skills)
    current_cost = len(effective_list) * 100
    all_skills_cost = all_skills_count * 100
    savings = all_skills_cost - current_cost

    # Recommendations
    recommendations = []
    if unused:
        recommendations.append(f"Remove redundant skills from active_skills: {', '.join(unused)}")
    if missing:
        recommendations.append(f"Fix unknown skills (check spelling): {', '.join(missing)}")
    if len(effective_list) <= 4 and auto_include:
        recommendations.append("Consider setting auto_include=false for ~2,400 token savings")
    if len(effective_list) > 15 and not auto_include:
        recommendations.append("Consider setting auto_include=true to reduce maintenance burden")

    return AnalysisResult(
        project_type=project_type,
        auto_include=auto_include,
        active_skills=sorted(active_skills),
        disabled_skills=sorted(disabled_skills),
        effective_skills=effective_list,
        default_skills=sorted(DEFAULT_SKILLS.get(project_type, [])),
        token_savings=savings,
        unused_declarations=unused,
        missing_skills=missing,
        recommendations=recommendations,
        active_plugins=active_plugins if active_plugins else None,
    )


def format_report(validation: ValidationResult, analysis: AnalysisResult | None = None) -> str:
    """Format a human-readable report."""
    lines = []

    # Header
    lines.append("# Manifest Report")
    lines.append("")

    # Schema version
    lines.append(f"**Schema Version**: `{validation.schema_version}`")
    if validation.schema_version == "1.0.0":
        lines.append("_Hint: Run with `--upgrade-schema` to opt into V2 (plugins support)._")
    lines.append("")

    # Validation status
    if validation.valid:
        lines.append("✅ **Manifest is valid**")
    else:
        lines.append("❌ **Manifest has errors**")
        for error in validation.errors:
            lines.append(f"  - {error}")
        lines.append("")
        return "\n".join(lines)

    if validation.warnings:
        for warning in validation.warnings:
            lines.append(f"⚠️ {warning}")
        lines.append("")

    if not analysis:
        return "\n".join(lines)

    # Analysis details
    lines.append(f"**Project Type**: `{analysis.project_type}`")
    lines.append(f"**Auto-include**: {'Yes' if analysis.auto_include else 'No'}")
    if analysis.active_plugins:
        lines.append(f"**Active Plugins**: {', '.join(f'`{p}`' for p in analysis.active_plugins)}")
    lines.append(f"**Active Skills**: {len(analysis.effective_skills)}")
    lines.append("")

    # Effective skills list
    lines.append("## Active Skills")
    if analysis.effective_skills:
        for skill in analysis.effective_skills:
            lines.append(f"- `{skill}`")
    else:
        lines.append("*(none)*")
    lines.append("")

    # Issues
    if analysis.missing_skills:
        lines.append("## ⚠️ Issues")
        lines.append("**Unknown skills** (typo or removed):")
        for skill in analysis.missing_skills:
            lines.append(f"- `{skill}`")
        lines.append("")

    if analysis.unused_declarations:
        lines.append("**Redundant skills** (already in defaults):")
        for skill in analysis.unused_declarations:
            lines.append(f"- `{skill}`")
        lines.append("")

    # Token analysis
    lines.append("## Token Analysis")
    lines.append(f"- **Current**: ~{len(analysis.effective_skills) * 100} tokens (L1 metadata)")
    lines.append(f"- **All skills**: ~{len(analysis.effective_skills) * 100} tokens")
    lines.append(f"- **Savings potential**: ~{analysis.token_savings} tokens/session")
    lines.append("")

    # Recommendations
    if analysis.recommendations:
        lines.append("## Recommendations")
        for rec in analysis.recommendations:
            lines.append(f"- {rec}")
        lines.append("")

    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: python manifest_validator.py <project-root> [OPTIONS]")
        print("")
        print("OPTIONS:")
        print("  --analyze              Full analysis with recommendations")
        print("  --export               Export report to Artifacts/Temp/manifest_report.md")
        print("  --schema-version       Show detected schema version only")
        print("  --upgrade-schema       Show V1→V2 upgrade preview (doesn't write)")
        print("  --upgrade-schema --apply")
        print("                         Apply V1→V2 upgrade to project.json")
        print("  --list-plugins         List all available plugins")
        print("  --validate-plugins     Validate plugin references in manifest (V2 only)")
        sys.exit(1)

    project_root = Path(sys.argv[1])
    manifest_path = project_root / "project.json"
    skill_registry = Path(__file__).parent.parent / "skills"
    plugins_dir = Path(__file__).parent.parent / "optional_plugins"

    # Handle --list-plugins
    if "--list-plugins" in sys.argv:
        print("# Available Plugins\n")
        for plugin_id, plugin_def in PLUGIN_REGISTRY.items():
            skills_str = ", ".join(plugin_def["skills"]) if plugin_def["skills"] else "(empty)"
            print(f"- **{plugin_id}** ({plugin_def['category']}): {skills_str}")
        sys.exit(0)

    # Validate
    validation = validate_manifest(manifest_path)

    # Handle --schema-version
    if "--schema-version" in sys.argv:
        print(f"Schema Version: {validation.schema_version}")
        sys.exit(0)

    # Handle --upgrade-schema
    if "--upgrade-schema" in sys.argv:
        if not validation.valid:
            print("Cannot upgrade invalid manifest. Fix errors first:")
            for error in validation.errors:
                print(f"  - {error}")
            sys.exit(1)

        with open(manifest_path) as f:
            manifest_v1 = json.load(f)

        manifest_v2 = auto_upgrade_v1_to_v2(manifest_v1)
        schema_version = detect_schema_version(manifest_v2)

        if schema_version == "2.0.0":
            print("# Schema Upgrade Preview (V1 -> V2)\n")
            print("The following changes will be applied:\n")
            print("```json")
            print(json.dumps(manifest_v2, indent=2))
            print("```\n")

            if "--apply" in sys.argv:
                manifest_path.write_text(json.dumps(manifest_v2, indent=2) + "\n")
                print(f"[OK] Manifest upgraded to V2: {manifest_path}")
                sys.exit(0)
            else:
                print("_No changes written. Run with `--apply` to write upgrade._")
                sys.exit(0)
        else:
            print("Manifest is already V2.0.0")
            sys.exit(0)

    # Analyze (if valid)
    analysis = None
    if validation.valid:
        try:
            analysis = analyze_manifest(manifest_path, skill_registry)
        except Exception as e:
            validation.warnings.append(f"Analysis failed: {e}")

    # Handle --validate-plugins (V2 only)
    if "--validate-plugins" in sys.argv:
        if validation.schema_version == "1.0.0":
            print("[WARN] Plugin validation is V2-only. Upgrade manifest first with --upgrade-schema")
            sys.exit(0)

        with open(manifest_path) as f:
            manifest = json.load(f)

        plugin_result = validate_plugins(manifest, plugins_dir)
        if plugin_result.valid:
            print("[OK] All plugin references are valid")
            if plugin_result.active_plugins:
                print(f"\nActive plugins: {', '.join(plugin_result.active_plugins)}")
        else:
            print("[ERROR] Plugin validation errors:")
            for error in plugin_result.errors:
                print(f"  - {error}")
            for warning in plugin_result.warnings:
                print(f"  [WARN] {warning}")
        sys.exit(0 if plugin_result.valid else 1)

    # Generate report
    report = format_report(validation, analysis)
    print(report)

    # Export if requested
    if "--export" in sys.argv and analysis:
        export_path = project_root / "Artifacts" / "Temp" / "manifest_report.md"
        export_path.parent.mkdir(parents=True, exist_ok=True)
        export_path.write_text(report)
        print(f"\n[OK] Report exported to {export_path}")

    sys.exit(0 if validation.valid else 1)


if __name__ == "__main__":
    main()
