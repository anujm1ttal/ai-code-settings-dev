# Python Guide for XLSX Operations

## Library Selection
- **pandas**: Best for data analysis, bulk operations, and simple data export.
- **openpyxl**: Best for complex formatting, formulas, and Excel-specific features.

## Data Analysis with pandas

```python
import pandas as pd

# Read Excel
df = pd.read_excel('file.xlsx')  # Default: first sheet
all_sheets = pd.read_excel('file.xlsx', sheet_name=None)  # All sheets as dict

# Analyze
df.head()      # Preview data
df.info()      # Column info
df.describe()  # Statistics

# Write Excel
df.to_excel('output.xlsx', index=False)
```

**Best Practices:**
- Specify data types: `pd.read_excel('file.xlsx', dtype={'id': str})`
- Read specific columns: `pd.read_excel('file.xlsx', usecols=['A', 'C', 'E'])`
- Handle dates: `pd.read_excel('file.xlsx', parse_dates=['date_column'])`

## Formula & Formatting with openpyxl

### Creating new files
```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

wb = Workbook()
sheet = wb.active

# Add data & formula
sheet['A1'] = 'Hello'
sheet['B2'] = '=SUM(A1:A10)'

# Formatting
sheet['A1'].font = Font(bold=True, color='FF0000')
sheet['A1'].fill = PatternFill('solid', start_color='FFFF00')
sheet['A1'].alignment = Alignment(horizontal='center')
sheet.column_dimensions['A'].width = 20

wb.save('output.xlsx')
```

### Editing existing files
```python
from openpyxl import load_workbook

wb = load_workbook('existing.xlsx')
sheet = wb.active 

# Modify
sheet['A1'] = 'New Value'
sheet.insert_rows(2)
sheet.delete_cols(3)

# Add sheet
new_sheet = wb.create_sheet('NewSheet')
new_sheet['A1'] = 'Data'

wb.save('modified.xlsx')
```

**Best Practices:**
- Cell indices are 1-based (A1 = row 1, col 1).
- Use `data_only=True` to read calculated values (Warning: saves will lose formulas).
- Use `read_only=True` or `write_only=True` for large files.
- Formulas are preserved but not evaluated - use `scripts/recalc.py` to update values.
