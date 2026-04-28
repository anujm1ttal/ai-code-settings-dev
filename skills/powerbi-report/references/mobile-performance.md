# Mobile Layout & Performance Optimization

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

## 🏎 Performance Optimization

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
