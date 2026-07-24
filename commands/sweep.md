---
description: Codebase-wide discovery for tech debt, redundancy, deprecations, and missing docs. Orchestrated by the strategist.
argument-hint: "[--registry] [scope]"
model: claude-opus-5
---

# Command: /sweep

**Target**: `$ARGUMENTS` → optional `--registry` flag + optional `[scope]`.

Invokes the **strategist** agent (or acts as an orchestrator) to coordinate a multi-agent deep dive into the codebase. The purpose is to map out tech debt, identify unused or highly redundant logic, and surface missing documentation, resulting in a roadmap for cleanup.

## The Sweep Workflow

The strategist spawns a parallel team of agents to figure out the project from different aspects:

1. **Phase 0 — Registry Integrity (Optional: `--registry`)**:
   - Invokes `/registry-audit` to ensure the Agent OS infrastructure is sound before analyzing the local codebase.
   - Checks for broken skill/command references and `PROJECT_TYPE` drift.

2. **Phase 1 — Architectural Scan (Strategist)**: 
   - Analyzes overall architecture for deprecated dependencies, outdated patterns, and unused modules.
   - Ensures the codebase structure still aligns with `Artifacts/ARCH.md`.

2. **Phase 2 — Redundancy Hunting (Coder)**:
   - Scans for duplicated code blocks, unused variables, dead logic, and unnecessarily complex functions.
   - Cross-references implementations with existing standard patterns in `rules/common/coding-style.md`.

3. **Phase 3 — Documentation Audit (Scribe)**:
   - Hunts for completely missing docstrings, stale README files, out-of-sync comments, and undocumented entry points.

4. **Phase 4 — Roadmap Generation (Strategist / Auditor)**:
   - The strategist and auditor aggregate the findings from all phases.
   - Findings are detailed in a new artifact: `Artifacts/SWEEP_REPORT.md` (similar to the Audit Report format).
   - Atomic refactoring and documentation tasks are appended to `Artifacts/TODO.md`.

## Output Constraints

- All findings must reference specific files and line numbers.
- `Artifacts/SWEEP_REPORT.md` must be written to the project root's `Artifacts/` directory.
- `Artifacts/TODO.md` updates must respect the single-source authority rules laid out in `orchestration.md`.
