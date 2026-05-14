# Reference: Validation & Testing for Power BI

This document defines the audit gates and verification protocols for data models and DAX measures.

## 🧪 Validation Gates

### Measure Validation (Auditor Checklist)
Before the `auditor` approves a DAX measure:
- [ ] Uses `VAR/RETURN` pattern.
- [ ] Uses `DIVIDE()` for all division (no raw `/`).
- [ ] Uses `SWITCH(TRUE())` over nested `IF` (when applicable).
- [ ] Handles `BLANK()` and empty filter context gracefully.
- [ ] No calculated columns in Fact tables.
- [ ] Time intelligence uses `DimDate`, not Auto Date/Time.
- [ ] Context transition via `CALCULATE()` is explicit, not implicit.

### Model Validation (Auditor Checklist)
Before the `auditor` approves a model change:
- [ ] Star Schema integrity maintained (1:Many, Dim → Fact).
- [ ] No Fact-to-Fact relationships.
- [ ] No circular dependencies.
- [ ] All foreign key columns hidden from report view.
- [ ] Sort-by columns defined for non-alphabetical fields.
- [ ] Unused columns removed.
- [ ] `DimDate` marked as Date Table.

### Performance Validation
- [ ] No iterators (`SUMX`, `FILTER`) on Fact tables with >1M rows without documented justification.
- [ ] No calculated columns in Fact tables.
- [ ] Model refresh time is within the project's success metric threshold.
- [ ] DAX Studio `Server Timings` show no single query exceeding the latency target.

### Testing Approach
Since Power BI doesn't support automated unit tests natively:
- **Manual Verification Matrix**: For each measure, define a set of known-input → expected-output pairs.
- **Cross-Validation**: Compare measure results against source data queries (SQL) for at least 3 representative scenarios.
- **Edge Cases**: Test measures with:
  - Empty filter context (no selections).
  - Single-row filter context.
  - Date ranges that span year boundaries.
  - Sections with zero capacity or zero sales (division safety).
