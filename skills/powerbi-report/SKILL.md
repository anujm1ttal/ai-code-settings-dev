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
- **Layout plans**: `LAYOUT_SPEC.md` governs page composition per deliverable. **The Creative Director MUST include high-level ASCII wireframes in the `LAYOUT_SPEC.md` modeled directly after the structural examples in the Visual Example Output section.**

## 🔨 Toolchain
- **Desktop**: Power BI Desktop for authoring.
- **Format**: PBIP (Power BI Project) for source control. Never commit `.pbix` binaries.
- **External Tools**: Tabular Editor for model, DAX Studio for query tuning.
- **Theme**: Single theme JSON per project. Import via Report settings.
- **CI/CD**: pbi-tools for extraction and deployment pipelines.
- **Testing**: Performance Analyzer for render benchmarks. Accessibility checker for contrast.


## 📋 Visual Example Output

Reference wireframe showing an **Executive Overview** archetype page. Demonstrates how the skill rules compose into a complete dashboard layout.

> [!NOTE]
> This example shows ~10 visual sections for **illustrative completeness**. In production, split across pages to respect the ≤8 visuals-per-page rule (see Visual Count).

**Rule coverage demonstrated:**

| Visual | Skill Rule Applied |
|:---|:---|
| Filter bar (top row) | Grid & Spacing — top 60–80px reserved for slicers |
| 4× KPI cards | Single KPI → Card visual; conditional icons (● / ⚠) limited to 3 states |
| Line chart (trend) | Trend over time → Line chart; axis labels abbreviated (K, M) |
| 2× Horizontal bars | Category comparison → Clustered bar (horizontal); sorted by value desc |
| Waterfall | Driver Analysis archetype; ██/░░ legend for positive/negative |
| Detail table | Detail/lookup → Matrix or table; includes conditional status icons |
| Scatter plot | Correlation → Scatter plot; reference line for avg; bubble encoding |
| Footer | Data source attribution, drill-through instruction |

