---
name: powerbi-report
description: Power BI front-end patterns — theme JSON, visual selection, page layout, formatting, interactions, mobile, performance, and conditional formatting. Reference for Creative Director, Auditor, and Coder agents.
tags: ["powerbi", "visualization", "dashboard", "reporting"]
globs: ["*.pbip", "*.Report/**", "theme*.json", "LAYOUT_SPEC.md"]
verbosity_control: "TECHNICAL. Prioritize JSON blocks and tables over prose. Bullet-driven rules."
---

# Skill: Power BI Report Patterns

## 📐 Core Principles
- **Theme-Driven**: All styling flows from a theme JSON file. No ad hoc formatting in the report.
- **Audience-First**: Every page answers a specific question for a specific audience. No "just in case" visuals.
- **Density Discipline**: Max 8 visuals per page. If you need more, add a drill-through page.
- **Mobile Is Not Optional**: Every report gets an explicit mobile layout. Never rely on auto-generated.
- **Measure Over Column**: Visuals reference measures, not raw columns. All aggregation logic lives in DAX — see `skill-dax-modeling.md`.
- **Consistency**: Repeating page archetypes across the report. Follow `skill-visual-composition.md` for hierarchy and grid rules.

## 🎨 Theme JSON Structure

All visual styling defined in a single theme file. No manual formatting overrides.

    {
      "name": "ProjectTheme",
      "dataColors": [
        "#002A5C", "#E84D0E", "#4A90D9", "#7BC67E",
        "#F2C94C", "#A3A3A3"
      ],
      "background": { "color": "#FFFFFF" },
      "foreground": { "color": "#333333" },
      "tableAccent": "#002A5C",
      "textClasses": {
        "title": { "fontFace": "Arial", "fontSize": 20, "color": "#002A5C" },
        "header": { "fontFace": "Arial", "fontSize": 14, "color": "#002A5C" },
        "label":  { "fontFace": "Arial", "fontSize": 11, "color": "#333333" },
        "callout":{ "fontFace": "Arial", "fontSize": 36, "color": "#002A5C" }
      },
      "visualStyles": {
        "*": {
          "*": {
            "background": [{ "color": { "solid": { "color": "#FFFFFF" } }, "transparency": 100 }],
            "border":     [{ "show": false }],
            "title":      [{ "fontFamily": "Arial", "fontSize": 11, "fontColor": { "solid": { "color": "#666666" } } }]
          }
        }
      }
    }

### Theme Rules
- `dataColors`: Define 6–8 colors. First color = primary brand. Sequence matters — charts consume in order.
- Colors must meet 3:1 contrast against white background minimum.
- All text classes align with `style_constants.py` values.
- Apply theme via Report settings → Theme → Import. Never paste colors manually.

## 📊 Visual Type Selection

| Data Question | Recommended Visual | Avoid |
|:---|:---|:---|
| Trend over time | Line chart | Pie chart, stacked bar |
| Part-to-whole (≤5 segments) | Donut chart | Pie chart with >5 slices |
| Part-to-whole (>5 segments) | Stacked bar / treemap | Pie chart |
| Category comparison | Clustered bar (horizontal) | Clustered column if labels are long |
| Ranking | Sorted bar chart | Unsorted anything |
| Single KPI | Card or KPI visual | Table with one row |
| KPI + trend | KPI visual with trend line | Card + separate sparkline |
| Correlation | Scatter plot | Dual-axis line chart |
| Geographic | Filled map or shape map | 3D maps, Bing maps for internal data |
| Detail/lookup | Matrix or table | Any chart type |
| Distribution | Histogram / box plot | Bar chart with binned categories |

### Selection Rules
- Default to bar/line/card. Deviate only when the data question demands it.
- No 3D visuals. Ever.
- No dual-axis charts — use two visuals side by side.
- No gauge charts — use a card with conditional formatting.
- Limit pie/donut to ≤5 slices. More than 5 → switch to bar chart.

## 📄 Page Layout Patterns

### Page Archetypes

| Archetype | Structure | Use For |
|:---|:---|:---|
| **Executive Overview** | 4–6 KPI cards top row, 2 charts below | Landing page, summary |
| **Trend Analysis** | Filter bar top, full-width line chart, detail table below | Time-series exploration |
| **Comparison** | Side-by-side charts, shared axis or slicer | Segment vs. segment |
| **Detail / Drill-Through** | Minimal filters, dense table or matrix | Row-level lookup |
| **KPI Monitor** | Card grid (2×3 or 2×4), conditional formatting | Operational dashboards |
| **Driver Analysis** | Waterfall or decomposition tree, supporting bar chart | Root cause, variance |

### Grid & Spacing
- Use a 12-column conceptual grid. Snap all visuals to column boundaries.
- Standard page size: 16:9 (1280×720). Set explicitly — never use auto.
- Margins: 16px from page edges. 8px gaps between visuals.
- Visual heights: use consistent multiples (180px, 360px, 540px).
- Top 60–80px reserved for page title + top-level slicers.

### Page Count Guidelines
- Target 3–7 pages per report. More than 10 → split into multiple reports or use bookmarks.
- Every page has a defined purpose documented in `LAYOUT_SPEC.md`.
- Navigation: use buttons or bookmarks for non-linear reports. Tab strip for linear.

## 🎛 Formatting Conventions

### Titles & Labels
- Every visual gets a descriptive title that states the insight, not the chart type.
  - ✅ "Revenue by Region (FY24 YTD)"
  - ❌ "Bar Chart 1"
