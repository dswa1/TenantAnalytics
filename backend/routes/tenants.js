const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { setTenantContext, requireRole } = require('../middleware/tenantContext');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/tenants
 * List all tenants the authenticated user has access to
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('tenant_members')
    .select(`
      *,
      tenants (
        id,
        tenant_id,
        tenant_name,
        domain,
        subscription_tier,
        is_active,
        created_at,
        updated_at,
        metadata
      )
    `)
    .eq('user_id', req.user.id);

  if (error) {
    throw new Error(`Failed to fetch tenants: ${error.message}`);
  }

  // Transform data to return tenants with membership info
  const tenants = data.map(membership => ({
    ...membership.tenants,
    role: membership.role,
    joined_at: membership.joined_at
  }));

  res.json({
    success: true,
    tenants,
    count: tenants.length
  });
}));

/**
 * GET /api/tenants/stats/users
 * Get user count for tenant
 */
router.get('/stats/users', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { count, error } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', req.tenant.tenant_id);

  if (error) {
    throw new Error(`Failed to fetch user count: ${error.message}`);
  }

  res.json({ count: count || 0 });
}));

/**
 * GET /api/tenants/stats/licenses
 * Get license count for tenant
 */
router.get('/stats/licenses', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { count, error } = await supabase
    .from('licenses')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', req.tenant.tenant_id);

  if (error) {
    throw new Error(`Failed to fetch license count: ${error.message}`);
  }

  res.json({ count: count || 0 });
}));

/**
 * GET /api/tenants/stats/mailboxes
 * Get mailbox storage total for tenant
 */
router.get('/stats/mailboxes', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('mailboxes')
    .select('storage_used_bytes')
    .eq('tenant_id', req.tenant.tenant_id);

  if (error) {
    throw new Error(`Failed to fetch mailbox stats: ${error.message}`);
  }

  const total = (data || []).reduce((sum, m) => sum + (m.storage_used_bytes || 0), 0);
  res.json({ total, count: data?.length || 0 });
}));

/**
 * GET /api/tenants/stats/security
 * Get security events count for tenant
 */
router.get('/stats/security', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { count, error } = await supabase
    .from('security_events')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', req.tenant.tenant_id);

  if (error) {
    throw new Error(`Failed to fetch security events count: ${error.message}`);
  }

  res.json({ count: count || 0 });
}));

/**
 * GET /api/tenants/stats/cost-savings
 * Calculate comprehensive cost savings from unused licenses, inactive users, and underutilized apps
 */
