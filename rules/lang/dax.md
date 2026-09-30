---
name: dax-rules
description: DAX/Power BI implementation and security floor. Loads only when a .dax/.tmdl/.bim/.pbip file is touched.
paths: ["**/*.dax", "**/*.tmdl", "**/*.bim", "**/*.pbip"]
---

# DAX / Power BI

## Language-Specific

- **DAX**: `VAR` for every intermediate, `DIVIDE` never raw `/`, `SWITCH(TRUE(), ...)` over
  nested `IF`, no calculated columns in Fact tables (offload to Power Query). Star schema, no
  Fact-to-Fact relationships, disable Auto Date/Time (dedicated `DimDate`), measures over
  calculated columns always. Full reference: `dax-modeling`.

## Security Floor

- **DAX/Power BI**: RLS on every multi-tenant model. Never embed connection strings in `.pbix`.
  Privacy level explicit, default `Private`. Disable data export on PII/sensitive metrics.