- Axis labels: show units. Abbreviate large numbers (K, M, B).
- Data labels: show on bar/column charts. Hide on line charts unless ≤3 series.

### Number Formatting
- Consistent decimal places per measure type. Define in DAX `FORMAT()` strings.
- Currency: `$#,0` or `$#,0.0K` for large values.
- Percentage: `0.0%` — one decimal.
- Integers: `#,0` with thousands separator.

### Conditional Formatting
- Use sparingly. Max 2 conditionally formatted visuals per page.
- Color scales: sequential for magnitude (light → dark), diverging for variance (red → white → green).
- Icon sets: acceptable for status indicators (✓ / ⚠ / ✗). Max 3 states.
- Rules-based formatting over gradient when categories are discrete.
- Always ensure conditional colors meet accessibility contrast ratios.

    // Example: conditional formatting rule structure
    {
      "min": { "value": 0, "color": "#FF4444" },
      "mid": { "value": 50, "color": "#FFFFFF" },
      "max": { "value": 100, "color": "#44AA44" }
    }

## 🔀 Interaction Patterns

### Cross-Filtering Rules
- Default Power BI cross-filtering is usually too aggressive. Configure explicitly.
- **Slicers**: Sync across pages only when the dimension is shared and meaningful.
- **Visual interactions**: Set to "filter" (not "highlight") for charts feeding tables. Set to "none" for independent visuals.
- **Drill-through**: Use for detail pages. Right-click context only — don't rely on users discovering it. Add a visible "View Details" button.
- **Bookmarks**: Use for toggle states (e.g., chart ↔ table view). Label buttons clearly.

### Filter Pane
- Hide the default filter pane for published reports. Use explicit slicers instead.
- Slicer placement: top row (horizontal) or left sidebar (vertical). Be consistent across pages.
- Slicer types: dropdown for high-cardinality, buttons for ≤6 options, date range for time.

## 📱 Mobile Layout

### Non-Negotiable
- Every report gets a manually designed mobile layout. No auto-generated.
- Mobile canvas: 9:16 portrait (360×640).
- Max 6 visuals on mobile. Prioritize KPIs and one chart.

### Mobile Design Rules
- Stack vertically. No side-by-side visuals on mobile.
- Cards and KPIs at top. Chart below. Table last (or omit).
- Increase font sizes — minimum 14pt for mobile body text.
- Slicers: use dropdown only on mobile. No button slicers.
- Test on actual device before publishing.

## 🏎 Performance

### Visual Count
- Max 8 visuals per page (including slicers and cards).
- Each visual = one query. More visuals = slower load.
- Use bookmarks to show/hide alternate views instead of adding visuals.

### Query Reduction
- Avoid high-cardinality columns in slicers (>1000 values). Use hierarchy or search instead.
- No calculated columns that could be measures.
- No visuals with >3 fields in the values well unless it's a table/matrix.
- Disable auto-date/time hierarchy in report settings.

### Best Practices
- Use aggregations and composite models for large datasets.
- Import mode preferred over DirectQuery unless near-real-time is required.
- Test with Performance Analyzer. Flag any visual >2s render time.
- Remove unused pages and hidden visuals before publishing.

## 🚫 Anti-Patterns (Explicit Deny List)
- No ad hoc colors — all colors from theme JSON.
- No auto-generated mobile layouts — design manually.
- No pie charts with >5 slices.
- No dual-axis charts — use two visuals.
- No 3D visuals of any kind.
- No gauge visuals — use cards with conditional formatting.
- No >8 visuals per page.
- No raw columns in visual values — use measures.
- No default filter pane visible in published reports.
- No pages without a defined purpose in `LAYOUT_SPEC.md`.
- No unsorted bar charts — always sort by value descending.
- No visual titles that describe chart type instead of insight.
- No gradients or background images on visuals.
- No >3 measures in a single card visual.

## 🔍 Audit Checklist
Used by Auditor agent (`pbi-report` domain) to verify compliance:

- [ ] Theme JSON applied — no manual color overrides.
- [ ] ≤8 visuals per page.
- [ ] Mobile layout manually created for all pages.
- [ ] All visuals use measures, not raw columns.
- [ ] Visual interactions explicitly configured (not default).
- [ ] Default filter pane hidden.
- [ ] All visual titles are descriptive (insight, not chart type).
- [ ] Contrast ratios meet accessibility minimums.
- [ ] Conditional formatting limited to 2 visuals per page max.
- [ ] No pie/donut charts with >5 slices.
- [ ] No dual-axis, 3D, or gauge visuals.
- [ ] Performance Analyzer: no visual >2s render.
- [ ] Page count within 3–10 range.
- [ ] Slicer sync configured explicitly.

## 🔗 Relationships
- **Consumed by**: Creative Director (page layout decisions), Auditor (`pbi-report` domain checks), Coder (theme generation, PBIP manipulation).
- **Depends on**: `skill-dax-modeling.md` (all measures), `skill-visual-composition.md` (hierarchy and grid principles).
- **Style tokens**: Theme JSON is the Power BI equivalent of `style_constants.py`.
- **Layout plans**: `LAYOUT_SPEC.md` governs page composition per deliverable.

## 🔨 Toolchain
- **Desktop**: Power BI Desktop for authoring.
- **Format**: PBIP (Power BI Project) for source control. Never commit `.pbix` binaries.
- **External Tools**: Tabular Editor for model, DAX Studio for query tuning.
- **Theme**: Single theme JSON per project. Import via Report settings.
- **CI/CD**: pbi-tools for extraction and deployment pipelines.
- **Testing**: Performance Analyzer for render benchmarks. Accessibility checker for contrast.