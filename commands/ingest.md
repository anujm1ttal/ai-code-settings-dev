---
description: Formalizes manual output from Rhino/GH, Power BI, or external code editors for AI analysis. Owned by the concierge agent. Bridges the gap between user-design and AI-logic.
---

# Command: /ingest

This command is owned by the **concierge** agent. It handles the intake of manual design work, ensuring that when you "throw something over the wall" from Rhino, Power BI, or an external editor, the AI knows exactly how to interpret, validate, and store it.

## ⚡ Execution Sequence

1. **Source Detection**: Identify the type of manual work being ingested:
   - **Geometry Export**: CSV, JSON, or TXT containing coordinates, panel logic, or sightline data from Rhino.
   - **DAX / SQL**: Measures, queries, or schema definitions from Power BI.
   - **Script Handoff**: GhPython, C#, or standalone Python scripts drafted outside the AI session.
   - **Config / Data**: Environment files, API responses, or test fixtures.
2. **Schema Validation**: Check that the export follows naming and structure rules defined in `IMPLEMENTATION_PLAN.md`.
   - File naming convention matches project standards.
   - Data format is parseable (valid JSON, well-formed CSV, syntactically correct code).
   - Required fields or columns are present.
3. **Logic Capture**: Extract code snippets or formulas and prepare them for the `auditor`:
   - Python/C# → Stage for `skill-python-patterns.md` or `skill-csharp-grasshopper.md` review.
   - DAX → Stage for `skill-dax-modeling.md` review (VAR/RETURN, DIVIDE safety, no Fact calculated columns).
   - Geometry data → Stage for `skill-python-rhino.md` review (tolerances, units, C-Value thresholds).
4. **Metadata Tagging**: Record ingestion context:
   - **Timestamp**: When the work was ingested.
   - **Source**: Tool of origin (Rhino, Power BI, VS Code, manual).
   - **Version**: Iteration number or git ref if available.
   - **Step 0 Link**: Which `IMPLEMENTATION_PLAN.md` task or phase this serves.
5. **TODO.md Proposal**: Flag the corresponding task for `auditor` approval. Do NOT mark `[x]` directly.
6. **Route Next Agent**: Based on what was ingested:
   - Code that needs refactoring → brief the `coder`.
   - Code that is implementation-complete → brief the `auditor` for review.
   - Work that changes architecture → brief the `strategist` for plan evaluation.
   - Work that needs documentation → brief the `scribe`.

## ✅ Validation Rules

### Pass
- File is parseable and structurally sound.
- Naming matches project conventions.
- A corresponding task exists in `TODO.md`.
- Step 0 rationale is identifiable.

### Fail (Soft)
- File is parseable but naming deviates from conventions.
- No matching `TODO.md` task found — flag as potential **drift** for the `strategist`.
- **Action**: Ingest proceeds with a warning. The `auditor` is notified.

### Fail (Hard)
- File is malformed, unparseable, or corrupt.
- File contains hardcoded secrets, API keys, or local system paths.
- **Action**: Ingest is blocked. User is notified with the specific failure reason.

## 📋 Ingestion Report Format

### Ingestion Report
- **Source**: [Tool / File type] ([filename])
- **Status**: [Pass / Soft Fail / Hard Fail]
- **Validation**: [Details on what passed or failed]
- **TODO Link**: [Matching TODO.md task, or "DRIFT — no matching task"]
- **Staged For**: [auditor / coder / strategist / scribe]
- **Next Step**: [What happens next and which agent handles it]

## 🔗 When to Use

Use `/ingest` when:
- **Geometry Export**: You've exported seating coordinates or panel logic from Rhino.
- **DAX Refinement**: You've written a complex measure in Power BI and want the AI to document or optimize it.
- **Script Handoff**: You've drafted a GhPython or C# component and need the `coder` to refactor it.
- **External Edit**: You've modified project files in an external editor while the AI session was closed.
- **Data Import**: You're introducing test fixtures, API response samples, or config files into the project.

## 💬 Example Usage

> **User**: I've finished the sightline Python script in GH. /ingest
>
> **Concierge**:
> ### Ingestion Report
> - **Source**: GhPython Script (sightline_logic.py)
> - **Status**: Pass
> - **Validation**: Syntactically valid. Uses RhinoCommon. C-Value formula present.
> - **TODO Link**: Phase 1, Task 3 — "Implement sightline calculation"
> - **Staged For**: auditor (code review against skill-python-rhino.md)
> - **Next Step**: Auditor will validate tolerances and data tree structure.

> **User**: I built a new DAX measure for premium seat revenue. /ingest
>
> **Concierge**:
> ### Ingestion Report
> - **Source**: DAX Measure (premium_seat_revenue.dax)
> - **Status**: Soft Fail — no matching TODO.md task
> - **Validation**: VAR/RETURN pattern ✅. DIVIDE safety ✅. No Fact calculated columns ✅.
> - **TODO Link**: DRIFT — flagged for strategist evaluation.
> - **Staged For**: strategist (evaluate if this belongs in the roadmap)
> - **Next Step**: Strategist will decide whether to add this to IMPLEMENTATION_PLAN.md.