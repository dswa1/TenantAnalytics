# Licenses Tab Implementation Summary

## Overview
Added a new "Licenses" tab to the dashboard that displays all Microsoft 365 licenses with the ability to manually add and manage license costs.

## Changes Made

### 1. Database Schema Enhancement
**File:** [backend/migrations/add-license-costs.sql](backend/migrations/add-license-costs.sql)

Added new columns to the `licenses` table:
- `cost_per_unit` - Manual cost per license unit (NUMERIC)
- `currency` - Currency code (VARCHAR, default: USD)
- `cost_notes` - Notes about the license cost (TEXT)
- `cost_updated_at` - Timestamp of last cost update
- `cost_updated_by` - User who last updated the cost

**To apply this migration:**
```sql
-- Run this in your Supabase SQL Editor
-- See: backend/migrations/add-license-costs.sql
```

### 2. Backend API Endpoints
**File:** [backend/routes/data.js](backend/routes/data.js)

Added two new endpoints:

#### GET /api/data/licenses
- Retrieves all licenses for the current tenant
- Returns list with count
- Requires authentication and tenant context

#### PUT /api/data/licenses/:id/cost
- Updates cost information for a specific license
- Validates license belongs to tenant
- Tracks who updated the cost and when
- Body parameters:
  - `cost_per_unit` (number, optional)
  - `currency` (string, default: USD)
  - `cost_notes` (string, optional)

### 3. Frontend Components

#### LicensesTab Component
**File:** [frontend/src/components/dashboard/LicensesTab.jsx](frontend/src/components/dashboard/LicensesTab.jsx)

Features:
- **Summary Cards**:
  - Total License Types count
  - Total Licenses Used count
  - Estimated Monthly Cost (calculated from cost_per_unit × consumed_units)

- **License List Table**:
  - License SKU name
  - Consumed units
  - Available units
  - Utilization percentage (with color-coded progress bar)
  - Cost per unit
  - Total cost calculation
  - Edit/Set cost button

- **Search functionality** by SKU name

#### LicenseCostModal Component
**File:** [frontend/src/components/dashboard/LicenseCostModal.jsx](frontend/src/components/dashboard/LicenseCostModal.jsx)

Modal for editing license costs:
- Currency selector (USD, EUR, GBP, CAD, AUD)
- Cost per unit input field
- Estimated total cost preview
- Notes field for additional information
- Form validation

### 4. Utility Functions
**File:** [frontend/src/utils/formatters.js](frontend/src/utils/formatters.js)

Added `formatCurrency()` function:
- Formats numbers as currency with proper symbols
- Supports multiple currencies
- Fallback for unsupported currencies
- Configurable decimal places

### 5. Dashboard Integration
**Files:**
- [frontend/src/utils/constants.js](frontend/src/utils/constants.js#L73-L79) - Added LICENSES to DASHBOARD_TABS
- [frontend/src/components/dashboard/Dashboard.jsx](frontend/src/components/dashboard/Dashboard.jsx) - Imported and rendered LicensesTab

## Features

### License Cost Management
1. **View All Licenses**: See all Microsoft 365 licenses synced from Azure AD
2. **Track Utilization**: Visual progress bars showing license usage percentage
3. **Add Costs Manually**: Set cost per license for budget tracking
4. **Currency Support**: Multiple currency options (USD, EUR, GBP, CAD, AUD)
5. **Total Cost Calculation**: Automatic calculation of monthly costs
6. **Notes**: Add context or details about specific licenses
7. **Search**: Filter licenses by SKU name

### UI/UX
- Color-coded utilization bars:
  - Green: < 75% utilization
  - Yellow: 75-90% utilization
  - Red: > 90% utilization
- Responsive design with summary cards
- Clean modal interface for editing costs
- Real-time cost calculations

## Usage

### Setting License Costs
1. Navigate to the **Licenses** tab in the dashboard
2. Find the license you want to set a cost for
3. Click "Set Cost" or "Edit Cost"
4. Enter the cost per unit and select currency
5. Optionally add notes
6. Click "Save Cost"

### Viewing Cost Summary
The top of the Licenses tab shows:
- Total number of license types
- Total licenses currently in use
- Estimated monthly cost (sum of all license costs)

### Cost Calculation
Total cost = `cost_per_unit × consumed_units`

Example:
- License: Office 365 E3
- Cost per unit: $20.00
- Consumed units: 50
- Total monthly cost: $1,000.00

## Database Migration

**IMPORTANT:** Before using the Licenses tab, run the migration:

```sql
-- In Supabase SQL Editor, run:
ALTER TABLE licenses
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS cost_notes TEXT,
ADD COLUMN IF NOT EXISTS cost_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cost_updated_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_sku_part_number ON licenses(sku_part_number);
```

Or run the full migration file: [backend/migrations/add-license-costs.sql](backend/migrations/add-license-costs.sql)

## API Examples

### Get All Licenses
```javascript
GET /api/data/licenses
Headers: {
  'X-Tenant-ID': 'your-tenant-id',
  'Authorization': 'Bearer your-token'
}

Response:
{
  "success": true,
  "licenses": [
    {
      "id": "uuid",
      "sku_part_number": "ENTERPRISEPACK",
      "consumed_units": 50,
      "available_units": 10,
      "utilization_percentage": 83.33,
      "cost_per_unit": 20.00,
      "currency": "USD",
      "cost_notes": "Annual contract"
    }
  ],
  "count": 1
}
```

### Update License Cost
```javascript
PUT /api/data/licenses/:id/cost
Headers: {
  'X-Tenant-ID': 'your-tenant-id',
  'Authorization': 'Bearer your-token'
}
Body: {
  "cost_per_unit": 20.00,
  "currency": "USD",
  "cost_notes": "Annual contract pricing"
}

Response:
{
  "success": true,
  "message": "License cost updated successfully",
  "license": { ... }
}
```

## Future Enhancements

Potential improvements:
1. **Cost History**: Track cost changes over time
2. **Budget Alerts**: Notify when costs exceed thresholds
3. **Bulk Cost Import**: Import costs from CSV
4. **Cost Reports**: Export cost analysis reports
5. **Forecast**: Predict future costs based on trends
6. **Comparison**: Compare costs across tenants
7. **Annual vs Monthly**: Toggle between monthly/annual cost views

## Testing

To test the implementation:
1. Run the database migration
2. Sync licenses from Microsoft 365
3. Navigate to the Licenses tab
4. Set costs for a few licenses
5. Verify the total cost calculation
6. Test currency conversion display
7. Check search functionality

## Notes

- License costs are tenant-specific
- Costs must be entered manually (not synced from Microsoft)
- Currency is stored per license (can have different currencies)
- Total cost summary uses the displayed currency
- Cost updates are tracked with timestamp and user ID
