---
name: dax-modeling
description: Use this skill whenever you are designing data models, authoring DAX measures, or optimizing performance in Power BI. It enforces a "Star Schema" architecture, mandatory VAR/RETURN patterns, and strict division safety (DIVIDE). Trigger when creating a new metric, fixing a circular dependency, or optimizing a slow report page. Do NOT use for front-end visual styling (theme JSON); use powerbi-report for visual layout and formatting tasks.
argument-hint: "<DAX measure requirement or modeling question>"
metadata:
  version: "1.0.1"
  tags: ["dax", "power-bi", "data-modeling", "star-schema", "analytics", "business-intelligence"]
  verbosity_control: "CONCISE. Use VAR/RETURN patterns in all examples. Avoid explaining basic BI concepts."
---

# Skill: DAX & Power BI Modeling

## Deep-Load Protocol
Load reference files ONLY when the following conditions are met:

| File | Load When |
|:---|:---|
| `references/dax-patterns.md` | Before authoring or refactoring ANY DAX measure |
| `references/measure-catalog.md` | When viewing existing measures or documenting new ones |
| `references/optimization.md` | When performance issues are reported or object count > 1M rows |
| `references/validation.md` | Before final audit and sign-off on model changes |


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
Consult [dax-patterns.md](references/dax-patterns.md) for mandatory VAR/RETURN, safety, and time intelligence standards.

## 🏎 Optimization
Consult [optimization.md](references/optimization.md) for iterator safety, model size reduction, and storage mode selection.

## 🧪 Validation & Testing
Consult [validation.md](references/validation.md) for the auditor checklist and manual verification protocols.

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