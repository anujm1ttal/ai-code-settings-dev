# Reference: DAX Patterns & Best Practices

This document defines the mandatory DAX authoring patterns for readability, safety, and logical consistency.

## 🖋 DAX Standards

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