router.get('/stats/cost-savings', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  // Step 1: Get all licenses with cost data
  const { data: licenses, error: licError } = await supabase
    .from('licenses')
    .select('*')
    .eq('tenant_id', req.tenant.tenant_id)
    .not('cost_per_unit', 'is', null);

  if (licError) {
    throw new Error(`Failed to fetch licenses: ${licError.message}`);
  }

  // If no licenses with costs, return zero savings
  if (!licenses || licenses.length === 0) {
    return res.json({
      success: true,
      total_monthly_savings: {},
      primary_currency: 'USD',
      primary_savings: 0,
      savings_breakdown: {
        unused_licenses: 0,
        inactive_users: 0,
        underutilized_apps: 0
      },
      users_needing_attention: [],
      users_count: 0,
      licenses_with_costs: 0
    });
  }

  // Step 2: Calculate unused license savings and create entries for unused licenses
  const savingsByCurrency = {};
  const unusedLicenseSavings = {};
  const itemsNeedingAttention = [];

  licenses.forEach(license => {
    if (license.available_units > 0 && license.cost_per_unit) {
      const currency = license.currency || 'USD';
      const savings = license.cost_per_unit * license.available_units;
      savingsByCurrency[currency] = (savingsByCurrency[currency] || 0) + savings;
      unusedLicenseSavings[currency] = (unusedLicenseSavings[currency] || 0) + savings;

      // Add unused license as an actionable item
      itemsNeedingAttention.push({
        user_principal_name: null,
        display_name: `${license.sku_part_number} (Unused Licenses)`,
        issue_type: 'unused_license',
        days_inactive: null,
        assigned_licenses: [{
          sku_part_number: license.sku_part_number,
          cost_per_unit: license.cost_per_unit,
          currency: currency
        }],
        available_units: license.available_units,
        potential_savings: savings,
        currency: currency,
        recommendation: `${license.available_units} unused license${license.available_units !== 1 ? 's' : ''} - consider reducing subscription or reallocating`
      });
    }
  });

  // Step 3: Get app usage data - use the most recent period available
  // Note: app_usage.tenant_id uses tenants.tenant_id (Microsoft tenant ID) for consistency with users/licenses
  console.log(`[Cost Savings] Querying app_usage with tenant_id: ${req.tenant.tenant_id}`);

  // First, get the most recent app usage data regardless of period
  const { data: appUsage, error: appError } = await supabase
    .from('app_usage')
    .select('*')
    .eq('tenant_id', req.tenant.tenant_id)
    .order('synced_at', { ascending: false });

  if (appError) {
    console.error('Error fetching app_usage:', appError);
  }

  // Determine the period and inactivity threshold dynamically
  let inactivityThresholdDays = 90; // default
  let detectedPeriod = 'unknown';

  if (appUsage && appUsage.length > 0) {
    detectedPeriod = appUsage[0].period;
    // Set threshold based on detected period
    if (detectedPeriod === 'D7') {
      inactivityThresholdDays = 7;
    } else if (detectedPeriod === 'D30') {
      inactivityThresholdDays = 30;
    } else if (detectedPeriod === 'D90') {
      inactivityThresholdDays = 90;
    } else if (detectedPeriod === 'D180') {
      inactivityThresholdDays = 180;
    }
  }

  console.log(`[Cost Savings] Found ${appUsage?.length || 0} app_usage records for period ${detectedPeriod}, using ${inactivityThresholdDays}-day threshold`);

  if (appUsage && appUsage.length > 0) {
    // Log sample of records with null activity dates
    const samplesWithNullActivity = appUsage.filter(u =>
      !u.exchange_last_activity_date && !u.teams_last_activity_date
    ).slice(0, 3);
    if (samplesWithNullActivity.length > 0) {
      console.log(`[Cost Savings] Sample users with null activity dates:`,
        samplesWithNullActivity.map(u => ({
          user: u.user_principal_name,
          has_exchange_license: u.has_exchange_license,
          exchange_last_activity_date: u.exchange_last_activity_date,
          has_teams_license: u.has_teams_license,
          teams_last_activity_date: u.teams_last_activity_date
        }))
      );
    }
  }

  // Step 4: Get ALL users with licenses (including disabled accounts)
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', req.tenant.tenant_id)
    .eq('is_licensed', true);

  if (userError) {
    throw new Error(`Failed to fetch users: ${userError.message}`);
  }

  // Step 5: Calculate inactive user license costs and underutilized apps
  const inactiveUserSavings = {};
  const underutilizedAppSavings = {};
  const inactivityThreshold = new Date();
  inactivityThreshold.setDate(inactivityThreshold.getDate() - inactivityThresholdDays);

  // Create lookup maps
  const appUsageByUser = {};
  if (appUsage && appUsage.length > 0) {
    appUsage.forEach(usage => {
      appUsageByUser[usage.user_principal_name] = usage;
    });
  }

  const licenseBySku = {};
  licenses.forEach(license => {
    licenseBySku[license.sku_id] = license;
  });

  // App-specific cost mapping (approximate percentage of bundle license)
  const appCostPercentages = {
    exchange: 0.25,
    onedrive: 0.15,
    sharepoint: 0.15,
    teams: 0.25,
    skype: 0.10,
    yammer: 0.10
  };

  // Process each user
  if (users && users.length > 0) {
    users.forEach(user => {
      if (!user.licenses || user.licenses.length === 0) {
        return;
      }

      // Get user's app usage record
      const userAppUsage = appUsageByUser[user.user_principal_name];

      // Check if user is inactive (multiple criteria)
      let isInactive = false;
      let daysInactive = null;
      let inactivityReason = '';

      // Criteria 1: Account is disabled
      if (!user.account_enabled) {
        isInactive = true;
        inactivityReason = 'account disabled';
      }

      // Criteria 2: No sign-in in last N days (based on detected period)
      if (!isInactive && user.last_sign_in) {
        const lastSignIn = new Date(user.last_sign_in);
        if (lastSignIn < inactivityThreshold) {
          isInactive = true;
          daysInactive = Math.floor((new Date() - lastSignIn) / (1000 * 60 * 60 * 24));
          inactivityReason = 'no sign-in';
        }
      }

      // Criteria 3: App usage data shows ZERO activity across ALL apps
      // Only mark as completely inactive if user has NO activity whatsoever
      // If they're using at least one app, they're active (we'll check individual apps later)
      if (!isInactive && userAppUsage) {
        const activityDates = [
          userAppUsage.exchange_last_activity_date,
          userAppUsage.onedrive_last_activity_date,
          userAppUsage.sharepoint_last_activity_date,
          userAppUsage.teams_last_activity_date,
          userAppUsage.skype_last_activity_date,
          userAppUsage.yammer_last_activity_date
        ].filter(d => d);

        // User is inactive ONLY if they have NO activity dates at all
        if (activityDates.length === 0) {
          isInactive = true;
          daysInactive = null;
          inactivityReason = 'no app usage';
        }
        // If they have ANY activity dates, don't mark as inactive
        // Even if all dates are old - we'll handle that in underutilized apps
      }

      // Calculate user's license costs
      if (isInactive) {
        const userLicenses = [];
        let userTotalSavings = 0;
        let userCurrency = 'USD';

        user.licenses.forEach(userLicense => {
          const license = licenseBySku[userLicense.skuId];
          if (license && license.cost_per_unit) {
            userCurrency = license.currency || 'USD';
            userTotalSavings += license.cost_per_unit;
            userLicenses.push({
              sku_part_number: license.sku_part_number,
              cost_per_unit: license.cost_per_unit,
              currency: license.currency || 'USD'
            });
          }
        });

        if (userTotalSavings > 0) {
          inactiveUserSavings[userCurrency] = (inactiveUserSavings[userCurrency] || 0) + userTotalSavings;
          savingsByCurrency[userCurrency] = (savingsByCurrency[userCurrency] || 0) + userTotalSavings;

          // Build recommendation message
          let recommendation = '';
          if (inactivityReason === 'account disabled') {
            recommendation = 'Account is disabled - consider removing licenses';
          } else if (daysInactive) {
            recommendation = `User inactive for ${daysInactive} days (${inactivityReason}) - consider license removal`;
          } else {
            recommendation = `User has ${inactivityReason} - consider license removal`;
          }

          itemsNeedingAttention.push({
            user_principal_name: user.user_principal_name,
            display_name: user.display_name,
            issue_type: 'inactive_user',
            days_inactive: daysInactive,
            assigned_licenses: userLicenses,
            potential_savings: userTotalSavings,
            currency: userCurrency,
            recommendation: recommendation
          });
        }
      } else if (userAppUsage) {
        // User is NOT inactive, but check for underutilized apps
        // Check each app individually for license but no usage
        const apps = ['exchange', 'onedrive', 'sharepoint', 'teams', 'skype', 'yammer'];

        apps.forEach(app => {
          const hasLicense = userAppUsage[`has_${app}_license`];
          const lastActivityDate = userAppUsage[`${app}_last_activity_date`];

          // Check if user has license but no activity (or activity beyond threshold)
          if (hasLicense) {
            let isUnderutilized = false;

            if (!lastActivityDate) {
              isUnderutilized = true;
            } else {
              const lastActivity = new Date(lastActivityDate);
              if (lastActivity < inactivityThreshold) {
                isUnderutilized = true;
              }
            }

            if (isUnderutilized) {
              // Calculate app-specific cost from user's licenses
              let appCost = 0;
              let appCurrency = 'USD';
              const userLicenses = [];

              user.licenses.forEach(userLicense => {
                const license = licenseBySku[userLicense.skuId];
                if (license && license.cost_per_unit) {
                  // Calculate fractional cost for this app
                  const fractionalCost = license.cost_per_unit * (appCostPercentages[app] || 0.15);
                  appCost += fractionalCost;
                  appCurrency = license.currency || 'USD';

                  userLicenses.push({
                    sku_part_number: license.sku_part_number,
                    cost_per_unit: license.cost_per_unit,
                    currency: license.currency || 'USD'
                  });
                }
              });

              if (appCost > 0) {
                underutilizedAppSavings[appCurrency] = (underutilizedAppSavings[appCurrency] || 0) + appCost;
                savingsByCurrency[appCurrency] = (savingsByCurrency[appCurrency] || 0) + appCost;

                const appDisplayName = app.charAt(0).toUpperCase() + app.slice(1);
                const daysUnused = lastActivityDate
                  ? Math.floor((new Date() - new Date(lastActivityDate)) / (1000 * 60 * 60 * 24))
                  : null;

                itemsNeedingAttention.push({
                  user_principal_name: user.user_principal_name,
                  display_name: user.display_name,
                  issue_type: 'underutilized_app',
                  app_name: appDisplayName,
                  days_inactive: daysUnused,
                  assigned_licenses: userLicenses,
                  potential_savings: appCost,
                  currency: appCurrency,
                  recommendation: daysUnused
                    ? `${appDisplayName} license not used for ${daysUnused} days - consider removing app access`
                    : `${appDisplayName} license never used - consider removing app access`
                });
              }
            }
          }
        });
      }
      // Note: Users without app usage data are skipped for underutilized app detection
    });
  }

  // Step 6: Calculate primary currency and totals
  const primaryCurrency = Object.keys(savingsByCurrency).sort((a, b) =>
    savingsByCurrency[b] - savingsByCurrency[a]
  )[0] || 'USD';

  const primarySavings = savingsByCurrency[primaryCurrency] || 0;

  // Sort items by potential savings (descending) and limit to top 50
  itemsNeedingAttention.sort((a, b) => b.potential_savings - a.potential_savings);
  const limitedItems = itemsNeedingAttention.slice(0, 50);

  // Step 7: Return structured response
  res.json({
    success: true,
    total_monthly_savings: savingsByCurrency,
    primary_currency: primaryCurrency,
    primary_savings: primarySavings,
    savings_breakdown: {
      unused_licenses: unusedLicenseSavings[primaryCurrency] || 0,
      inactive_users: inactiveUserSavings[primaryCurrency] || 0,
      underutilized_apps: underutilizedAppSavings[primaryCurrency] || 0
    },
    users_needing_attention: limitedItems,
    users_count: limitedItems.length,
    licenses_with_costs: licenses.length,
    inactive_users_checked: appUsage && appUsage.length > 0
  });
}));

