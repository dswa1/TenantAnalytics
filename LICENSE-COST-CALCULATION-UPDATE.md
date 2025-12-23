# License Cost Calculation Update

## Overview
Updated the Licenses tab to calculate total costs based on **all purchased licenses** (consumed + available), not just the licenses in use. This provides a more accurate view of your actual Microsoft 365 spending.

## Changes Made

### 1. Total Cost Calculation

**Previous Calculation:**
```javascript
Total Cost = cost_per_unit × consumed_units
```

**New Calculation:**
```javascript
Total Cost = cost_per_unit × (consumed_units + available_units)
```

**Why?** You pay for all licenses you've purchased from Microsoft, whether they're assigned to users or not. The total cost should reflect your actual monthly bill.

### 2. New "Cost Savings" Column

Added a new column that shows potential monthly savings from unused licenses:

```javascript
Cost Savings = cost_per_unit × available_units
```

This helps you identify:
- Which licenses have unused units
- How much you could save by reducing those licenses
- Where to optimize your license allocation

### 3. New "Potential Savings" Summary Card

Added a fourth summary card showing total potential savings across all licenses:
- Calculates the total cost of all unused licenses
- Helps you see at a glance how much you could save
- Color-coded in green to highlight savings opportunity

## Example Scenario

**License: DEVELOPERPACK_E5**
- Cost per unit: £15.24 (GBP)
- Consumed units: 16
- Available units: 9
- Total units: 25

**Calculations:**
- **Total Cost**: £15.24 × 25 = **£381.00**
- **Cost Savings**: £15.24 × 9 = **£137.16**

This means:
- You're paying £381/month for this license
- You could save £137.16/month by removing 9 unused licenses

## Updated UI Components

### Summary Cards (4 cards total)

1. **Total License Types**
   - Count of different license SKUs
   - Icon: 📋

2. **Total Licenses Used**
   - Count of consumed licenses across all types
   - Icon: 👥

3. **Total Monthly Cost** (Updated)
   - Sum of all license costs (consumed + available)
   - Shows actual monthly spending
   - Currency icon based on primary currency
   - Icon: 💵/💶/💷/etc.

4. **Potential Savings** (New)
   - Sum of all unused license costs
   - Shows optimization opportunity
   - Helps identify waste
   - Icon: 💰
   - Color: Green

### License Table (8 columns total)

| Column | Description | Calculation |
|--------|-------------|-------------|
| License | SKU name | - |
| Consumed | Licenses in use | - |
| Available | Unused licenses | - |
| Utilization | Usage percentage | consumed / (consumed + available) × 100 |
| Cost/Unit | Monthly cost per license | User input |
| Total Cost | Total monthly cost | cost_per_unit × (consumed + available) |
| **Cost Savings** (New) | Potential savings from unused | cost_per_unit × available |
| Actions | Edit/Set cost button | - |

### Visual Indicators

**Cost Savings Column:**
- Green text color (success)
- Money bag icon: 💰
- Shows "-" if no available units or no cost set
- Formatted with currency symbol

## Benefits

### 1. Accurate Budgeting
- See your actual Microsoft 365 spend
- Understand total costs, not just what's being used
- Better financial planning and forecasting

### 2. Cost Optimization
- Identify licenses with high unused counts
- Calculate exact savings from license reduction
- Prioritize which licenses to optimize first

### 3. Better Decision Making
- Data-driven license purchases
- Understand the financial impact of unused licenses
- Support for license reduction requests to management

## Real-World Use Cases

### Scenario 1: End of Project
Your project ended and 10 E5 licenses (£35/each) are now unused.
- **Cost Savings**: £350/month = £4,200/year
- **Action**: Remove unused licenses at next renewal

### Scenario 2: Over-provisioning
You purchased 100 Business Premium licenses but only need 75.
- Cost per license: £12.50
- **Cost Savings**: £12.50 × 25 = £312.50/month = £3,750/year
- **Action**: Reduce license count by 25

### Scenario 3: License Type Optimization
You have 20 unused E5 licenses (£35) and need 20 E3 licenses (£20).
- **Current waste**: £700/month on unused E5
- **Potential action**: Convert to E3, save £15/license = £300/month

## Migration Notes

- No database changes required
- Calculations are client-side only
- Existing cost data remains unchanged
- Backward compatible with existing data

## Technical Details

### Cost Aggregation by Currency

```javascript
// Calculate total cost including all units
const costsByCurrency = licenses.reduce((acc, l) => {
  if (l.cost_per_unit) {
    const currency = l.currency || 'USD';
    const totalUnits = (l.consumed_units || 0) + (l.available_units || 0);
    const cost = l.cost_per_unit * totalUnits;
    acc[currency] = (acc[currency] || 0) + cost;
  }
  return acc;
}, {});

// Calculate potential savings
const savingsByCurrency = licenses.reduce((acc, l) => {
  if (l.cost_per_unit && l.available_units) {
    const currency = l.currency || 'USD';
    const savings = l.cost_per_unit * l.available_units;
    acc[currency] = (acc[currency] || 0) + savings;
  }
  return acc;
}, {});
```

### Per-License Calculations

```javascript
const totalUnits = (license.consumed_units || 0) + (license.available_units || 0);

const totalCost = license.cost_per_unit
  ? license.cost_per_unit * totalUnits
  : null;

const costSavings = license.cost_per_unit && license.available_units
  ? license.cost_per_unit * license.available_units
  : null;
```

## Tips for Using Cost Savings Data

1. **Sort by Savings**: Look at licenses with highest cost savings first
2. **Review Quarterly**: Check unused licenses during quarterly reviews
3. **Before Renewals**: Use savings data to negotiate license reductions
4. **Department Chargebacks**: Show departments their unused license costs
5. **Executive Reports**: Include total potential savings in budget reports

## Files Modified

- [frontend/src/components/dashboard/LicensesTab.jsx](frontend/src/components/dashboard/LicensesTab.jsx)
  - Updated cost calculations
  - Added savings calculations
  - Added 4th summary card
  - Added Cost Savings column
  - Updated grid layout to 4 columns

## Related Documentation

- [LICENSES-TAB-IMPLEMENTATION.md](LICENSES-TAB-IMPLEMENTATION.md) - Full feature documentation
- [CURRENCY-ICONS-UPDATE.md](CURRENCY-ICONS-UPDATE.md) - Currency icon feature
- [QUICK-START-LICENSES.md](QUICK-START-LICENSES.md) - Quick start guide
