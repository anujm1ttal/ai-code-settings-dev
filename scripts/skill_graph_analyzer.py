#!/usr/bin/env python3
"""
Skill Dependency Graph Analyzer

Analyzes skill relationships based on:
- Tags (which skills share common domains)
- Project type associations (which skills are defaults)
- Cross-references in descriptions
"""

import json
import sys
from pathlib import Path
import io

# Force UTF-8 output
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', newline='')
from typing import TypedDict
from dataclasses import dataclass, field
from collections import defaultdict
import re

ProjectType = str  # code, geometry, data, pptx, pbi-report, youtube, manuscript, hybrid


@dataclass
class SkillNode:
    """Represents a single skill in the graph."""
    name: str
    tags: list[str]
    description: str
    project_types: list[ProjectType] = field(default_factory=list)
    connections: dict[str, int] = field(default_factory=dict)  # skill_name -> strength


@dataclass
class GraphAnalysis:
    """Analysis results for the skill dependency graph."""
    skills: dict[str, SkillNode]
    project_affinities: dict[ProjectType, list[tuple[str, int]]]  # skill -> co-occurrence count
    tag_clusters: dict[str, list[str]]  # tag -> [skills]
    singletons: list[str]  # skills used in only 1 project type
    universal_skills: list[str]  # skills used in 3+ project types
    recommendations: list[str] = field(default_factory=list)


def load_skills(skills_dir: Path) -> dict[str, SkillNode]:
    """Load all skills and extract metadata."""
    skills = {}

    for skill_dir in skills_dir.iterdir():
        if not skill_dir.is_dir():
            continue

        skill_file = skill_dir / "SKILL.md"
        if not skill_file.exists():
            continue

        with open(skill_file, encoding="utf-8") as f:
            content = f.read()

        # Parse YAML frontmatter
        if content.startswith("---"):
            _, frontmatter, _ = content.split("---", 2)
            lines = frontmatter.strip().split("\n")

            name = None
            description = ""
            tags = []

            for line in lines:
                if line.startswith("name:"):
                    name = line.split(":", 1)[1].strip().strip("'\"")
                elif line.startswith("description:"):
                    description = line.split(":", 1)[1].strip().strip("'\"")
                elif line.startswith("tags:"):
                    tag_str = line.split(":", 1)[1].strip()
                    tags = re.findall(r"[\w\-]+", tag_str)

            if name:
                skills[name] = SkillNode(
                    name=name,
                    tags=tags,
                    description=description,
                )

    return skills


def analyze_default_skills(manifest_schema: Path, skills: dict[str, SkillNode]) -> None:
    """Load DEFAULT_SKILLS from manifest_validator and assign project affinities."""
    validator_path = Path(__file__).parent / "manifest_validator.py"
    if not validator_path.exists():
        return

    with open(validator_path, encoding="utf-8") as f:
        content = f.read()

    # Extract FOUNDATIONAL_SKILLS
    foundational_match = re.search(r'FOUNDATIONAL_SKILLS\s*=\s*\[(.*?)\]', content, re.DOTALL)
    foundational = []
    if foundational_match:
        foundational = re.findall(r'"([\w\-]+)"', foundational_match.group(1))
        # Mark all foundational skills as universal (add to all project types)
        for skill_name in foundational:
            if skill_name in skills:
                for ptype in ["youtube", "pptx", "pbi-report", "geometry", "code", "manuscript", "data", "hybrid"]:
                    if ptype not in skills[skill_name].project_types:
                        skills[skill_name].project_types.append(ptype)

    # Extract DEFAULT_SKILLS dict
    match = re.search(r"DEFAULT_SKILLS[:\s]*dict\[.*?\]\s*=\s*\{(.*?)\n\}", content, re.DOTALL)
    if not match:
        return

    defaults_text = match.group(1)

    # Parse project type -> skills
    for project_type in ["youtube", "pptx", "pbi-report", "geometry", "code", "manuscript", "data", "hybrid"]:
        pattern = rf'"{project_type}"\s*:\s*\[(.*?)\]'
        match = re.search(pattern, defaults_text, re.DOTALL)
        if match:
            skill_list = re.findall(r'"([\w\-]+)"', match.group(1))
            for skill_name in skill_list:
                if skill_name in skills:
                    if project_type not in skills[skill_name].project_types:
                        skills[skill_name].project_types.append(project_type)


def build_connections(skills: dict[str, SkillNode]) -> None:
    """Build skill-to-skill connections based on tags and project affinities."""
    skill_list = list(skills.keys())

    for i, skill_a in enumerate(skill_list):
        for skill_b in skill_list[i + 1 :]:
            strength = 0

            # Shared tags → +2 strength
            shared_tags = set(skills[skill_a].tags) & set(skills[skill_b].tags)
            strength += len(shared_tags) * 2

            # Shared project types → +3 strength
            shared_projects = set(skills[skill_a].project_types) & set(skills[skill_b].project_types)
            strength += len(shared_projects) * 3

            # Cross-reference in description → +1 strength
            if skill_b in skills[skill_a].description.lower():
                strength += 1
            if skill_a in skills[skill_b].description.lower():
                strength += 1

            if strength > 0:
                skills[skill_a].connections[skill_b] = strength
                skills[skill_b].connections[skill_a] = strength


