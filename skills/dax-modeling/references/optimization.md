# DAX Performance & Optimization

> Load this on-demand when diagnosing slow reports, large model sizes, or complex iterator performance.

## 🏎 Storage Mode Best Practices

- **Import Mode (Default)**: Best for performance. Ensure "Auto Date/Time" is DISABLED globally.
- **DirectQuery**: Only for real-time needs. Avoid modeling complex logic in DAX here; push to SQL views.
- **Dual Mode**: Use for dimension tables that bridge Import and DirectQuery fact tables.

## 📐 Cardinality & Model Size

Memory is consumed by column cardinality.
- **Timestamp Rounding**: Round to hour or day. Seconds/Milliseconds bloat size by 100x.
- **Unused Columns**: Remove keys that aren't used for relationships and columns not used in visuals.
- **Measure vs Column**: Never use Calculated Columns in Fact tables. Use measures + `VAR/RETURN`.

## 🧵 Iterator Performance (SUMX, FILTER)

Iterators scan tables row-by-row.
- **Narrow the Scope**: Always filter the table *before* iterating.
```dax
-- BAD: Iterates full FactSales
Result = SUMX(FactSales, [Price] * [Qty])

-- GOOD: Iterates only relevant subset
Result = 
VAR SubTable = FILTER(FactSales, [Year] = 2026)
RETURN SUMX(SubTable, [Price] * [Qty])
```
- **KEEPFILTERS**: Use to preserve existing filter context inside a `CALCULATE(FILTER(...))`.

## 🧪 Profiling Tools
- **DAX Studio**: Use "Server Timings" to find the bottleneck (Formula Engine vs. Storage Engine).
- **VertiPaq Analyzer**: Use to identify the heaviest columns in the model.