```text
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║  POWER BI REPORT PAGE — EXECUTIVE SALES DASHBOARD                                      ║
║  Last Refresh: 2025-01-15 08:30 AM                                                     ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝


  ┌─── FILTERS ────────────────────────────────────────────────────────────────────────┐
  │  Region: [▾ All Regions  ]   Period: [▾ FY2025 Q2 ]   Category: [▾ All         ]  │
  └────────────────────────────────────────────────────────────────────────────────────┘


  ┌──────────────────┐░  ┌──────────────────┐░  ┌──────────────────┐░  ┌──────────────────┐░
  │   TOTAL REVENUE  │░  │   GROSS MARGIN   │░  │   WIN RATE       │░  │   AVG DEAL SIZE  │░
  │                  │░  │                  │░  │                  │░  │                  │░
  │   $12.4M         │░  │   38.2%          │░  │   64%            │░  │   $185K          │░
  │   ▲ +8.3% YoY   │░  │   ▼ -1.1pp YoY   │░  │   ▲ +3pp YoY    │░  │   ▲ +12% YoY    │░
  │   ───────────    │░  │   ───────────    │░  │   ───────────    │░  │   ───────────    │░
  │   Target: $11.5M │░  │   Target: 40%    │░  │   Target: 60%   │░  │   Target: $170K  │░
  │   ● On Track     │░  │   ⚠ Below Target │░  │   ● On Track    │░  │   ● On Track     │░
  └──────────────────┘░  └──────────────────┘░  └──────────────────┘░  └──────────────────┘░
   ░░░░░░░░░░░░░░░░░░░   ░░░░░░░░░░░░░░░░░░░   ░░░░░░░░░░░░░░░░░░░   ░░░░░░░░░░░░░░░░░░░


  ┌─── Revenue Trend by Month ─────────────────────────────────────────────────────────┐░
  │                                                                                    │░
  │   $2.5M ┤                                                          ╭──●            │░
  │         │                                                    ╭────╯                 │░
  │   $2.0M ┤                                              ╭────╯                      │░
  │         │                                        ●────╯                             │░
  │   $1.5M ┤                                  ╭────╯                                   │░
  │         │                           ╭─────╯                                         │░
  │   $1.0M ┤               ╭─────────╯                                                │░
  │         │         ╭────╯                                                            │░
  │   $0.5M ┤   ●───╯                                     ··········· Target            │░
  │         │                                              ─────────── Actual            │░
  │   $0.0M ┼────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────               │░
  │         Jul  Aug  Sep  Oct  Nov  Dec  Jan  Feb  Mar  Apr  May  Jun                  │░
  │                                                                                    │░
  └────────────────────────────────────────────────────────────────────────────────────┘░
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░


  ┌─── Revenue by Region ──────────────────────┐░  ┌─── Top 5 Products ────────────────┐░
  │                                            │░  │                                   │░
  │   West     ████████████████████░░ $4.2M    │░  │   Platform A  ██████████░░ $3.1M  │░
  │                                            │░  │                                   │░
  │   East     ███████████████░░░░░░ $3.1M     │░  │   Platform B  ████████░░░░ $2.4M  │░
  │                                            │░  │                                   │░
  │   Central  ██████████░░░░░░░░░░ $2.8M      │░  │   Module C    ██████░░░░░░ $1.8M  │░
  │                                            │░  │                                   │░
  │   South    ████████░░░░░░░░░░░░ $2.3M      │░  │   Service D   ████░░░░░░░░ $1.2M  │░
  │                                            │░  │                                   │░
  │                                            │░  │   Add-on E    ███░░░░░░░░░ $0.9M  │░
  │   ░░ = gap to target                       │░  │                                   │░
  │   ██ = actual                              │░  │   ░░ = gap to target              │░
  │                                            │░  │   ██ = actual                     │░
  └────────────────────────────────────────────┘░  └───────────────────────────────────┘░
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░


  ┌─── Pipeline Waterfall — Q2 Revenue Bridge ─────────────────────────────────────────┐░
  │                                                                                    │░
  │           ┌───┐                                                                    │░
  │    $11.5M │   │  +$2.1M   +$1.8M   -$0.6M   -$0.4M   -$2.0M                      │░
  │           │   │  ┌───┐                                                             │░
  │           │   │  │   │   ┌───┐                                    ┌───┐            │░
  │           │   │  │   │   │   │                                    │   │ $12.4M     │░
  │           │   │  │   │   │   │   ┌───┐                            │   │            │░
  │           │   │  │   │   │   │   │░░░│   ┌───┐                    │   │            │░
  │           │   │  │   │   │   │   │░░░│   │░░░│   ┌───┐            │   │            │░
  │           │   │  │   │   │   │   │░░░│   │░░░│   │░░░│            │   │            │░
  │           └───┘  └───┘   └───┘   └───┘   └───┘   └───┘            └───┘            │░
  │          Opening  New    Upsell   Lost   Slipped Churned          Closing           │░
  │           Pipe    Deals                                            Actual           │░
  │                                                                                    │░
  │           ██ = positive movement    ░░ = negative movement                         │░
  └────────────────────────────────────────────────────────────────────────────────────┘░
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░


  ┌─── Detail Table — Region Breakdown ────────────────────────────────────────────────┐░
  │                                                                                    │░
  │   Region     Revenue    Target     Δ         Margin   Win Rate   Deals   Status    │░
  │   ─────────────────────────────────────────────────────────────────────────────     │░
  │   West       $4.2M      $3.8M     +$0.4M     41.2%    72%        48     ● ▲       │░
  │   East       $3.1M      $3.2M     -$0.1M     36.8%    61%        39     ⚠ ▼       │░
  │   Central    $2.8M      $2.5M     +$0.3M     38.5%    58%        31     ● ▲       │░
  │   South      $2.3M      $2.0M     +$0.3M     35.1%    63%        27     ● ▲       │░
  │   ─────────────────────────────────────────────────────────────────────────────     │░
  │   TOTAL      $12.4M     $11.5M    +$0.9M     38.2%    64%       145                │░
  │                                                                                    │░
  │   ● = on/above target   ⚠ = below target   ▲ = improving   ▼ = declining          │░
  └────────────────────────────────────────────────────────────────────────────────────┘░
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░


  ┌─── Scatter — Deal Size vs. Win Rate by Account ────────────────────────────────────┐░
  │                                                                                    │░
  │   100% ┤                                                                           │░
  │        │            ○                                                               │░
  │    80% ┤     ○    ○   ○         ◉                                                  │░
  │        │   ○  ○  ○ ○    ○    ○    ◉                                                │░
  │    60% ┤─ ─ ─○─ ─ ─ ─○─ ─ ─ ─ ─ ─ ─ ─ ─◉─ ─ ─ ─ ─ ─ ─ ─  avg win rate          │░
  │        │       ○    ○       ○        ○                                              │░
  │    40% ┤          ○    ○        ○                                                   │░
  │        │             ○                                                              │░
  │    20% ┤                  ○                                                         │░
  │        │                                                                            │░
  │     0% ┼────────┬────────┬────────┬────────┬────────┬────────                      │░
  │        $0       $100K    $200K    $300K    $400K    $500K                           │░
  │                         Deal Size →                                                 │░
  │                                                                                    │░
  │   ○ = standard account   ◉ = strategic account   bubble = revenue                  │░
  └────────────────────────────────────────────────────────────────────────────────────┘░
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░


  ┌─── Footer ─────────────────────────────────────────────────────────────────────────┐
  │  Source: CRM Pipeline Extract  │  Owner: Sales Analytics  │  Refresh: Daily 6AM   │
  │  Drill-through: Click region → Region Detail Page                                  │
  └────────────────────────────────────────────────────────────────────────────────────┘
```

### Extended Visual Type Library

Expanded wireframe showing every visual type in a polished layout. Uses insight-driven titles, section dividers, and consistent shadow/legend patterns. This is a **reference catalog** — not a single page.

> [!NOTE]
> The "Progress Arc" section below demonstrates the **recommended card + conditional formatting alternative** to gauge visuals (which remain on the anti-pattern deny list).

**Additional visual types demonstrated:**

