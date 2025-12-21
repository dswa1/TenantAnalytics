const { supabase } = require('../config/supabase');

/**
 * Tenant context middleware
 * Validates user access to tenant and attaches tenant to request
 * MUST be used after authenticate middleware
 */
async function setTenantContext(req, res, next) {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // Get tenant ID from header or query param
    const tenantId = req.headers['x-tenant-id'] || req.query.tenantId || req.body.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Tenant ID is required. Provide via x-tenant-id header or tenantId parameter'
      });
    }

    // Verify user has access to this tenant
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

    // Check if tenant is active
    if (!membership.tenants.is_active) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'This tenant is not active'
      });
    }

    // Attach tenant and membership to request
    req.tenant = membership.tenants;
    req.tenantMembership = membership;

    next();
  } catch (error) {
    console.error('Tenant context error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to set tenant context'
    });
  }
}

/**
 * Require specific role(s) for tenant access
 * MUST be used after setTenantContext middleware
 * @param {string[]} allowedRoles - Array of allowed roles (e.g., ['owner', 'admin'])
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.tenantMembership) {
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Tenant context not set. Use setTenantContext middleware first.'
      });
    }

    const userRole = req.tenantMembership.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}

module.exports = {
  setTenantContext,
  requireRole
};
