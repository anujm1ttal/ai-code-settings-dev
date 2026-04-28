---
name: dax-modeling
description: Power BI data modeling, DAX authoring, and performance optimization. Star Schema enforcement and measure validation for the coder and auditor agents.
tags: ["dax", "power-bi", "data-modeling", "star-schema", "analytics", "business-intelligence"]
auto_activate: false
argument-hint: "<DAX measure requirement or modeling question>"
metadata:
  version: "1.0.1"
verbosity_control: "CONCISE. Use VAR/RETURN patterns in all examples. Avoid explaining basic BI concepts."
---

# Skill: DAX & Power BI Modeling

## Deep-Load Protocol
Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/measure-catalog.md` | When viewing existing measures or documenting new ones |
| `references/optimization.md` | When performance issues are reported or object count > 1M rows |


## 📊 Modeling Standards

### Star Schema (Mandatory)
- **Relationships**: Enforce 1:Many from Dimension to Fact. No Fact-to-Fact bridging.
- **Directionality**: Unidirectional filters only (Dim → Fact) unless solving a specific M2M bridge with a documented rationale.
- **Bridge Tables**: When M2M is unavoidable, use a dedicated bridge table with clear documentation of filter propagation behavior.
- **Naming Convention**:
  - Dimension tables: `Dim` prefix (`DimDate`, `DimSection`).
  - Fact tables: `Fact` prefix (`FactTicketSales`, `FactSightlineResults`).
  - Bridge tables: `Bridge` prefix (`BridgeEventSection`).
  - *Note: Standardize on CamelCase (no underscores). If working with a legacy model using underscores (e.g., `Dim_Date`), maintain the existing pattern but flag for the strategist during `/sweep`.*

### Date Table
- Disable Auto Date/Time globally in Power BI options.
- Use a dedicated `DimDate` table with:
  - Continuous date range covering all Fact table date ranges.
  - Standard columns: `Date`, `Year`, `Quarter`, `Month`, `MonthName`, `WeekOfYear`, `DayOfWeek`, `IsWeekend`.
  - Domain-specific columns: `IsEventDay`, `SeasonPeriod`, `MatchDay` for stadium analytics.
- Mark as Date Table in the model.

### Table Configuration
- **Sort columns**: Provide explicit sort-by columns for non-alphabetical ordering (e.g., `MonthName` sorted by `MonthNumber`).
- **Display folders**: Group related measures into display folders for end-user discoverability.
- **Hidden columns**: Hide all foreign key columns from the report view. Users should never interact with raw keys.

## 🖋 DAX Patterns

### Readability
- **VAR/RETURN**: Mandatory for all measures. No inline expressions.
- **Indentation**: Align `VAR` and `RETURN` at the same level. Indent function arguments.
- **Line breaks**: One condition per line in `SWITCH(TRUE())` and `FILTER` expressions.

### Safety
- **Division**: `DIVIDE(numerator, denominator, 0)` — never raw `/` operator.
- **Blank handling**: Use `IF(ISBLANK(value), fallback, value)` at measure entry points.
- **Empty tables**: Guard `CALCULATE` with `HASONEVALUE()` or `ISFILTERED()` when the measure depends on specific filter context.

### Logic
- **Branching**: `SWITCH(TRUE(), condition1, result1, condition2, result2, default)` over nested `IF`.
- **Context Transition**: Use `CALCULATE()` explicitly for row-to-filter context transition. Never rely on implicit behavior.
- **Time Intelligence**: Use standard DAX time intelligence functions (`SAMEPERIODLASTYEAR`, `DATESINPERIOD`) with the dedicated `DimDate` table. Never roll custom date logic unless the standard functions don't cover the use case.

### Common Measure Patterns

#### Base Measures
Every Fact table should have a set of foundational measures before building complex analytics:
- `Total [Metric]` — Simple aggregation (`SUM`, `COUNT`, `DISTINCTCOUNT`).
- `Avg [Metric]` — `AVERAGE` or `DIVIDE(SUM, COUNT)` with safety.
- `[Metric] YoY %` — Year-over-year using `SAMEPERIODLASTYEAR`.

#### Stadium-Specific Patterns
- **Seat Utilization**: `DIVIDE(SUM(FactTicketSales[SeatsSold]), SUM(DimSection[TotalCapacity]), 0)`.
- **Sightline Compliance**: `DIVIDE(COUNTROWS(FILTER(FactSightlines, FactSightlines[CValue] >= [MinCValue])), COUNTROWS(FactSightlines), 0)`.
- **Revenue per Seat**: `DIVIDE(SUM(FactTicketSales[Revenue]), DISTINCTCOUNT(FactTicketSales[SeatID]), 0)`.

## 🏎 Optimization

### Calculated Columns
- **Strictly forbidden in Fact tables**. Offload all calculated columns to Power Query (M).
- Acceptable in Dimension tables only for:
  - Binning / bucketing that Power Query cannot handle dynamically.
  - Concatenated display labels.
- If you think you need a calculated column in a Fact table, it should be a measure instead.

### Iterators
- Minimize use of `SUMX`, `AVERAGEX`, `FILTER`, and `ADDCOLUMNS` over large Fact tables.
- If an iterator is required:
  - Filter the table down to the smallest possible subset first.
  - Use `KEEPFILTERS` to prevent unintended context override.
  - Document the expected row count and performance impact.
- Prefer `CALCULATE` + `FILTER` over `CALCULATETABLE` when only a scalar result is needed.

### Storage Mode
- Use Import mode for Fact tables (performance).
- Consider DirectQuery for real-time Dimension tables only when freshness requirements justify the latency trade-off.
- Dual mode for bridge tables in composite models.

### Model Size
- Remove unused columns from the model. Every column consumes memory.
- Reduce cardinality where possible (round timestamps to the hour, bucket continuous values).
- Disable Auto Date/Time (repeated — this alone can halve model size).

## 🧪 Validation & Testing

### Measure Validation
Before the `auditor` approves a DAX measure:
- [ ] Uses `VAR/RETURN` pattern.
- [ ] Uses `DIVIDE()` for all division (no raw `/`).
- [ ] Uses `SWITCH(TRUE())` over nested `IF` (when applicable).
- [ ] Handles `BLANK()` and empty filter context gracefully.
- [ ] No calculated columns in Fact tables.
- [ ] Time intelligence uses `DimDate`, not Auto Date/Time.
- [ ] Context transition via `CALCULATE()` is explicit, not implicit.

### Model Validation
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

## 📋 Documentation Standards

Every DAX measure must be documented in a **Measure Catalog** (maintained by the `scribe`):

| Field | Description |
| :--- | :--- |
| **Measure Name** | Display name as it appears in the model |
| **Purpose** | One sentence — what business question does this answer? |
| **Dependencies** | Which tables and columns does this measure reference? |
| **Formula** | The full DAX expression |
| **Example Output** | Sample result with context (e.g., "Section A, Q1 2026: 87.3%") |
| **Performance Notes** | Iterator usage, expected row count, known limitations |

## 🚫 Anti-Patterns (Explicit Deny List)
- No raw `/` division — always `DIVIDE()`.
- No nested `IF` beyond 2 levels — use `SWITCH(TRUE())`.
- No calculated columns in Fact tables — use Power Query or measures.
- No Auto Date/Time — use `DimDate`.
- No Fact-to-Fact relationships — introduce a shared Dimension or Bridge.
- No implicit context transition — always use `CALCULATE()` explicitly.
- No measures without `VAR/RETURN` structure.
- No undocumented iterators on large tables.
- No `ALL()` without understanding the full filter context impact — prefer `REMOVEFILTERS()` for clarity.
- No hardcoded date values in measures — use `DimDate` relationships and time intelligence functions.

## 🔨 Preferred Toolchain
- **Development**: Power BI Desktop + DAX Studio for query testing.
- **Performance**: DAX Studio `Server Timings` + `VertiPaq Analyzer` for model profiling.
- **Version Control**: Export measures as `.dax` text files in the project repo. One file per measure or logical group.
- **Documentation**: Measure Catalog maintained by the `scribe` via `/docs --reference`.