/**
 * GET /api/tenants/:id
 * Get details of a specific tenant
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const tenantId = req.params.id;

  // Verify user has access
  const { data: membership, error: membershipError } = await supabase
    .from('tenant_members')
    .select(`
      *,
      tenants (*)
    `)
    .eq('user_id', req.user.id)
    .eq('tenant_id', tenantId)
    .single();

  if (membershipError || !membership) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this tenant'
    });
  }

  // Get member count
  const { count: memberCount } = await supabase
    .from('tenant_members')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  res.json({
    success: true,
    tenant: {
      ...membership.tenants,
      role: membership.role,
      member_count: memberCount
    }
  });
}));

/**
 * POST /api/tenants
 * Create a new tenant
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { tenant_id, tenant_name, domain } = req.body;

  // Validate required fields
  if (!tenant_id || !tenant_name) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'tenant_id and tenant_name are required'
    });
  }

  // Check if user can create more tenants (tier limits)
  const { data: canCreate, error: limitError } = await supabase
    .rpc('can_create_tenant', { p_user_id: req.user.id });

  if (limitError) {
    throw new Error(`Failed to check tenant limits: ${limitError.message}`);
  }

  if (!canCreate) {
    const tier = req.profile?.subscription_tier || 'free';
    return res.status(403).json({
      error: 'Tenant Limit Reached',
      message: `You have reached the maximum number of tenants for the ${tier} plan`,
      current_tier: tier,
      upgrade_url: '/pricing'
    });
  }

  // Create tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      tenant_id,
      tenant_name,
      domain,
      owner_id: req.user.id,
      subscription_tier: req.profile?.subscription_tier || 'free'
    })
    .select()
    .single();

  if (tenantError) {
    if (tenantError.code === '23505') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'A tenant with this ID already exists'
      });
    }
    throw new Error(`Failed to create tenant: ${tenantError.message}`);
  }

  // Create owner membership
  const { error: membershipError } = await supabase
    .from('tenant_members')
    .insert({
      user_id: req.user.id,
      tenant_id: tenant.id,
      role: 'owner'
    });

  if (membershipError) {
    // Rollback tenant creation
    await supabase.from('tenants').delete().eq('id', tenant.id);
    throw new Error(`Failed to create membership: ${membershipError.message}`);
  }

  res.status(201).json({
    success: true,
    message: 'Tenant created successfully',
    tenant: {
      ...tenant,
      role: 'owner'
    }
  });
}));

/**
 * PUT /api/tenants/:id
 * Update tenant details (owner only)
 */