| Visual | Skill Rule Applied |
|:---|:---|
| KPI cards with progress bars | Card visual with % to target; ≤3 conditional states |
| Line chart with target overlay | Trend over time; ◆/◇ markers for actual vs target |
| Horizontal bar with target marker | Category comparison; target │ line overlay; sorted desc |
| Waterfall (positive/negative) | Driver Analysis archetype; solid vs dashed borders |
| Scatter with reference line | Correlation; bubble encoding; ◉ for strategic accounts |
| Heatmap matrix | Conditional formatting — 3-band threshold (░/▒/▓); max 3 states |
| Progress arc (card alternative) | Cards with arc fill — replaces banned gauge visuals |
| Donut charts (≤3 slices) | Part-to-whole; ≤5 slice rule respected |
| Stacked bar (composition) | Part-to-whole >5 segments rule; composition over time |
| Sparkline inline table | Matrix with inline trend; ▁▂▃▄▅▆▇ block elements |
| Bullet chart | Actual vs target vs stretch; qualitative range bands |
| Funnel | Pipeline conversion; stage-to-stage % rates |
| Multi-row cards | Account detail cards; health status + sparkline trend |
| Navigation footer | Page buttons, data source, classification, refresh info |

```text


  ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
  ║                                                                                             ║
  ║   EXECUTIVE SALES DASHBOARD                                          Q2 FY2025 · Live       ║
  ║   West region leads growth · Margin trending below target                                   ║
  ║                                                                                             ║
  ╠═══════════════════════════════════════════════════════════════════════════════════════════════╣
  ║   Region  ╭──────────╮  Period  ╭──────────╮  Segment  ╭──────────╮  Compare  ╭──────────╮ ║
  ║           │ All    ▾ │          │ Q2 2025▾ │           │ All    ▾ │           │ YoY    ▾ │ ║
  ║           ╰──────────╯          ╰──────────╯           ╰──────────╯           ╰──────────╯ ║
  ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                                   KEY  METRICS                                              ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
  │                         │   │                         │   │                         │   │                         │
  │   TOTAL REVENUE         │   │   GROSS MARGIN          │   │   WIN RATE              │   │   AVG DEAL SIZE        │
  │                         │   │                         │   │                         │   │                         │
  │        $12.4M           │   │        38.2%            │   │        64%              │   │        $185K           │
  │                         │   │                         │   │                         │   │                         │
  │   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │   │   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │   │   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │   │   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │
  │                         │   │                         │   │                         │   │                         │
  │   ▲ +8.3%    vs LY     │   │   ▼ -1.1pp    vs LY    │   │   ▲ +3pp     vs LY     │   │   ▲ +12%     vs LY     │
  │                         │   │                         │   │                         │   │                         │
  │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░ │   │   ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░ │   │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░ │   │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░ │
  │   108% to target        │   │    96% to target        │   │   107% to target        │   │   109% to target        │
  │                         │   │                         │   │                         │   │                         │
  │          ● ON TRACK     │   │          ⚠ AT RISK      │   │          ● ON TRACK     │   │          ● ON TRACK     │
  │                         │   │                         │   │                         │   │                         │
  └─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘   └─────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░    ░░░░░░░░░░░░░░░░░░░░░░░░░    ░░░░░░░░░░░░░░░░░░░░░░░░░    ░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                              REVENUE  TREND                                                 ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌────────────────────────────────────────────────────────────────────────────────────────────┐
  │                                                                                            │
  │   Revenue is ahead of plan, accelerating in Q2                                             │
  │                                                                                            │
  │                                                                                            │
  │   $2.5M ┤                                                                                  │
  │         │                                                                    ╭─── ◆ $2.4M  │
  │         │                                                              ╭────╯              │
  │   $2.0M ┤                                                        ╭───╯                    │
  │         │                                                  ◆───╯                           │
  │         │                                            ╭────╯                                │
  │   $1.5M ┤                                      ╭───╯          · · · · · · · ◇ $2.1M       │
  │         │                                ╭────╯         · · ·                              │
  │         │                          ╭────╯        · · ·                                     │
  │   $1.0M ┤                    ╭───╯        · · ·                                            │
  │         │              ╭────╯       · · ·                                                  │
  │         │        ╭────╯      · · ·                                                         │
  │   $0.5M ┤  ◆───╯      · · ·                                                               │
  │         │        · · ·                                                                     │
  │         │  · · ·                                                                           │
  │   $0.0M ┼───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬──────   │
  │         Jul     Aug     Sep     Oct     Nov     Dec     Jan     Feb     Mar     Apr        │
  │                                                                                            │
  │         ───── Actual  ◆ month close     · · · · Target  ◇ month target                     │
  │                                                                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                          BREAKDOWN  &  COMPARISON                                           ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌── West region leads — East underperforming ──────────────┐   ┌── Platform A dominates mix ──────────────────┐
  │                                                          │   │                                              │
  │                                                          │   │                                              │
  │          actual              target                      │   │          actual              target           │
  │            ↓                   ↓                         │   │            ↓                   ↓              │
  │                                                          │   │                                              │
  │   West    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│░░  $4.2M  ▲ +11%     │   │   Plat A  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│░  $3.1M  ▲  │
  │                                  │                       │   │                               │              │
  │   East    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░│    $3.1M  ▼  -3%     │   │   Plat B  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░│  $2.4M  ▲   │
  │                                  │                       │   │                               │              │
  │   Central ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░│    $2.8M  ▲  +5%     │   │   Mod C   ▓▓▓▓▓▓▓▓▓▓░░░░░░░░│  $1.8M  ═    │
  │                                  │                       │   │                               │              │
  │   South   ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░│    $2.3M  ▲  +7%     │   │   Svc D   ▓▓▓▓▓▓░░░░░░░░░░░░│  $1.2M  ▼    │
  │                                  │                       │   │                               │              │
  │                                  │                       │   │   Add E   ▓▓▓▓░░░░░░░░░░░░░░░│  $0.9M  ▲    │
  │   ▓▓ actual   ░░ gap to target   │ target                │   │                               │              │
  │                                                          │   │   ▓▓ actual   ░░ gap          │ target        │
  │                                                          │   │                                              │
  └──────────────────────────────────────────────────────────┘   └──────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                            PIPELINE  BRIDGE                                                 ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌── New deals and upsells offset churn — net positive $0.9M ─────────────────────────────────┐
  │                                                                                            │
  │                                                                                            │
  │         $14M ┤                                                                             │
  │              │                                                                             │
  │              │                                                                             │
  │         $13M ┤  ┌─────────┐                                                                │
  │              │  │         │                                                                 │
  │              │  │         │  ┌─────────┐                                                    │
  │         $12M ┤  │         │  │ +$2.1M  │  ┌─────────┐                                      │
  │              │  │         │  │         │  │ +$1.8M  │                                       │
  │              │  │ $11.5M  │  │         │  │         │  ┌ ─ ─ ─ ─┐  ┌ ─ ─ ─ ─┐              │
  │         $11M ┤  │         │  │         │  │         │  │ -$0.6M │  │ -$0.4M │              │
  │              │  │ Opening │  │         │  │         │  │        │  │        │  ┌ ─ ─ ─ ─┐  │
  │              │  │  Pipe   │  │  New    │  │ Upsell  │  │  Lost  │  │Slipped │  │ -$2.0M │  │
  │         $10M ┤  │         │  │  Deals  │  │         │  │        │  │        │  │        │  │
  │              │  │         │  │         │  │         │  │        │  │        │  │ Churned│  │
  │              │  │         │  │         │  │         │  └ ─ ─ ─ ─┘  └ ─ ─ ─ ─┘  │        │  │
  │          $9M ┤  │         │  │         │  │         │                           │        │  │
  │              │  │         │  │         │  │         │                           └ ─ ─ ─ ─┘  │
  │              │  │         │  │         │  │         │                                       │
  │          $8M ┤  └─────────┘  └─────────┘  └─────────┘                           ┌─────────┐│
  │              │                                                                  │ $12.4M  ││
  │              │                                                                  │         ││
  │          $7M ┤                                                                  │ Closing ││
  │              │                                                                  │  Actual ││
  │              │                                                                  └─────────┘│
  │              │                                                                             │
  │              │   ┌───┐ positive       ┌ ─ ─┐ negative                                      │
  │              │   │   │ movement       │    │ movement                                      │
  │              │   └───┘                └ ─ ─┘                                               │
  │                                                                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                          DEAL  LANDSCAPE                                                    ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌── Strategic accounts win bigger and more often ────────────────────────────────────────────┐
  │                                                                                            │
  │                                                                                            │
  │   Win    100% ┤                                                                            │
  │   Rate        │                                                                            │
  │               │         ○                                                                  │
  │          80%  ┤     ○      ○  ○                                                            │
  │               │   ○    ○ ○  ○      ○                                                       │
  │               │  ○  ○ ○  ○    ○  ○   ◉                                                     │
  │          60%  ┤─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─◉─ ─ ─ ─ ─ ─ ─ ─ ─ avg 64% ─ ─ ─ ─ ─    │
  │               │      ○   ○ ○     ○        ○        ◉                                       │
  │               │        ○     ○       ○                  ◉                                  │
  │          40%  ┤           ○    ○                                                            │
  │               │              ○                                                             │
  │               │                                                                            │
  │          20%  ┤          ○                                                                  │
  │               │                                                                            │
  │               │                                                                            │
  │           0%  ┼──────────┬──────────┬──────────┬──────────┬──────────┬──────────            │
  │               $0        $100K      $200K      $300K      $400K      $500K                   │
  │                                                                                            │
  │                                    Deal Size →                                             │
  │                                                                                            │
  │               ○  standard account          ◉  strategic account                            │
  │               bubble size = total revenue  ── avg win rate                                  │
  │                                                                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                          DETAIL  TABLE                                                      ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌────────────────────────────────────────────────────────────────────────────────────────────┐
  │                                                                                            │
  │   Click any region row to drill through → Region Detail Page                               │
  │                                                                                            │
  │   ┌────────────┬────────────┬────────────┬────────────┬──────────┬──────────┬───────────┐  │
  │   │            │            │            │            │          │          │           │  │
  │   │   REGION   │  REVENUE   │  TARGET    │  Δ vs TGT  │  MARGIN  │ WIN RATE │  STATUS   │  │
  │   │            │            │            │            │          │          │           │  │
  │   ├────────────┼────────────┼────────────┼────────────┼──────────┼──────────┼───────────┤  │
  │   │            │            │            │            │          │          │           │  │
  │   │   West     │    $4.2M   │    $3.8M   │   +$0.4M   │  41.2%   │   72%    │   ● ▲    │  │
  │   │            │            │            │            │          │          │           │  │
  │   ├────────────┼────────────┼────────────┼────────────┼──────────┼──────────┼───────────┤  │
  │   │            │            │            │            │          │          │           │  │
  │   │   East     │    $3.1M   │    $3.2M   │   -$0.1M   │  36.8%   │   61%    │   ⚠ ▼    │  │
  │   │            │            │            │            │          │          │           │  │
  │   ├────────────┼────────────┼────────────┼────────────┼──────────┼──────────┼───────────┤  │
  │   │            │            │            │            │          │          │           │  │
  │   │   Central  │    $2.8M   │    $2.5M   │   +$0.3M   │  38.5%   │   58%    │   ● ▲    │  │
  │   │            │            │            │            │          │          │           │  │
  │   ├────────────┼────────────┼────────────┼────────────┼──────────┼──────────┼───────────┤  │
  │   │            │            │            │            │          │          │           │  │
  │   │   South    │    $2.3M   │    $2.0M   │   +$0.3M   │  35.1%   │   63%    │   ● ▲    │  │
  │   │            │            │            │            │          │          │           │  │
  │   ├────────────┼────────────┼────────────┼────────────┼──────────┼──────────┼───────────┤  │
  │   │            │            │            │            │          │          │           │  │
  │   │   TOTAL    │   $12.4M   │   $11.5M   │   +$0.9M   │  38.2%   │   64%    │           │  │
  │   │            │            │            │            │          │          │           │  │
  │   └────────────┴────────────┴────────────┴────────────┴──────────┴──────────┴───────────┘  │
  │                                                                                            │
  │   ● on/above target    ⚠ below target    ▲ improving    ▼ declining    ═ flat              │
  │                                                                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                       MONTHLY  PERFORMANCE  HEATMAP                                         ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌── Margin weakness concentrated in East during Q1 ──────────────────────────────────────────┐
  │                                                                                            │
  │                                                                                            │
  │               Jul     Aug     Sep     Oct     Nov     Dec     Jan     Feb     Mar     Apr   │
  │             ┌───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬───────┬─────┐│
  │             │       │       │       │       │       │       │       │       │       │     ││
  │   West      │ ▓▓▓▓▓ │ ▓▓▓▓▓ │ ▓▓▓▓▓ │ ▓▓▓▓▓ │ ▓▓▓▓▓ │ ▓▓▓▓▓ │ ▓▓▓▓▓ │ ▓▓▓▓▓ │ ▓▓▓▓▓ │▓▓▓▓▓││
  │             │ 42.1% │ 41.8% │ 40.9% │ 41.5% │ 42.0% │ 41.2% │ 41.8% │ 42.3% │ 42.8% │43.1%││
  │             │       │       │       │       │       │       │       │       │       │     ││
  │   East      │ ░░░░░ │ ░░░░░ │ ░░░░░ │ ▒▒▒▒▒ │ ▒▒▒▒▒ │ ░░░░░ │ ░░░░░ │ ░░░░░ │ ▒▒▒▒▒ │▒▒▒▒▒││
  │             │ 34.2% │ 33.8% │ 34.5% │ 36.1% │ 37.2% │ 35.8% │ 34.9% │ 35.2% │ 37.8% │38.1%││
  │             │       │       │       │       │       │       │       │       │       │     ││
  │   Central   │ ▒▒▒▒▒ │ ▒▒▒▒▒ │ ▒▒▒▒▒ │ ▓▓▓▓▓ │ ▓▓▓▓▓ │ ▒▒▒▒▒ │ ▓▓▓▓▓ │ ▓▓▓▓▓ │ ▓▓▓▓▓ │▓▓▓▓▓││
  │             │ 36.8% │ 37.1% │ 37.5% │ 38.2% │ 38.9% │ 37.8% │ 38.5% │ 39.1% │ 39.4% │39.8%││
  │             │       │       │       │       │       │       │       │       │       │     ││
  │   South     │ ░░░░░ │ ░░░░░ │ ▒▒▒▒▒ │ ▒▒▒▒▒ │ ▒▒▒▒▒ │ ▒▒▒▒▒ │ ▒▒▒▒▒ │ ▒▒▒▒▒ │ ▒▒▒▒▒ │▒▒▒▒▒││
  │             │ 33.1% │ 33.5% │ 34.2% │ 35.0% │ 35.4% │ 35.1% │ 35.8% │ 36.2% │ 36.5% │36.9%││
  │             │       │       │       │       │       │       │       │       │       │     ││
  │             └───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┴─────┘│
  │                                                                                            │
  │   ▓▓▓▓▓  ≥ 38% (on target)     ▒▒▒▒▒  35–38% (watch)     ░░░░░  < 35% (below target)     │
  │                                                                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                    PROGRESS  ARC  (card alternative to gauges)                               ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌── Quarterly Targets ───────────────────────────────────────────────────────────────────────┐
  │                                                                                            │
  │                                                                                            │
  │          Revenue                   Margin                    Pipeline                      │
  │                                                                                            │
  │        ╭───────────╮            ╭───────────╮            ╭───────────╮                     │
  │      ╭─╯           ╰─╮       ╭─╯           ╰─╮       ╭─╯           ╰─╮                    │
  │    ╭─╯    108%        ╰─╮  ╭─╯     96%        ╰─╮  ╭─╯    122%        ╰─╮                 │
  │   │   ▓▓▓▓▓▓▓▓▓▓▓░░░   │ │   ▓▓▓▓▓▓▓▓▓░░░░░   │ │   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │                 │
  │   │  ▓              ░   │ │  ▓              ░   │ │  ▓              ▓   │                 │
  │   │ ▓                ░  │ │ ▓                ░  │ │ ▓                ▓  │                 │
  │    ▓        ↑          ░   ▓        ↑          ░   ▓        ↑          ▓                   │
  │             │                       │                       │                              │
  │          $12.4M                   38.2%                   $38M                             │
  │        of $11.5M               of 40.0%                of $31M                             │
  │                                                                                            │
  │        ● ON TRACK               ⚠ AT RISK              ● EXCEEDING                        │
  │                                                                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                         DONUT  &  COMPOSITION                                               ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌── Revenue Mix by Segment ──────────────────┐   ┌── Deal Stage Distribution ────────────────┐
  │                                            │   │                                           │
  │                                            │   │                                           │
  │            ╭──── ▓▓▓▓ ────╮                │   │            ╭──── ▓▓▓▓ ────╮               │
  │         ╭──╯  ▓▓      ▓▓  ╰──╮            │   │         ╭──╯  ▓▓      ░░  ╰──╮           │
  │       ╭─╯ ▓▓             ▓▓   ╰─╮         │   │       ╭─╯ ▓▓             ░░   ╰─╮        │
  │      │ ▓▓                   ▓▓    │        │   │      │ ▓▓                   ░░    │       │
  │     │ ▓▓      ╭───────╮     ░░░   │       │   │     │ ▓▓      ╭───────╮     ░░░   │      │
  │     │ ▓▓     │  $12.4M │     ░░░  │       │   │     │ ▓▓     │  145    │     ░░░  │      │
  │     │ ▓▓     │  total   │    ░░░░  │       │   │     │ ▒▒     │  deals  │    ░░░░  │      │
  │      │ ▓▓     ╰───────╯    ░░░░  │        │   │      │ ▒▒     ╰───────╯    ░░░░  │       │
  │       ╰─╮ ▒▒            ░░░░  ╭─╯         │   │       ╰─╮ ▒▒            ░░░░  ╭─╯        │
  │         ╰──╮  ▒▒▒▒  ░░░░  ╭──╯            │   │         ╰──╮  ▒▒▒▒  ░░░░  ╭──╯           │
  │            ╰──── ▒▒▒▒ ────╯                │   │            ╰──── ▒▒▒▒ ────╯               │
  │                                            │   │                                           │
  │   ▓▓ Enterprise  42%   $5.2M               │   │   ▓▓ Won       45%    65 deals            │
  │   ▒▒ Mid-Market  31%   $3.8M               │   │   ▒▒ Active    28%    41 deals            │
  │   ░░ SMB         27%   $3.4M               │   │   ░░ Prospect  27%    39 deals            │
  │                                            │   │                                           │
  └────────────────────────────────────────────┘   └───────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░

   

  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                       STACKED  BAR  —  COMPOSITION  OVER  TIME                              ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌── Enterprise share growing — SMB shrinking as % of revenue ────────────────────────────────┐
  │                                                                                            │
  │                                                                                            │
  │   100%  ┤ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░        │
  │         │ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░        │
  │         │ ░░░░ 32% ░░░░ ░░░░ 30% ░░░░ ░░░░ 29% ░░░░ ░░░░ 28% ░░░░ ░░░░ 27% ░░░░        │
  │         │ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░ ░░░░░░░░░░░░░        │
  │         │ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒        │
  │    50%  ┤ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒        │
  │         │ ▒▒▒▒ 30% ▒▒▒▒ ▒▒▒▒ 31% ▒▒▒▒ ▒▒▒▒ 31% ▒▒▒▒ ▒▒▒▒ 31% ▒▒▒▒ ▒▒▒▒ 31% ▒▒▒▒        │
  │         │ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒ ▒▒▒▒▒▒▒▒▒▒▒▒▒        │
  │         │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓        │
  │         │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓        │
  │         │ ▓▓▓▓ 38% ▓▓▓▓ ▓▓▓▓ 39% ▓▓▓▓ ▓▓▓▓ 40% ▓▓▓▓ ▓▓▓▓ 41% ▓▓▓▓ ▓▓▓▓ 42% ▓▓▓▓        │
  │         │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ▓▓▓▓▓▓▓▓▓▓▓▓▓        │
  │     0%  ┼─────────────┬─────────────┬─────────────┬─────────────┬─────────────             │
  │            FY2021        FY2022        FY2023        FY2024        FY2025                   │
  │                                                                                            │
  │         ▓▓ Enterprise     ▒▒ Mid-Market     ░░ SMB                                         │
  │                                                                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                       SPARKLINES  &  INLINE  TREND  TABLE                                   ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌── Inline trends reveal East margin erosion and South pipeline risk ─────────────────────────┐
  │                                                                                            │
  │                                                                                            │
  │   ┌────────────┬──────────┬──────────────────────────┬──────────┬──────────────────────────┐│
  │   │            │          │                          │          │                          ││
  │   │   REGION   │ REVENUE  │   6-month trend          │  MARGIN  │   6-month trend          ││
  │   │            │          │                          │          │                          ││
  │   ├────────────┼──────────┼──────────────────────────┼──────────┼──────────────────────────┤│
  │   │            │          │                          │          │                          ││
  │   │   West     │  $4.2M   │   ▁▂▃▄▅▆▇  accelerating │  41.2%   │   ▅▅▅▆▆▆▇  stable up    ││
  │   │            │          │                          │          │                          ││
  │   │   East     │  $3.1M   │   ▃▃▄▄▄▅▅  flat growth  │  36.8%   │   ▆▅▄▃▃▃▂  eroding  ⚠   ││
  │   │            │          │                          │          │                          ││
  │   │   Central  │  $2.8M   │   ▂▃▃▄▅▅▆  steady climb │  38.5%   │   ▃▄▄▅▅▆▆  recovering   ││
  │   │            │          │                          │          │                          ││
  │   │   South    │  $2.3M   │   ▂▂▃▃▄▅▅  building     │  35.1%   │   ▃▃▃▄▄▄▅  slow improve ││
  │   │            │          │                          │          │                          ││
  │   └────────────┴──────────┴──────────────────────────┴──────────┴──────────────────────────┘│
  │                                                                                            │
  │   ▁▂▃▄▅▆▇ = relative monthly values (low → high)    ⚠ = requires attention                │
  │                                                                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                       BULLET  CHART  —  ACTUAL  vs  TARGET  vs  STRETCH                     ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌── West exceeds stretch · East missed base target ──────────────────────────────────────────┐
  │                                                                                            │
  │                                                                                            │
  │          poor         fair          good         excellent                                  │
  │          ░░░░░░░░░░░░ ▒▒▒▒▒▒▒▒▒▒▒▒ ▓▓▓▓▓▓▓▓▓▓▓▓ ████████████                            │
  │                                                                                            │
  │                                                                                            │
  │   West    ░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓████████████                              │
  │           ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■│▏                                     │
  │                                               │    │▕ $4.2M actual                         │
  │                                               │    ╰── $4.1M stretch                       │
  │                                               ╰────── $3.8M target                         │
  │                                                                                            │
  │   East    ░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓████████████                              │
  │           ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■│▏                                                 │
  │                                    │    │▕ $3.1M actual                                    │
  │                                    │    ╰── $3.5M stretch                                  │
  │                                    ╰────── $3.2M target  ⚠ missed                         │
  │                                                                                            │
  │   Central ░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓████████████                              │
  │           ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■│▏                                               │
  │                                       │   │▕ $2.8M actual                                  │
  │                                       │   ╰── $2.8M stretch                                │
  │                                       ╰────── $2.5M target                                 │
  │                                                                                            │
  │   South   ░░░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓████████████                              │
  │           ■■■■■■■■■■■■■■■■■■■■■■■■■■│▏                                                    │
  │                                  │   │▕ $2.3M actual                                       │
  │                                  │   ╰── $2.4M stretch                                     │
  │                                  ╰────── $2.0M target                                      │
  │                                                                                            │
  │   ■■ actual bar    │ target marker    │ stretch marker                                     │
  │   ░░ poor zone     ▒▒ fair zone       ▓▓ good zone       ██ excellent zone                 │
  │                                                                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                       FUNNEL  —  PIPELINE  CONVERSION                                       ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌── 64% win rate — strongest conversion at proposal stage ───────────────────────────────────┐
  │                                                                                            │
  │                                                                                            │
  │      ╔═══════════════════════════════════════════════════════════════════╗                   │
  │      ║                                                                 ║                   │
  │      ║                    LEADS · 412                                   ║                   │
  │      ║                                                                 ║                   │
  │      ╚════╗                                                       ╔════╝                   │
  │           ║                                                  ║                             │
  │           ╠═══════════════════════════════════════════════════╣          72% qualified       │
  │           ║                                                  ║                             │
  │           ║               QUALIFIED · 298                     ║                             │
  │           ║                                                  ║                             │
  │           ╚════╗                                        ╔════╝                             │
  │                ║                                   ║                                       │
  │                ╠════════════════════════════════════╣           68% to proposal              │
  │                ║                                   ║                                       │
  │                ║          PROPOSAL · 203            ║                                       │
  │                ║                                   ║                                       │
  │                ╚════╗                         ╔════╝                                       │
  │                     ║                    ║                                                  │
  │                     ╠═════════════════════╣            71% to negotiation                   │
  │                     ║                    ║                                                  │
  │                     ║   NEGOTIATE · 145   ║                                                 │
  │                     ║                    ║                                                  │
  │                     ╚════╗          ╔════╝                                                 │
  │                          ║     ║                                                           │
  │                          ╠══════╣                  90% to close                             │
  │                          ║     ║                                                           │
  │                          ║ WON ║                                                           │
  │                          ║ 130 ║                                                           │
  │                          ║     ║                                                           │
  │                          ╚═════╝                                                           │
  │                                                                                            │
  │      Overall conversion: 412 leads → 130 won = 31.6% lead-to-win                          │
  │      Average cycle: 47 days                                                                │
  │                                                                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╮
  ┊                       MULTI-ROW  CARD  —  KEY  ACCOUNTS                                     ┊
  ╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

  ┌────────────────────────────────────────────────────────────────────────────────────────────┐
  │                                                                                            │
  │   ┌─────────────────────────────┐   ┌─────────────────────────────┐                        │
  │   │                             │   │                             │                        │
  │   │   ACME CORP            ◉    │   │   GLOBEX INC            ◉   │                        │
  │   │                             │   │                             │                        │
  │   │   Revenue       $1.8M       │   │   Revenue       $1.2M      │                        │
  │   │   Margin         44.2%      │   │   Margin         41.8%     │                        │
  │   │   Open Deals        4       │   │   Open Deals        3      │                        │
  │   │   Next Renewal   Jun 2025   │   │   Next Renewal   Aug 2025  │                        │
  │   │   Health        ● Strong    │   │   Health        ● Strong   │                        │
  │   │   Trend   ▂▃▄▅▆▇  ▲ +14%   │   │   Trend   ▃▃▄▅▅▆  ▲ +8%  │                        │
  │   │                             │   │                             │                        │
  │   └─────────────────────────────┘   └─────────────────────────────┘                        │
  │    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                        │
  │                                                                                            │
  │   ┌─────────────────────────────┐   ┌─────────────────────────────┐                        │
  │   │                             │   │                             │                        │
  │   │   INITECH LLC          ◉    │   │   UMBRELLA CO          ○   │                        │
  │   │                             │   │                             │                        │
  │   │   Revenue       $0.9M       │   │   Revenue       $0.7M      │                        │
  │   │   Margin         39.1%      │   │   Margin         33.2%     │                        │
  │   │   Open Deals        2       │   │   Open Deals        5      │                        │
  │   │   Next Renewal   Sep 2025   │   │   Next Renewal   Jul 2025  │                        │
  │   │   Health        ● Stable    │   │   Health        ⚠ At Risk  │                        │
  │   │   Trend   ▃▄▄▅▅▅  ═ flat    │   │   Trend   ▆▅▄▃▃▂  ▼ -6%  │                        │
  │   │                             │   │                             │                        │
  │   └─────────────────────────────┘   └─────────────────────────────┘                        │
  │    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                        │
  │                                                                                            │
  │   ◉ strategic account    ○ standard account                                                │
  │                                                                                            │
  └────────────────────────────────────────────────────────────────────────────────────────────┘
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░



  ╔═══════════════════════════════════════════════════════════════════════════════════════════════╗
  ║                                                                                             ║
  ║   Source: CRM Pipeline Extract · Salesforce                                                 ║
  ║   Owner: Sales Analytics Team · analytics@company.com                                       ║
  ║   Refresh: Daily 06:00 UTC · Incremental                                                    ║
  ║   Classification: Internal · Confidential                                                   ║
  ║                                                                                             ║
  ║   Navigation:  [Summary]  [Trend]  [Region Detail▸]  [Product Mix]  [Accounts]  [Export]   ║
  ║                                                                                             ║
  ╚═══════════════════════════════════════════════════════════════════════════════════════════════╝

```

