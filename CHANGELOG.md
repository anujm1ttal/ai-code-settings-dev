# Changelog

All notable changes to the Agent OS Skill System will be documented in this file.

## [Unreleased] - 2026-07-06

### Added
- **CLAUDE.md standard**: `rules/common/claude-md-standards.md` — canonical quality bar (global-vs-project content split, 6 scored dimensions, 6 anti-patterns, size caps).
- **`CLAUDE-global.md`**: the deployable global instructions, split out from the repo's own `CLAUDE.md`. `deploy.sh` now deploys this file to `~/.claude/CLAUDE.md`.
- **`/claude-md` command**: on-demand audit/update of a CLAUDE.md against the standard (thin wrapper over the installed `claude-md-improver` plugin; report-first).
- **`templates/CLAUDE.md.template`**: starter skeleton for new project CLAUDE.md files.

### Changed
- **Repo `CLAUDE.md` slimmed** (195 → 65 lines) to repo-specific maintenance guidance; global OS content now lives in `CLAUDE-global.md`.
- **`deploy.sh` now deploys `commands/`** (previously hand-synced, which had drifted).

### Fixed
- **`deploy.sh` repaired**: it referenced three files removed in the OSA-2 manifest retirement (`test_manifest_validator_v2.py`, `manifest_validator.py`, `plugin_manifest_schema.json`), leaving it unrunnable since that phase.

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
