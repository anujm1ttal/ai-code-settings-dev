# DAX Measure Catalog: Stadium Analytics

> Standardized patterns for stadium and seating performance metrics.

## 🎟 Sales & Revenue

### Total Revenue
```dax
Total Revenue = 
VAR Result = SUM(FactTicketSales[Revenue])
RETURN Result
```

### Revenue per Seat (RPS)
```dax
Revenue per Seat = 
VAR TotalRev = [Total Revenue]
VAR SeatCount = DISTINCTCOUNT(FactTicketSales[SeatID])
RETURN DIVIDE(TotalRev, SeatCount, 0)
```

## 📐 Compliance & Quality

### Sightline Compliance %
```dax
Sightline Compliance % = 
VAR TotalSeats = COUNTROWS(FactSightlines)
VAR CompliantSeats = COUNTROWS(FILTER(FactSightlines, FactSightlines[CValue] >= [MinCValue]))
RETURN DIVIDE(CompliantSeats, TotalSeats, 0)
```

### Average C-Value
```dax
Avg C-Value = 
VAR TotalCValue = SUM(FactSightlines[CValue])
VAR TotalSeats = COUNTROWS(FactSightlines)
RETURN DIVIDE(TotalCValue, TotalSeats, 0)
```

## 🏗 Utilization

### Capacity Utilization
```dax
Capacity Utilization = 
VAR Sold = SUM(FactTicketSales[SeatsSold])
VAR Capacity = SUM(DimSection[TotalCapacity])
RETURN DIVIDE(Sold, Capacity, 0)
```
