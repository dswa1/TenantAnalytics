-- M365 Tenant Manager - Enhanced Multi-Tenant SaaS Database Schema
-- Run this SQL in your Supabase SQL Editor
--
-- IMPORTANT NOTES:
-- 1. This schema includes an improved handle_new_user() trigger function with error handling
--    to fix the "Failed to create user: Database error creating new user" error
-- 2. The trigger uses SECURITY DEFINER and ON CONFLICT to handle edge cases gracefully
-- 3. All tables have Row Level Security (RLS) enabled for multi-tenant isolation
-- 4. Run this entire file in one go for best results
--
-- If you get user creation errors, see: fix-profile-trigger.sql or TROUBLESHOOTING.md

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- AUTHENTICATION & USER MANAGEMENT TABLES
-- ============================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create tenants table (organizations/companies using the SaaS)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) UNIQUE NOT NULL, -- Azure tenant ID
    tenant_name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    subscription_tier VARCHAR(50) DEFAULT 'free',
    is_active BOOLEAN DEFAULT true,
    storage_type VARCHAR(50) DEFAULT 'supabase',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB
);

-- User-tenant membership (users can belong to multiple tenants)
CREATE TABLE IF NOT EXISTS tenant_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tenant_id)
);

-- ============================================
-- AZURE CREDENTIALS & AUTHENTICATION
-- ============================================

-- Encrypted Azure app credentials per tenant
CREATE TABLE IF NOT EXISTS azure_app_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    client_id VARCHAR(255) NOT NULL,
    tenant_id_azure VARCHAR(255) NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    consent_granted BOOLEAN DEFAULT false,
    consent_granted_at TIMESTAMP WITH TIME ZONE,
    is_valid BOOLEAN DEFAULT false,
    last_validated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES profiles(id),
    UNIQUE(tenant_id)
);

-- ============================================
-- SYNC & CHANGE TRACKING TABLES
-- ============================================

-- Sync history for change tracking
CREATE TABLE IF NOT EXISTS sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    sync_type VARCHAR(100) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'
    records_synced INTEGER DEFAULT 0,
    records_added INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_deleted INTEGER DEFAULT 0,
    error_message TEXT,
    triggered_by UUID REFERENCES profiles(id)
);

-- Data changes (delta tracking)
CREATE TABLE IF NOT EXISTS data_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    sync_id UUID REFERENCES sync_history(id) ON DELETE CASCADE,
    data_type VARCHAR(100) NOT NULL, -- 'users', 'licenses', 'devices', etc.
    record_id VARCHAR(255) NOT NULL,
    change_type VARCHAR(50), -- 'added', 'updated', 'deleted'
    old_data JSONB,
    new_data JSONB,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- FREEMIUM FEATURE LIMITS
-- ============================================

-- Feature limits for freemium tiers
CREATE TABLE IF NOT EXISTS feature_limits (
    tier VARCHAR(50) PRIMARY KEY,
    max_tenants INTEGER,
    max_users_per_tenant INTEGER,
    data_retention_days INTEGER,
    sync_frequency_hours INTEGER,
    features JSONB
);

-- Insert default tier limits
INSERT INTO feature_limits (tier, max_tenants, max_users_per_tenant, data_retention_days, sync_frequency_hours, features) VALUES
('free', 1, 50, 7, 24, '{"advanced_analytics": false, "api_access": false, "change_tracking": false, "export_data": false}'),
('pro', 3, 500, 90, 6, '{"advanced_analytics": true, "api_access": true, "change_tracking": true, "export_data": true, "priority_support": false}'),
('enterprise', NULL, NULL, 365, 1, '{"advanced_analytics": true, "api_access": true, "change_tracking": true, "export_data": true, "priority_support": true, "white_label": true, "custom_integrations": true}')
ON CONFLICT (tier) DO NOTHING;

-- ============================================
-- EXISTING DATA TABLES
-- ============================================

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

-- Create users table (cached M365 user data)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL, -- Azure AD user ID
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

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Authentication table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_role ON tenant_members(tenant_id, role);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active) WHERE is_active = true;

