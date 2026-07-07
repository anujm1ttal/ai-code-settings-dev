---
description: Formalizes manual output from Rhino/GH, Power BI, or external editors for AI analysis. Owned by the concierge. Bridges user-design and AI-logic.
argument-hint: "<source-file-or-type>"
model: claude-haiku-4-5
---

# Command: /ingest

**Target**: `$ARGUMENTS` → `<source-file-or-type>`.

Owned by the **concierge**. Intake of manual design work for validation and routing.

## Execution Sequence

1. **Source Detection**: Geometry export (CSV/JSON/TXT) | DAX/SQL | Script handoff (GhPython/C#/Python) | Config/data files.
2. **Schema Validation**: Check naming + structure rules from `Artifacts/IMPLEMENTATION_PLAN.md`. Verify parseable format + required fields.
3. **Logic Capture**: Stage code for auditor review with the relevant skill file.
4. **Metadata Tag**: Timestamp, source tool, version/git ref, linked Artifacts/IMPLEMENTATION_PLAN.md task.
5. **Artifacts/TODO.md Proposal**: Flag for auditor. Do NOT mark `[x]`.
6. **Route Next Agent**: Needs refactoring → coder. Implementation-complete → auditor. Architecture change → strategist. Needs docs → scribe.

## Validation

- **Pass**: Parseable, naming matches conventions, matching Artifacts/TODO.md task exists.
- **Soft Fail**: Parseable but naming deviates OR no matching Artifacts/TODO.md task (flagged as **DRIFT** for strategist). Ingest proceeds with warning.
- **Hard Fail**: Malformed/unparseable, contains hardcoded secrets or local system paths. Ingest blocked.

## Ingestion Report Format

- **Source**: Tool / file type (filename)
- **Status**: Pass / Soft Fail / Hard Fail
- **Validation**: What passed or failed
- **TODO Link**: Matching task or "DRIFT — no matching task"
- **Staged For**: auditor / coder / strategist / scribe
- **Next Step**: Action and responsible agent

## When to Use
After exporting from Rhino/PBI, drafting scripts externally, modifying files outside the AI session, or introducing test fixtures/config.