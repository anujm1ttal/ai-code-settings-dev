---
name: xlsx
description: "Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user wants to: open, read, edit, or fix an existing .xlsx, .xlsm, .csv, or .tsv file (e.g., adding columns, computing formulas, formatting, charting, cleaning messy data); create a new spreadsheet from scratch or from other data sources; or convert between tabular file formats. Trigger especially when the user references a spreadsheet file by name or path — even casually (like \"the xlsx in my downloads\") — and wants something done to it or produced from it. Also trigger for cleaning or restructuring messy tabular data files (malformed rows, misplaced headers, junk data) into proper spreadsheets. The deliverable must be a spreadsheet file. Do NOT trigger when the primary deliverable is a Word document, HTML report, standalone Python script, database pipeline, or Google Sheets API integration, even if tabular data is involved."
license: Proprietary. LICENSE.txt has complete terms
---

# XLSX creation, editing, and analysis

## Deep-Load Protocol
Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/xlsx-standards.md` | Before applying formatting, color coding, or validating formula integrity |
| `references/python-guide.md` | Before writing Python code using pandas or openpyxl |

## Quick Reference

| Task | Approach |
|------|----------|
| Data analysis | Use `pandas` - see `references/python-guide.md` |
| Formatting/Formulas | Use `openpyxl` - see `references/python-guide.md` |
| Recalculate | Use `scripts/recalc.py` |

## Important Requirements

### Formula Standards
- **CRITICAL**: Use Excel formulas (e.g., `=SUM(A1:A10)`) instead of calculating values in Python and hardcoding them.
- **Standards**: Follow the color-coding and formatting standards in [xlsx-standards.md](references/xlsx-standards.md).

### Calculation & Validation
- **LibreOffice Required**: You can assume LibreOffice is installed for recalculating formula values using the `scripts/recalc.py` script.
- **Workflow**:
  1. Modify file (pandas/openpyxl).
  2. Save file.
  3. **MANDATORY**: Run `python scripts/recalc.py output.xlsx`.
  4. Fix any errors identified in the JSON output.

### Code Style
- Write minimal, concise Python code without unnecessary comments or print statements.
- Avoid verbose variable names and redundant operations.

**Primary Directive**: The spreadsheet must be dynamic. Never hardcode a value that can be a formula.