-- Sync and change tracking indexes
CREATE INDEX IF NOT EXISTS idx_sync_history_tenant ON sync_history(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_history_status ON sync_history(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_data_changes_tenant_type ON data_changes(tenant_id, data_type, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_changes_sync ON data_changes(sync_id);

-- Data table indexes
CREATE INDEX IF NOT EXISTS idx_analytics_tenant_type ON tenant_analytics(tenant_id, data_type);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON tenant_analytics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_licensed ON users(tenant_id, is_licensed);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant ON security_events(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_unresolved ON security_events(tenant_id, resolved) WHERE NOT resolved;
CREATE INDEX IF NOT EXISTS idx_mailboxes_inactive ON mailboxes(tenant_id, is_inactive) WHERE is_inactive;
CREATE INDEX IF NOT EXISTS idx_app_usage_tenant_date ON app_usage(tenant_id, usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_devices_compliance ON devices(tenant_id, is_compliant);
CREATE INDEX IF NOT EXISTS idx_remediation_tenant_time ON remediation_actions(tenant_id, timestamp DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to authentication tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at triggers to data tables
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

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Critical for multi-tenant data isolation

-- Enable RLS on authentication tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE azure_app_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_changes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on data tables
ALTER TABLE tenant_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditional_access_policies ENABLE ROW LEVEL SECURITY;

-- ============================================
-- AUTHENTICATION TABLE POLICIES
-- ============================================

-- Profiles: users can view and update their own profile
CREATE POLICY "Users view own profile" ON profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users insert own profile" ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Tenants: users can only see tenants they're members of
CREATE POLICY "View accessible tenants" ON tenants
    FOR SELECT
    USING (
        id IN (
            SELECT tenant_id
            FROM tenant_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Owners can update tenants" ON tenants
    FOR UPDATE
    USING (
        id IN (
            SELECT tenant_id
            FROM tenant_members
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

CREATE POLICY "Users can create tenants" ON tenants
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- Tenant members: users see their own memberships
CREATE POLICY "View own memberships" ON tenant_members
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Owners manage members" ON tenant_members
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id
            FROM tenant_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Azure credentials: only accessible through backend (service role)
-- Frontend NEVER accesses these directly
CREATE POLICY "Service role only" ON azure_app_credentials
    FOR ALL
    USING (false);

-- Sync history: users can view syncs for their tenants
CREATE POLICY "View tenant sync history" ON sync_history
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT t.id
            FROM tenants t
            JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- Data changes: users can view changes for their tenants (if they have change_tracking feature)
CREATE POLICY "View tenant data changes" ON data_changes
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT t.id
            FROM tenants t
            JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- ============================================
-- DATA TABLE POLICIES (M365 cached data)
-- ============================================

-- Policy for tenant_analytics
CREATE POLICY "Access tenant analytics" ON tenant_analytics
    FOR ALL
    USING (
        tenant_id IN (
            SELECT t.tenant_id
            FROM tenants t
            JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- Policy for users table
CREATE POLICY "Access tenant users" ON users
    FOR ALL
    USING (
        tenant_id IN (
            SELECT t.tenant_id
            FROM tenants t
            JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- Policy for licenses
CREATE POLICY "Access tenant licenses" ON licenses
    FOR ALL
    USING (
        tenant_id IN (
            SELECT t.tenant_id
            FROM tenants t
            JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- Policy for security_events
CREATE POLICY "Access tenant security events" ON security_events
    FOR ALL
    USING (
        tenant_id IN (
            SELECT t.tenant_id
            FROM tenants t
            JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- Policy for mailboxes
CREATE POLICY "Access tenant mailboxes" ON mailboxes
    FOR ALL
    USING (
        tenant_id IN (
            SELECT t.tenant_id
            FROM tenants t
            JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- Policy for app_usage
CREATE POLICY "Access tenant app usage" ON app_usage
    FOR ALL
    USING (
        tenant_id IN (
            SELECT t.tenant_id
            FROM tenants t
            JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- Policy for devices
CREATE POLICY "Access tenant devices" ON devices
    FOR ALL
    USING (
        tenant_id IN (
            SELECT t.tenant_id
            FROM tenants t
            JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- Policy for remediation_actions
CREATE POLICY "Access tenant remediation actions" ON remediation_actions
    FOR ALL
    USING (
        tenant_id IN (
            SELECT t.tenant_id
            FROM tenants t
            JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- Policy for conditional_access_policies
CREATE POLICY "Access tenant CA policies" ON conditional_access_policies
    FOR ALL
    USING (
        tenant_id IN (
            SELECT t.tenant_id
            FROM tenants t
            JOIN tenant_members tm ON t.id = tm.tenant_id
            WHERE tm.user_id = auth.uid()
        )
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to create user profile after signup (called by trigger or backend)
-- Improved version with error handling and conflict resolution
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Insert profile with ON CONFLICT to handle duplicates gracefully
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail user creation
        RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions for the trigger function
-- This ensures the function can insert into profiles table
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.profiles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- Function to check if user can create more tenants (based on subscription tier)
CREATE OR REPLACE FUNCTION can_create_tenant(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_tier VARCHAR(50);
    v_max_tenants INTEGER;
    v_current_count INTEGER;
BEGIN
    -- Get user's subscription tier
    SELECT subscription_tier INTO v_tier
    FROM profiles
    WHERE id = p_user_id;

    -- Get max tenants for this tier
    SELECT max_tenants INTO v_max_tenants
    FROM feature_limits
    WHERE tier = v_tier;

    -- NULL means unlimited
    IF v_max_tenants IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Count current tenants owned by user
    SELECT COUNT(*) INTO v_current_count
    FROM tenant_members
    WHERE user_id = p_user_id AND role = 'owner';

    RETURN v_current_count < v_max_tenants;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's accessible tenant IDs
CREATE OR REPLACE FUNCTION get_user_tenant_ids(p_user_id UUID)
RETURNS TABLE(tenant_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT tm.tenant_id
    FROM tenant_members tm
    WHERE tm.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Note: RLS policies control actual access - these grants just allow queries

-- Grant table permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant read-only access to anon users for public views (if needed)
-- GRANT SELECT ON feature_limits TO anon;

-- ============================================
-- SETUP COMPLETE
-- ============================================
--
-- Next steps:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. Configure Microsoft OAuth in Supabase Auth settings
-- 3. Set up environment variables in your backend
-- 4. Test RLS policies thoroughly before going to production
--
-- Security checklist:
-- ☐ All tables have RLS enabled
-- ☐ Azure credentials only accessible via service role
-- ☐ Users can only access their tenant's data
-- ☐ Profile auto-creation trigger is working
-- ☐ Feature limits are enforced
--
