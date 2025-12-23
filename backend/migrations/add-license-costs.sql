-- Add cost tracking fields to licenses table
ALTER TABLE licenses
ADD COLUMN IF NOT EXISTS cost_per_unit NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS cost_notes TEXT,
ADD COLUMN IF NOT EXISTS cost_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cost_updated_by UUID REFERENCES profiles(id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_sku_part_number ON licenses(sku_part_number);

-- Add comment
COMMENT ON COLUMN licenses.cost_per_unit IS 'Manual cost per license unit';
COMMENT ON COLUMN licenses.currency IS 'Currency code (USD, EUR, GBP, etc.)';
COMMENT ON COLUMN licenses.cost_notes IS 'Notes about the license cost';
