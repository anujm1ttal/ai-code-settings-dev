# Page Layout Patterns

## 📄 Page Archetypes

| Archetype | Structure | Use For |
|:---|:---|:---|
| **Executive Overview** | 4–6 KPI cards top row, 2 charts below | Landing page, summary |
| **Trend Analysis** | Filter bar top, full-width line chart, detail table below | Time-series exploration |
| **Comparison** | Side-by-side charts, shared axis or slicer | Segment vs. segment |
| **Detail / Drill-Through** | Minimal filters, dense table or matrix | Row-level lookup |
| **KPI Monitor** | Card grid (2×3 or 2×4), conditional formatting | Operational dashboards |
| **Driver Analysis** | Waterfall or decomposition tree, supporting bar chart | Root cause, variance |

## Grid & Spacing
- Use a 12-column conceptual grid. Snap all visuals to column boundaries.
- Standard page size: 16:9 (1280×720). Set explicitly — never use auto.
- Margins: 16px from page edges. 8px gaps between visuals.
- Visual heights: use consistent multiples (180px, 360px, 540px).
- Top 60–80px reserved for page title + top-level slicers.

## Page Count Guidelines
- Target 3–7 pages per report. More than 10 → split into multiple reports or use bookmarks.
- Every page has a defined purpose documented in `Artifacts/LAYOUT_SPEC.md`.
- Navigation: use buttons or bookmarks for non-linear reports. Tab strip for linear.
