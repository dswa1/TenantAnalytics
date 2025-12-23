# Licenses Tab UI Examples

## Summary Cards View

```
┌─────────────────────────┐  ┌─────────────────────────┐  ┌─────────────────────────┐
│ Total License Types     │  │ Total Licenses Used     │  │ Estimated Monthly Cost  │
│                         │  │                         │  │                         │
│   15              📋    │  │   267             👥    │  │   💷 £4,523.42    💷    │
│                         │  │                         │  │   Multiple currencies   │
└─────────────────────────┘  └─────────────────────────┘  └─────────────────────────┘
```

## License Table View

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ License                    │ Consumed │ Available │ Utilization │ Cost/Unit │ Total  │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ENTERPRISEPACK            │    150   │     10    │ ██████ 94%  │ 💷 £15.24 │ 💷 £2,286│
│ Office 365 E3             │          │           │   (Red)     │           │         │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ MICROSOFT_365_E5          │     50   │     25    │ ████░░ 67%  │ 💵 $35.00 │ 💵 $1,750│
│ Microsoft 365 E5          │          │           │  (Green)    │           │         │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ POWER_BI_PRO             │     67   │      3    │ █████░ 96%  │ 💶 €9.99  │ 💶 €669  │
│ Power BI Pro              │          │           │   (Red)     │           │         │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Cost Edit Modal

### Before Setting Cost
```
┌─────────────────────────────────────────────────┐
│                Set License Cost                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  ENTERPRISEPACK                                 │
│  150 licenses in use                            │
│                                                 │
│  Cost per License (per month)                   │
│  ┌─────┐ ┌──────────────────────────────────┐  │
│  │ GBP │ │           15.24                  │  │
│  └─────┘ └──────────────────────────────────┘  │
│                                                 │
│  ╔═══════════════════════════════════════════╗ │
│  ║ Estimated monthly cost          💷        ║ │
│  ║                                           ║ │
│  ║                         GBP 243.84        ║ │
│  ║                                           ║ │
│  ║ Based on 16 licenses in use              ║ │
│  ╚═══════════════════════════════════════════╝ │
│                                                 │
│  Notes (optional)                               │
│  ┌───────────────────────────────────────────┐ │
│  │ Annual contract - renews Jan 2026         │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  [Cancel]                    [Save Cost]        │
└─────────────────────────────────────────────────┘
```

### With Different Currencies

#### USD Example
```
┌─────────────────────────────────────┐
│  Estimated monthly cost       💵   │
│                                     │
│              USD 1,750.00           │
│                                     │
│  Based on 50 licenses in use        │
└─────────────────────────────────────┘
```

#### EUR Example
```
┌─────────────────────────────────────┐
│  Estimated monthly cost       💶   │
│                                     │
│              EUR 669.33             │
│                                     │
│  Based on 67 licenses in use        │
└─────────────────────────────────────┘
```

#### JPY Example
```
┌─────────────────────────────────────┐
│  Estimated monthly cost       💴   │
│                                     │
│              JPY 234,500            │
│                                     │
│  Based on 100 licenses in use       │
└─────────────────────────────────────┘
```

## Mobile Responsive View

On smaller screens, the layout adapts:

```
┌──────────────────────────┐
│ Total License Types      │
│   15              📋     │
└──────────────────────────┘

┌──────────────────────────┐
│ Total Licenses Used      │
│   267             👥     │
└──────────────────────────┘

┌──────────────────────────┐
│ Estimated Monthly Cost   │
│   💷 £4,523.42    💷     │
│   Multiple currencies    │
└──────────────────────────┘

┌──────────────────────────┐
│ ENTERPRISEPACK          │
│ 💷 £15.24               │
│ ██████ 94% (150/160)    │
│ Total: 💷 £2,286        │
│ [Edit Cost]             │
└──────────────────────────┘
```

## Color Coding

### Utilization Bars
- 🟢 Green (0-74%): `bg-success`
- 🟡 Yellow (75-89%): `bg-warning`
- 🔴 Red (90-100%): `bg-danger`

### Status Badges
```
Licensed:  ✅ bg-green-100 text-green-800
Unlicensed: ⭕ bg-gray-100 text-gray-600
Active:    ✅ bg-green-100 text-green-800
Inactive:  ❌ bg-red-100 text-red-800
```

## Empty States

### No Licenses Found
```
┌────────────────────────────────────────────────┐
│                                                │
│                     📋                         │
│                                                │
│              No licenses found                 │
│                                                │
│  Sync data from Microsoft 365 to see licenses │
│                                                │
│              [Sync Data Now]                   │
│                                                │
└────────────────────────────────────────────────┘
```

### No Cost Set
```
Cost/Unit: Not set (gray text)
Total Cost: - (dash)
Action: [Set Cost] (blue link)
```

## Interactive Elements

### Search Box
```
┌────────────────────────────────────────────────┐
│ 🔍 Search licenses by SKU...                   │
└────────────────────────────────────────────────┘

Showing 8 of 15 licenses
```

### Hover States
- Table rows: `hover:bg-gray-50`
- Edit buttons: `hover:text-primary-dark`
- Action buttons: Darker shade on hover

### Loading States
```
┌────────────────────────────────────────────────┐
│                                                │
│                  ⏳ Loading...                 │
│                                                │
└────────────────────────────────────────────────┘
```

## Accessibility Features

1. **Semantic HTML**: Proper table structure with headers
2. **ARIA Labels**: Buttons and interactive elements labeled
3. **Keyboard Navigation**: Tab through form fields and buttons
4. **Color + Icon**: Not relying solely on color (icons included)
5. **Focus States**: Visible focus indicators on all interactive elements

## Example with Real Data

```
Microsoft 365 Licenses Overview
─────────────────────────────────────────────────────

Summary:
  📋 12 license types    👥 1,247 licenses    💵 $47,250.00/mo

Top Licenses by Cost:
1. Microsoft 365 E5         💵 $35.00 × 500  = $17,500.00
2. Office 365 E3            💷 £20.00 × 400  = £8,000.00
3. Power BI Premium         💵 $20.00 × 250  = $5,000.00
4. Azure AD Premium P2      💶 €6.00 × 300   = €1,800.00
5. Exchange Online Plan 2   💵 $8.00 × 150   = $1,200.00

Utilization Alerts:
⚠️  3 licenses over 90% capacity
✅  7 licenses healthy
📊  2 licenses under 50% (consider reducing)
```

## Tips for Users

1. **Set primary currency first**: Start with your most common currency
2. **Use notes field**: Track contract details, renewal dates
3. **Monitor utilization**: Red bars mean you need more licenses
4. **Search efficiently**: Use SKU part numbers for quick filtering
5. **Multi-currency**: Each license can have its own currency