router.put('/:id', authenticate, setTenantContext, requireRole('owner'), asyncHandler(async (req, res) => {
  const { tenant_name, domain, metadata } = req.body;

  const updates = {};
  if (tenant_name) updates.tenant_name = tenant_name;
  if (domain) updates.domain = domain;
  if (metadata) updates.metadata = metadata;

  const { data: tenant, error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update tenant: ${error.message}`);
  }

  res.json({
    success: true,
    message: 'Tenant updated successfully',
    tenant
  });
}));

/**
 * DELETE /api/tenants/:id
 * Delete tenant (owner only)
 */
router.delete('/:id', authenticate, setTenantContext, requireRole('owner'), asyncHandler(async (req, res) => {
  // Delete tenant (cascade will delete all related data)
  const { error } = await supabase
    .from('tenants')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    throw new Error(`Failed to delete tenant: ${error.message}`);
  }

  res.json({
    success: true,
    message: 'Tenant deleted successfully'
  });
}));

/**
 * GET /api/tenants/:id/members
 * List all members of a tenant
 */
router.get('/:id/members', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('tenant_members')
    .select(`
      *,
      profiles (
        id,
        email,
        full_name,
        avatar_url
      )
    `)
    .eq('tenant_id', req.params.id)
    .order('joined_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch members: ${error.message}`);
  }

  const members = data.map(membership => ({
    id: membership.id,
    user_id: membership.user_id,
    role: membership.role,
    joined_at: membership.joined_at,
    ...membership.profiles
  }));

  res.json({
    success: true,
    members,
    count: members.length
  });
}));