def analyze_graph(skills: dict[str, SkillNode]) -> GraphAnalysis:
    """Analyze the graph and extract patterns."""
    # Tag clusters
    tag_clusters: dict[str, list[str]] = defaultdict(list)
    for name, skill in skills.items():
        for tag in skill.tags:
            tag_clusters[tag].append(name)

    # Project affinities
    project_affinities: dict[ProjectType, list[tuple[str, int]]] = defaultdict(lambda: defaultdict(int))
    for name, skill in skills.items():
        for project_type in skill.project_types:
            project_affinities[project_type][name] = 1

    # Singletons (used in only 1 project type)
    singletons = [name for name, skill in skills.items() if len(skill.project_types) == 1]

    # Universal skills (used in 3+ project types)
    universal = [name for name, skill in skills.items() if len(skill.project_types) >= 3]

    # Recommendations
    recommendations = []
    if singletons:
        recommendations.append(f"Consider bundling {len(singletons)} singleton skills into optional archives")
    if len(tag_clusters) > 15:
        recommendations.append(f"High tag diversity ({len(tag_clusters)} tags) — consider consolidation")
    if universal:
        recommendations.append(f"{len(universal)} universal skills found — consider preloading for all projects")

    return GraphAnalysis(
        skills=skills,
        project_affinities=dict(project_affinities),
        tag_clusters=dict(tag_clusters),
        singletons=singletons,
        universal_skills=universal,
        recommendations=recommendations,
    )


def format_graph_report(analysis: GraphAnalysis) -> str:
    """Format a human-readable graph report."""
    lines = []

    lines.append("# Skill Dependency Graph")
    lines.append("")

    # Overview
    lines.append(f"**Total Skills**: {len(analysis.skills)}")
    lines.append(f"**Tag Clusters**: {len(analysis.tag_clusters)}")
    lines.append(f"**Universal Skills**: {len(analysis.universal_skills)}")
    lines.append(f"**Singletons**: {len(analysis.singletons)}")
    lines.append("")

    # Tag clusters
    lines.append("## Skill Clusters (by Tag)")
    for tag in sorted(analysis.tag_clusters.keys()):
        skill_list = analysis.tag_clusters[tag]
        lines.append(f"- **{tag}** ({len(skill_list)}): {', '.join(sorted(skill_list))}")
    lines.append("")

    # Project affinities
    lines.append("## Project Type Affinities")
    for project_type in sorted(analysis.project_affinities.keys()):
        skills = analysis.project_affinities[project_type]
        count = len(skills) if isinstance(skills, dict) else len(skills)
        lines.append(f"- **{project_type}** ({count} skills)")
    lines.append("")

    # Universal skills
    if analysis.universal_skills:
        lines.append("## Universal Skills (3+ project types)")
        for skill in sorted(analysis.universal_skills):
            types = ", ".join(sorted(analysis.skills[skill].project_types))
            lines.append(f"- `{skill}` ({types})")
        lines.append("")

    # Singletons
    if analysis.singletons:
        lines.append("## Singleton Skills (1 project type only)")
        for skill in sorted(analysis.singletons):
            project = analysis.skills[skill].project_types[0]
            lines.append(f"- `{skill}` ({project})")
        lines.append("")

    # Top connections
    lines.append("## Strongest Skill Pairs")
    all_connections = []
    seen = set()
    for skill_a, node in analysis.skills.items():
        for skill_b, strength in node.connections.items():
            pair = tuple(sorted([skill_a, skill_b]))
            if pair not in seen:
                all_connections.append((strength, pair))
                seen.add(pair)

    all_connections.sort(reverse=True)
    for strength, (skill_a, skill_b) in all_connections[:10]:
        lines.append(f"- `{skill_a}` ↔ `{skill_b}` (strength: {strength})")
    lines.append("")

    # Recommendations
    if analysis.recommendations:
        lines.append("## Recommendations")
        for rec in analysis.recommendations:
            lines.append(f"- {rec}")
        lines.append("")

    return "\n".join(lines)


def format_ascii_graph(analysis: GraphAnalysis) -> str:
    """Generate ASCII dependency visualization."""
    lines = []
    lines.append("```")
    lines.append("SKILL DEPENDENCY GRAPH")
    lines.append("")

    # Simple hierarchical view
    for project_type in sorted(analysis.project_affinities.keys()):
        lines.append(f"[{project_type.upper()}]")
        skills = analysis.project_affinities[project_type]
        skill_names = sorted(skills.keys() if isinstance(skills, dict) else skills)
        for skill in skill_names:
            # Mark universal skills with ★
            marker = "★" if skill in analysis.universal_skills else "•"
            lines.append(f"  {marker} {skill}")
        lines.append("")

    lines.append("```")
    lines.append("")
    lines.append("Legend: ★ = Universal (3+ projects) | • = Specialized")

    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: python skill_graph_analyzer.py <ai-code-settings-root> [--export]")
        sys.exit(1)

    root = Path(sys.argv[1])
    skills_dir = root / "skills"

    if not skills_dir.exists():
        print(f"Error: skills directory not found at {skills_dir}")
        sys.exit(1)

    # Load and analyze
    skills = load_skills(skills_dir)
    analyze_default_skills(root / "templates" / "project.schema.json", skills)
    build_connections(skills)
    analysis = analyze_graph(skills)

    # Generate reports
    report = format_graph_report(analysis)
    ascii_graph = format_ascii_graph(analysis)

    print(report)
    print(ascii_graph)

    # Export if requested
    if "--export" in sys.argv:
        export_dir = root / "Artifacts" / "Temp"
        export_dir.mkdir(parents=True, exist_ok=True)

        report_path = export_dir / "skill_graph_report.md"
        report_path.write_text(report + "\n" + ascii_graph, encoding="utf-8")
        print(f"\n✅ Graph exported to {report_path}")

    sys.exit(0)


if __name__ == "__main__":
    main()
