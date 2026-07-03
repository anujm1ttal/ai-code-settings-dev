#!/usr/bin/env python3
"""
Manifest Validator & Analyzer

Validates project.json against the JSON schema and provides optimization recommendations.
Used by the /manifest command in the concierge workflow.
"""

import json
import sys
from pathlib import Path
from typing import TypedDict, Literal
from dataclasses import dataclass

# Project types
ProjectType = Literal["code", "geometry", "data", "pptx", "pbi-report", "youtube", "manuscript", "hybrid"]

# Default skills per project type
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

@dataclass
class ValidationResult:
    valid: bool
    errors: list[str]
    warnings: list[str]

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


def validate_manifest(manifest_path: Path) -> ValidationResult:
    """Validate manifest against schema."""
    errors, warnings = [], []

    # Check file exists
    if not manifest_path.exists():
        return ValidationResult(valid=False, errors=["project.json not found"], warnings=[])

    # Parse JSON
    try:
        with open(manifest_path) as f:
            manifest = json.load(f)
    except json.JSONDecodeError as e:
        return ValidationResult(valid=False, errors=[f"Invalid JSON: {e}"], warnings=[])

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

    return ValidationResult(valid=len(errors) == 0, errors=errors, warnings=warnings)


def analyze_manifest(manifest_path: Path, skill_registry_path: Path) -> AnalysisResult:
    """Analyze manifest and provide recommendations."""
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

    # Compute effective skills
    if auto_include:
        default = DEFAULT_SKILLS.get(project_type, []) + FOUNDATIONAL_SKILLS
        effective = (set(default) | set(active_skills)) - set(disabled_skills)
    else:
        effective = set(active_skills)

    effective_list = sorted(list(effective))

    # Find issues
    unused = [s for s in active_skills if s in DEFAULT_SKILLS.get(project_type, [])]
    missing = [s for s in (active_skills + disabled_skills) if s not in available_skills]

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
    )


def format_report(validation: ValidationResult, analysis: AnalysisResult | None = None) -> str:
    """Format a human-readable report."""
    lines = []

    # Header
    lines.append("# Manifest Report")
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
        print("Usage: python manifest_validator.py <project-root> [--analyze] [--export]")
        sys.exit(1)

    project_root = Path(sys.argv[1])
    manifest_path = project_root / "project.json"
    skill_registry = Path(__file__).parent.parent / "skills"

    # Validate
    validation = validate_manifest(manifest_path)

    # Analyze (if valid)
    analysis = None
    if validation.valid:
        try:
            analysis = analyze_manifest(manifest_path, skill_registry)
        except Exception as e:
            validation.warnings.append(f"Analysis failed: {e}")

    # Generate report
    report = format_report(validation, analysis)
    print(report)

    # Export if requested
    if "--export" in sys.argv and analysis:
        export_path = project_root / "Artifacts" / "Temp" / "manifest_report.md"
        export_path.parent.mkdir(parents=True, exist_ok=True)
        export_path.write_text(report)
        print(f"\n✅ Report exported to {export_path}")

    sys.exit(0 if validation.valid else 1)


if __name__ == "__main__":
    main()
