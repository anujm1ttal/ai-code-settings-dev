---
description: Technical review for code quality, domain compliance, and plan gate validation. Invokes the auditor. Supports --pre mode for plan review before implementation.
---

# Command: /audit

Invokes the **auditor** agent for cross-domain quality check against `coding-style.md` and domain skills.

> [!NOTE]
> The `/audit` command automatically skips virtual environments (`venv`, `.venv`, `env`) and build artifacts to ensure focus on project source code.

## Modes

### Default: Post-Implementation Review
1. **Detect domain** → equip skill per `orchestration.md` routing.
2. **Constraint Review**: Evaluate against Minimalism and Risks from `IMPLEMENTATION_PLAN.md`.
3. **Domain Scan**: Run checks per `coding-style.md` + relevant skill file.
4. **Generate Report**: Categorize findings by severity (CRITICAL / HIGH / MEDIUM).

### `/audit --pre`: Plan Review
1. Read target task from `TODO.md` + parent phase in `IMPLEMENTATION_PLAN.md`.
2. Validate success metric is numeric and verifiable.
3. Verify dependencies satisfied — no predecessors still `[ ]` or `[-]`.
4. Flag ambiguity that could cause scope creep.
5. Output **GO** / **NO-GO** with specific concerns.

## Domain Scans

All scan rules are defined in `coding-style.md`. Domain-specific additions:

- **Rhino/GH**: Data tree paths, C-Value thresholds (≥60mm general, ≥90mm premium), tolerance checks, geometry disposal.
- **TypeScript/MCP**: JSON-RPC compliance, Zod schemas, HitL for destructive tools, async error boundaries.
- **Power BI/DAX**: Star Schema integrity, no Fact calculated columns, VAR/RETURN, DIVIDE safety, iterator justification.
- **C#/GH Plugins**: IDisposable, NuGet hygiene, `dotnet build` clean.
- **Manuscript**: Structural integrity, character agency, pacing. Generates `EDITORIAL_LETTER.md`.
- **Python (all)**: PEP 8 via `ruff`, `pyright` types, anti-pattern sweep, `frozen=True` dataclasses, Loguru enforcement.

## Severity Levels

- **CRITICAL**: Security flaws, math errors, crashes, data corruption, unit mismatches, schema violations, missing IDisposable.
- **HIGH**: Performance gaps, missing error handling, calculated columns in Facts, functions >50 lines, passive protagonist (manuscript).
- **MEDIUM**: Naming deviations, missing Step 0 rationale, stale documentation.

## Report Format

> **[SEVERITY]** Issue Title
> - **Issue**: What's wrong
> - **Risk**: Impact if unaddressed
> - **Fix**: Specific remediation

## Integration
- Run after coder finishes a task, or before coder begins (`--pre`).
- Auditor is sole authority for `[x]` in `TODO.md` (see `orchestration.md`).