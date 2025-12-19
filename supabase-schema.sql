-- M365 Tenant Manager - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tenants table (for multi-tenant support)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) UNIQUE NOT NULL,
    tenant_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    storage_type VARCHAR(50) DEFAULT 'supabase',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- Create tenant_analytics table (main data storage)
CREATE TABLE IF NOT EXISTS tenant_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    data_type VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_payload JSONB NOT NULL,
    user_id VARCHAR(255),
    metric_value NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- Create users table (cached user data)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    user_principal_name VARCHAR(255),
    account_enabled BOOLEAN DEFAULT true,
    created_datetime TIMESTAMP WITH TIME ZONE,
    last_sign_in TIMESTAMP WITH TIME ZONE,
    licenses JSONB,
    is_licensed BOOLEAN DEFAULT false,
    risk_level VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE(tenant_id, user_id)
);

-- Create licenses table (license tracking)
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    sku_id VARCHAR(255) NOT NULL,
    sku_part_number VARCHAR(255) NOT NULL,
    service_plans JSONB,
    prepaid_units JSONB,
    consumed_units INTEGER DEFAULT 0,
    available_units INTEGER DEFAULT 0,
    utilization_percentage NUMERIC(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE(tenant_id, sku_id)
);

-- Create security_events table (security monitoring)
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(50),
    user_id VARCHAR(255),
    device_id VARCHAR(255),
    event_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by VARCHAR(255),
    notes TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- Create mailboxes table (mailbox tracking)
CREATE TABLE IF NOT EXISTS mailboxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    user_principal_name VARCHAR(255),
    storage_used_bytes BIGINT,
    item_count INTEGER,
    last_activity_date TIMESTAMP WITH TIME ZONE,
    is_inactive BOOLEAN DEFAULT false,
    inactive_days INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE(tenant_id, user_id)
);

-- Create app_usage table (application usage tracking)
CREATE TABLE IF NOT EXISTS app_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    app_name VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    usage_date DATE NOT NULL,
    activity_count INTEGER DEFAULT 0,
    active_time_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- Create devices table (device inventory)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    operating_system VARCHAR(100),
    os_version VARCHAR(100),
    compliance_state VARCHAR(50),
    managed_device_owner_type VARCHAR(50),
    last_sync_datetime TIMESTAMP WITH TIME ZONE,
    is_compliant BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE(tenant_id, device_id)
);

-- Create remediation_actions table (audit trail)
CREATE TABLE IF NOT EXISTS remediation_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    target_user_id VARCHAR(255),
    target_resource VARCHAR(255),
    performed_by VARCHAR(255),
    action_data JSONB,
    status VARCHAR(50) DEFAULT 'completed',
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- Create conditional_access_policies table (policy tracking)
CREATE TABLE IF NOT EXISTS conditional_access_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    policy_id VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    state VARCHAR(50),
    conditions JSONB,
    grant_controls JSONB,
    session_controls JSONB,
    created_datetime TIMESTAMP WITH TIME ZONE,
    modified_datetime TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE(tenant_id, policy_id)
);

