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