### Visual Type Inventory

Combined catalog across both example blocks (compact + expanded):

| # | Visual Type | Section | Skill Rule |
|:--|:---|:---|:---|
| 1 | KPI Cards with progress bars | Key Metrics | Card visual; ≤3 conditional states |
| 2 | Line Chart with target overlay | Revenue Trend | Trend over time → Line chart |
| 3 | Horizontal Bar with gap-to-target | Breakdown & Comparison | Category comparison → sorted bar |
| 4 | Waterfall with positive/negative | Pipeline Bridge | Driver Analysis archetype |
| 5 | Scatter Plot with reference line | Deal Landscape | Correlation → Scatter plot |
| 6 | Heatmap Matrix with threshold bands | Monthly Performance | Conditional formatting; 3 states max |
| 7 | Progress Arc (card alternative) | Quarterly Targets | Card + conditional formatting (not gauge) |
| 8 | Donut Charts (≤3 slices) | Revenue Mix & Deal Stage | Part-to-whole ≤5 segments |
| 9 | Stacked Bar composition over time | Composition | Part-to-whole >5 → stacked bar |
| 10 | Sparkline Table with inline trends | Inline Trend Table | Matrix with inline encoding |
| 11 | Bullet Chart with target + stretch | Actual vs Target vs Stretch | Ranking with qualitative ranges |
| 12 | Funnel with stage conversion rates | Pipeline Conversion | Pipeline stage analysis |
| 13 | Multi-Row Cards with account detail | Key Accounts | Card visual; detail layout |
| 14 | Detail Table with conditional icons | Region Breakdown | Detail/lookup → Matrix or table |
| 15 | Slicer Bar | Header Filters | Top row reserved for slicers |
| 16 | Navigation Footer | Page Navigation | Buttons/bookmarks for navigation |