-- Create indexes for performance
CREATE INDEX idx_analytics_tenant_type ON tenant_analytics(tenant_id, data_type);
CREATE INDEX idx_analytics_timestamp ON tenant_analytics(timestamp DESC);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_licensed ON users(tenant_id, is_licensed);
CREATE INDEX idx_security_events_tenant ON security_events(tenant_id, timestamp DESC);
CREATE INDEX idx_security_events_unresolved ON security_events(tenant_id, resolved) WHERE NOT resolved;
CREATE INDEX idx_mailboxes_inactive ON mailboxes(tenant_id, is_inactive) WHERE is_inactive;
CREATE INDEX idx_app_usage_tenant_date ON app_usage(tenant_id, usage_date DESC);
CREATE INDEX idx_devices_compliance ON devices(tenant_id, is_compliant);
CREATE INDEX idx_remediation_tenant_time ON remediation_actions(tenant_id, timestamp DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mailboxes_updated_at BEFORE UPDATE ON mailboxes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON conditional_access_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries

-- Active users with licenses
CREATE OR REPLACE VIEW v_active_licensed_users AS
SELECT 
    u.tenant_id,
    u.user_id,
    u.display_name,
    u.user_principal_name,
    u.last_sign_in,
    u.licenses,
    COUNT(l.id) as license_count
FROM users u
LEFT JOIN licenses l ON u.tenant_id = l.tenant_id
WHERE u.account_enabled = true AND u.is_licensed = true
GROUP BY u.tenant_id, u.user_id, u.display_name, u.user_principal_name, u.last_sign_in, u.licenses;

-- Unused licenses summary
CREATE OR REPLACE VIEW v_unused_licenses AS
SELECT 
    tenant_id,
    sku_part_number,
    available_units,
    consumed_units,
    utilization_percentage,
    (available_units * 100.0 / NULLIF(prepaid_units->>'enabled', '0')::numeric) as waste_percentage
FROM licenses
WHERE available_units > 0;

-- Inactive mailboxes
CREATE OR REPLACE VIEW v_inactive_mailboxes AS
SELECT 
    m.tenant_id,
    m.user_id,
    m.user_principal_name,
    m.storage_used_bytes,
    m.last_activity_date,
    m.inactive_days,
    u.display_name,
    u.is_licensed
FROM mailboxes m
JOIN users u ON m.tenant_id = u.tenant_id AND m.user_id = u.user_id
WHERE m.is_inactive = true
ORDER BY m.inactive_days DESC;

-- Security risk summary
CREATE OR REPLACE VIEW v_security_risk_summary AS
SELECT 
    tenant_id,
    COUNT(*) FILTER (WHERE severity = 'high') as high_risk_events,
    COUNT(*) FILTER (WHERE severity = 'medium') as medium_risk_events,
    COUNT(*) FILTER (WHERE severity = 'low') as low_risk_events,
    COUNT(*) FILTER (WHERE NOT resolved) as unresolved_events,
    MAX(timestamp) as last_event_time
FROM security_events
GROUP BY tenant_id;

-- Device compliance summary
CREATE OR REPLACE VIEW v_device_compliance AS
SELECT 
    tenant_id,
    COUNT(*) as total_devices,
    COUNT(*) FILTER (WHERE is_compliant = true) as compliant_devices,
    COUNT(*) FILTER (WHERE is_compliant = false) as non_compliant_devices,
    ROUND((COUNT(*) FILTER (WHERE is_compliant = true)::numeric / NULLIF(COUNT(*), 0)) * 100, 2) as compliance_percentage
FROM devices
GROUP BY tenant_id;

-- Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditional_access_policies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your auth strategy)
-- Example: Users can only access their own tenant's data

-- Policy for tenants table
CREATE POLICY tenant_isolation_policy ON tenants
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Policy for tenant_analytics
CREATE POLICY analytics_isolation_policy ON tenant_analytics
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Policy for users
CREATE POLICY users_isolation_policy ON users
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Policy for licenses
CREATE POLICY licenses_isolation_policy ON licenses
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Policy for security_events
CREATE POLICY security_isolation_policy ON security_events
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Policy for mailboxes
CREATE POLICY mailboxes_isolation_policy ON mailboxes
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Policy for app_usage
CREATE POLICY app_usage_isolation_policy ON app_usage
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Policy for devices
CREATE POLICY devices_isolation_policy ON devices
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Policy for remediation_actions
CREATE POLICY remediation_isolation_policy ON remediation_actions
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Policy for conditional_access_policies
CREATE POLICY policies_isolation_policy ON conditional_access_policies
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Create function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(p_tenant_id VARCHAR)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.current_tenant_id', p_tenant_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sample data insertion function
CREATE OR REPLACE FUNCTION insert_sample_tenant()
RETURNS void AS $$
BEGIN
    INSERT INTO tenants (tenant_id, tenant_name, domain, storage_type)
    VALUES ('sample-tenant-123', 'Contoso Corporation', 'contoso.com', 'supabase')
    ON CONFLICT (tenant_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Execute sample data
SELECT insert_sample_tenant();

-- Grant permissions (adjust as needed for your auth setup)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
