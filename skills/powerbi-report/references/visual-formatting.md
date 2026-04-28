# Visual Formatting & Interaction Standards

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

```json
// Example: conditional formatting rule structure
{
  "min": { "value": 0, "color": "#FF4444" },
  "mid": { "value": 50, "color": "#FFFFFF" },
  "max": { "value": 100, "color": "#44AA44" }
}
```

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
