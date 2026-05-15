# XLSX Standards & Best Practices

## Formatting Standards

### Professional Font
- Use a consistent, professional font (e.g., Arial, Times New Roman).

### Color Coding (Financial Models)
Unless otherwise stated by the user or existing template:
- **Blue text (RGB: 0,0,255)**: Hardcoded inputs.
- **Black text (RGB: 0,0,0)**: Formulas and calculations.
- **Green text (RGB: 0,128,0)**: Internal links within the workbook.
- **Red text (RGB: 255,0,0)**: External links to other files.
- **Yellow background (RGB: 255,255,0)**: Key assumptions or cells needing attention.

### Number Formatting
- **Years**: Format as text strings (e.g., "2024").
- **Currency**: Use `$#,##0` format; specify units in headers ("Revenue ($mm)").
- **Zeros**: Use number formatting to make zeros "-", e.g., `$#,##0;($#,##0);-`.
- **Percentages**: Default to `0.0%` format.
- **Multiples**: Format as `0.0x` (e.g., EV/EBITDA).
- **Negative numbers**: Use parentheses `(123)`.

## Formula Construction Rules

### Assumptions Placement
- Place ALL assumptions in separate cells.
- Use cell references instead of hardcoded values in formulas.
- Example: Use `=B5*(1+$B$6)` instead of `=B5*1.05`.

### Documentation Requirements for Hardcodes
Format: `"Source: [System/Document], [Date], [Specific Reference], [URL if applicable]"`
Examples:
- "Source: Company 10-K, FY2024, Page 45, Revenue Note"
- "Source: Bloomberg Terminal, 8/15/2025, AAPL US Equity"

## Verification Checklist

### Essential Checks
- [ ] **Zero Formula Errors**: Ensure no `#REF!`, `#DIV/0!`, `#VALUE!`, `#N/A`, `#NAME?`.
- [ ] **Sample Test**: Verify 2-3 sample references pull correct values.
- [ ] **Recalculation**: Run `scripts/recalc.py` after using `openpyxl`.

### Common Pitfalls
- [ ] **NaN handling**: Check for nulls with `pd.notna()`.
- [ ] **Division by zero**: Check denominators.
- [ ] **Row offset**: Remember Excel is 1-indexed (DF row 5 = Excel row 6).
- [ ] **Cross-sheet references**: Use `Sheet1!A1` format.