/**
 * POST /api/tenants/:id/members
 * Add a member to tenant (owner/admin only)
 */
router.post('/:id/members', authenticate, setTenantContext, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { email, role = 'member' } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Email is required'
    });
  }

  // Validate role
  const validRoles = ['member', 'admin', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
    });
  }

  // Find user by email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (profileError || !profile) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'User with this email not found. They must sign up first.'
    });
  }

  // Add membership
  const { data: membership, error: membershipError } = await supabase
    .from('tenant_members')
    .insert({
      user_id: profile.id,
      tenant_id: req.params.id,
      role
    })
    .select(`
      *,
      profiles (
        id,
        email,
        full_name,
        avatar_url
      )
    `)
    .single();

  if (membershipError) {
    if (membershipError.code === '23505') {
      return res.status(409).json({
        error: 'Conflict',
        message: 'This user is already a member of this tenant'
      });
    }
    throw new Error(`Failed to add member: ${membershipError.message}`);
  }

  res.status(201).json({
    success: true,
    message: 'Member added successfully',
    member: {
      id: membership.id,
      user_id: membership.user_id,
      role: membership.role,
      joined_at: membership.joined_at,
      ...membership.profiles
    }
  });
}));

/**
 * PUT /api/tenants/:id/members/:memberId
 * Update member role (owner/admin only)
 */
router.put('/:id/members/:memberId', authenticate, setTenantContext, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { role } = req.body;

  if (!role) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Role is required'
    });
  }

  const validRoles = ['member', 'admin', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      error: 'Validation Error',
      message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
    });
  }

  // Don't allow changing owner role
  const { data: currentMembership } = await supabase
    .from('tenant_members')
    .select('role')
    .eq('id', req.params.memberId)
    .single();

  if (currentMembership?.role === 'owner') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Cannot change owner role'
    });
  }

  const { data: membership, error } = await supabase
    .from('tenant_members')
    .update({ role })
    .eq('id', req.params.memberId)
    .eq('tenant_id', req.params.id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update member role: ${error.message}`);
  }

  res.json({
    success: true,
    message: 'Member role updated successfully',
    membership
  });
}));

/**
 * DELETE /api/tenants/:id/members/:memberId
 * Remove member from tenant (owner/admin only)
 */
router.delete('/:id/members/:memberId', authenticate, setTenantContext, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  // Don't allow removing owner
  const { data: membership } = await supabase
    .from('tenant_members')
    .select('role')
    .eq('id', req.params.memberId)
    .single();

  if (membership?.role === 'owner') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Cannot remove tenant owner'
    });
  }

  const { error } = await supabase
    .from('tenant_members')
    .delete()
    .eq('id', req.params.memberId)
    .eq('tenant_id', req.params.id);

  if (error) {
    throw new Error(`Failed to remove member: ${error.message}`);
  }

  res.json({
    success: true,
    message: 'Member removed successfully'
  });
}));

module.exports = router;
