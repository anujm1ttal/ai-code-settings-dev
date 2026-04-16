# Changelog

All notable changes to the Agent OS Skill System will be documented in this file.

## [1.0.0] - 2026-04-15

### Added
- **Subagent Architecture**: Introduced `geometry-validator` specialized agent for high-rigor geometric verification.
- **Skill Versioning**: Applied `metadata.version: "1.0.0"` and `argument-hint` to all 20 skills.
- **Numbered Pipelines**: Implemented structured execution steps in flagship skills (Rhino, DAX, MCP).
- **Gated Reference Loading**: Moved heavy domain knowledge to `references/` directories (Pitfalls, Performance, Architecture) to optimize context window.
- **API Lookup Protocol**: Formulated mandatory `grep_search` patterns for XML documentation to eliminate hallucinations.

### Changed
- **Auditor Discipline**: Updated `auditor.md` to mandate delegation to `geometry-validator` for `Rhino.Geometry` tasks.
- **Refactored `python-rhino-grasshopper`**: Transitioned from monolithic `SKILL.md` to a modular reference system.
- **Standardized Frontmatter**: Unified YAML schema across all skills for improved routing and discovery.

### Fixed
- HALLUCINATION: Corrected common API pattern errors in Rhino and MCP domains through explicit Pitfalls documentation.
