-- Create app_usage table for storing Office 365 app usage data
CREATE TABLE IF NOT EXISTS app_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  user_principal_name TEXT NOT NULL,
  display_name TEXT,
  report_refresh_date DATE,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_date DATE,

  -- License information
  has_exchange_license BOOLEAN,
  has_onedrive_license BOOLEAN,
  has_sharepoint_license BOOLEAN,
  has_skype_license BOOLEAN,
  has_yammer_license BOOLEAN,
  has_teams_license BOOLEAN,

  -- Last activity dates
  exchange_last_activity_date DATE,
  onedrive_last_activity_date DATE,
  sharepoint_last_activity_date DATE,
  skype_last_activity_date DATE,
  yammer_last_activity_date DATE,
  teams_last_activity_date DATE,

  -- License assign dates
  exchange_license_assign_date DATE,
  onedrive_license_assign_date DATE,
  sharepoint_license_assign_date DATE,
  skype_license_assign_date DATE,
  yammer_license_assign_date DATE,
  teams_license_assign_date DATE,

  -- Assigned products
  assigned_products TEXT,

  -- Metadata
  period TEXT NOT NULL, -- D30, D90, D180
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint to prevent duplicate entries for same user/period
  UNIQUE(tenant_id, user_principal_name, period, report_refresh_date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_app_usage_tenant_id ON app_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_app_usage_user_principal_name ON app_usage(user_principal_name);
CREATE INDEX IF NOT EXISTS idx_app_usage_period ON app_usage(period);
CREATE INDEX IF NOT EXISTS idx_app_usage_synced_at ON app_usage(synced_at);

-- Add comment
COMMENT ON TABLE app_usage IS 'Stores Office 365 app usage data from Microsoft Graph reports';
