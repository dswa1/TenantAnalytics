# Quick Start: Licenses Tab

## Step 1: Run Database Migration

Open your Supabase SQL Editor and run:

```sql
ALTER TABLE licenses
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS cost_notes TEXT,
ADD COLUMN IF NOT EXISTS cost_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cost_updated_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_sku_part_number ON licenses(sku_part_number);
```

## Step 2: Restart Backend (if running)

```bash
cd backend
npm start
```

## Step 3: Restart Frontend (if running)

```bash
cd frontend
npm start
```

## Step 4: Use the Licenses Tab

1. Log in to your application
2. Navigate to the Dashboard
3. Click on the **"Licenses"** tab
4. You'll see three summary cards:
   - Total License Types
   - Total Licenses Used
   - Estimated Monthly Cost

5. To add costs:
   - Click "Set Cost" on any license
   - Enter the monthly cost per license
   - Select currency (USD, EUR, GBP, etc.)
   - Add optional notes
   - Click "Save Cost"

## What You'll See

### Summary Section
- Count of different license types
- Total number of licenses in use
- Estimated monthly cost across all licenses

### License Table
Each license row shows:
- License SKU name (e.g., "ENTERPRISEPACK")
- Number of consumed licenses
- Number of available licenses
- Utilization percentage with color-coded bar
- Cost per unit (if set)
- Total monthly cost for that license
- "Set Cost" or "Edit Cost" button

### Features
- **Search**: Filter licenses by SKU name
- **Utilization Colors**:
  - 🟢 Green: Under 75% utilization
  - 🟡 Yellow: 75-90% utilization
  - 🔴 Red: Over 90% utilization

## Example License Costs

Common Microsoft 365 licenses (approximate USD pricing):

| License | Monthly Cost |
|---------|--------------|
| Microsoft 365 Business Basic | $6.00 |
| Microsoft 365 Business Standard | $12.50 |
| Microsoft 365 Business Premium | $22.00 |
| Office 365 E1 | $8.00 |
| Office 365 E3 | $20.00 |
| Office 365 E5 | $35.00 |
| Microsoft 365 E3 | $36.00 |
| Microsoft 365 E5 | $57.00 |

*Note: Prices vary by region and contract. Check with Microsoft or your reseller for accurate pricing.*

## Troubleshooting

### "No licenses found"
- Make sure you've run a sync to pull license data from Microsoft 365
- Go to Dashboard → Click "Sync Data"
- Wait for sync to complete

### Migration fails
- Check if columns already exist: `SELECT * FROM licenses LIMIT 1;`
- If columns exist, migration is already applied

### Costs not saving
- Check browser console for errors
- Verify you're logged in with proper permissions
- Check backend logs for API errors

## Tips

1. **Set costs for high-usage licenses first** - These will have the biggest impact on your budget
2. **Use notes field** - Track contract details, renewal dates, or special pricing
3. **Regular updates** - Update costs when renewing contracts or changing plans
4. **Multi-currency** - If you have licenses in different regions, use appropriate currency codes
