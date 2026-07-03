# Visual Type Selection Library

## 📊 Recommended Visuals

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

## Selection Rules
- Default to bar/line/card. Deviate only when the data question demands it.
- No 3D visuals. Ever.
- No dual-axis charts — use two visuals side by side.
- No gauge charts — use a card with conditional formatting.
- Limit pie/donut to ≤5 slices. More than 5 → switch to bar chart.
