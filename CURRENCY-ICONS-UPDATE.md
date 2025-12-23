# Currency Icons Feature

## Overview
The Licenses tab now displays currency-appropriate icons throughout the interface to provide better visual context for costs.

## Currency Icon Mapping

| Currency | Icon | Description |
|----------|------|-------------|
| USD | 💵 | US Dollar |
| EUR | 💶 | Euro |
| GBP | 💷 | British Pound |
| JPY | 💴 | Japanese Yen |
| CAD | 💵 | Canadian Dollar |
| AUD | 💵 | Australian Dollar |
| CHF | 💵 | Swiss Franc |
| CNY | 💴 | Chinese Yuan |
| INR | 💵 | Indian Rupee |
| *Other* | 💰 | Default money bag icon |

## Where Icons Appear

### 1. Summary Card (Estimated Monthly Cost)
- Icon changes based on the primary currency in use
- Primary currency is determined by the currency with the highest total cost
- If multiple currencies are in use, shows "Multiple currencies in use" note

Example:
```
Estimated Monthly Cost
💷 £243.84
Multiple currencies in use
```

### 2. License Table - Cost/Unit Column
- Each license row shows its specific currency icon
- Icon appears next to the formatted cost

Example:
```
Cost/Unit
💷 £15.24
```

### 3. License Table - Total Cost Column
- Shows the currency icon for each license's total cost
- Calculated as: cost_per_unit × consumed_units

Example:
```
Total Cost
💷 £243.84
```

### 4. Cost Edit Modal - Estimated Cost Section
- Large currency icon in the estimated monthly cost preview
- Updates in real-time as you change the currency selector

Example:
```
Estimated monthly cost          💷 GBP 243.84
Based on 16 licenses in use
```

## Multi-Currency Support

### Handling Multiple Currencies

When you have licenses with different currencies:

1. **Summary Card**:
   - Shows the total in the primary currency (highest total cost)
   - Displays "Multiple currencies in use" indicator
   - Icon reflects the primary currency

2. **License Table**:
   - Each row displays its own currency and icon
   - Allows mixing currencies (e.g., USD for US licenses, GBP for UK licenses)

3. **Per-License Accuracy**:
   - Each license tracks its own currency
   - No automatic conversion between currencies
   - Gives you flexibility for multi-region management

### Example Scenario

```
License A: USD $20.00 × 100 = $2,000
License B: GBP £15.00 × 50 = £750
License C: EUR €18.00 × 30 = €540

Summary Card shows: 💵 $2,000 (USD is primary)
                    Multiple currencies in use
```

## Benefits

1. **Visual Clarity**: Quick identification of currency at a glance
2. **Multi-Region Support**: Manage licenses from different regions with their native currencies
3. **No Confusion**: Icons prevent misreading currency codes
4. **Professional Look**: Familiar currency symbols enhance UX

## Implementation Details

### Currency Icon Function

```javascript
const getCurrencyIcon = (currency) => {
  const icons = {
    'USD': '💵',
    'EUR': '💶',
    'GBP': '💷',
    'JPY': '💴',
    'CAD': '💵',
    'AUD': '💵',
    'CHF': '💵',
    'CNY': '💴',
    'INR': '💵'
  };
  return icons[currency] || '💰';
};
```

### Primary Currency Detection

```javascript
// Group costs by currency
const costsByCurrency = licenses.reduce((acc, l) => {
  if (l.cost_per_unit && l.consumed_units) {
    const currency = l.currency || 'USD';
    const cost = l.cost_per_unit * l.consumed_units;
    acc[currency] = (acc[currency] || 0) + cost;
  }
  return acc;
}, {});

// Get primary currency (highest total)
const primaryCurrency = Object.keys(costsByCurrency)
  .sort((a, b) => costsByCurrency[b] - costsByCurrency[a])[0] || 'USD';
```

## Adding New Currencies

To add support for additional currencies:

1. Add the currency to the icon mapping in both files:
   - `frontend/src/components/dashboard/LicensesTab.jsx`
   - `frontend/src/components/dashboard/LicenseCostModal.jsx`

2. Add the currency option to the dropdown in `LicenseCostModal.jsx`:
   ```jsx
   <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
     <option value="USD">USD</option>
     <option value="EUR">EUR</option>
     <option value="GBP">GBP</option>
     <!-- Add new currency here -->
   </select>
   ```

3. Choose an appropriate emoji from:
   - 💵 Dollar-based currencies
   - 💶 Euro
   - 💷 Pound Sterling
   - 💴 Yen/Yuan
   - 💰 Generic money (fallback)

## Browser Compatibility

Currency emojis are supported in all modern browsers:
- ✅ Chrome 72+
- ✅ Firefox 65+
- ✅ Safari 12.1+
- ✅ Edge 79+

For older browsers, emojis may render as text characters but functionality remains intact.
