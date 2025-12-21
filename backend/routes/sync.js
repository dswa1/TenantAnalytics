const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { setTenantContext } = require('../middleware/tenantContext');
const { asyncHandler } = require('../middleware/errorHandler');
const { syncRateLimiter } = require('../middleware/rateLimiter');
const SyncService = require('../services/SyncService');

/**
 * POST /api/sync/start
 * Start a new sync for a tenant
 */
router.post('/start', authenticate, setTenantContext, syncRateLimiter, asyncHandler(async (req, res) => {
  const { sync_types } = req.body;

  // Validate sync types
  const validTypes = ['users', 'licenses', 'devices', 'mailboxes', 'security_events', 'conditional_access'];
  const typesToSync = sync_types || ['users', 'licenses'];

  const invalidTypes = typesToSync.filter(t => !validTypes.includes(t));
  if (invalidTypes.length > 0) {
    return res.status(400).json({
      error: 'Validation Error',
      message: `Invalid sync types: ${invalidTypes.join(', ')}`,
      valid_types: validTypes
    });
  }

  try {
    // Start sync
    const syncId = await SyncService.startSync(
      req.tenant.id,
      typesToSync,
      req.user.id
    );

    res.status(202).json({
      success: true,
      message: 'Sync started successfully',
      sync_id: syncId,
      sync_types: typesToSync,
      status: 'running',
      status_url: `/api/sync/${syncId}/status`
    });
  } catch (error) {
    if (error.message.includes('rate limit')) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: error.message,
        upgrade_url: '/pricing'
      });
    }
    throw error;
  }
}));

/**
 * GET /api/sync/:id/status
 * Get the status of a sync job
 */
router.get('/:id/status', authenticate, asyncHandler(async (req, res) => {
  const syncId = req.params.id;

  const { data: sync, error } = await supabase
    .from('sync_history')
    .select(`
      *,
      tenants (
        id,
        tenant_name
      )
    `)
    .eq('id', syncId)
    .single();

  if (error || !sync) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Sync job not found'
    });
  }

  // Verify user has access to this tenant
  const { data: membership } = await supabase
    .from('tenant_members')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('tenant_id', sync.tenant_id)
    .single();

  if (!membership) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have access to this sync job'
    });
  }

  // Calculate duration
  const startedAt = new Date(sync.started_at);
  const completedAt = sync.completed_at ? new Date(sync.completed_at) : new Date();
  const durationSeconds = Math.floor((completedAt - startedAt) / 1000);

  res.json({
    success: true,
    sync: {
      id: sync.id,
      status: sync.status,
      sync_type: sync.sync_type,
      started_at: sync.started_at,
      completed_at: sync.completed_at,
      duration_seconds: durationSeconds,
      records_synced: sync.records_synced,
      records_added: sync.records_added,
      records_updated: sync.records_updated,
      records_deleted: sync.records_deleted,
      error_message: sync.error_message,
      tenant_name: sync.tenants?.tenant_name
    }
  });
}));

/**
 * GET /api/sync/history
 * Get sync history for a tenant
 */
router.get('/history', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;

  const { data: syncs, error, count } = await supabase
    .from('sync_history')
    .select('*', { count: 'exact' })
    .eq('tenant_id', req.tenant.id)
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch sync history: ${error.message}`);
  }

  res.json({
    success: true,
    syncs,
    pagination: {
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      has_more: count > (parseInt(offset) + parseInt(limit))
    }
  });
}));

/**
 * GET /api/sync/changes
 * Get data changes since a specific time or sync
 */
router.get('/changes', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { since, sync_id, data_type, limit = 100 } = req.query;

  let query = supabase
    .from('data_changes')
    .select('*')
    .eq('tenant_id', req.tenant.id)
    .order('detected_at', { ascending: false })
    .limit(parseInt(limit));

  // Filter by time
  if (since) {
    query = query.gte('detected_at', since);
  }

  // Filter by sync ID
  if (sync_id) {
    query = query.eq('sync_id', sync_id);
  }

  // Filter by data type
  if (data_type) {
    query = query.eq('data_type', data_type);
  }

  const { data: changes, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch changes: ${error.message}`);
  }

  // Group changes by type
  const grouped = changes.reduce((acc, change) => {
    if (!acc[change.data_type]) {
      acc[change.data_type] = {
        added: 0,
        updated: 0,
        deleted: 0,
        changes: []
      };
    }

    acc[change.data_type][change.change_type]++;
    acc[change.data_type].changes.push(change);

    return acc;
  }, {});

  res.json({
    success: true,
    total_changes: changes.length,
    changes: grouped,
    raw_changes: changes
  });
}));

/**
 * GET /api/sync/latest
 * Get the most recent sync for a tenant
 */
router.get('/latest', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { data: sync, error } = await supabase
    .from('sync_history')
    .select('*')
    .eq('tenant_id', req.tenant.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.json({
        success: true,
        sync: null,
        message: 'No syncs found for this tenant'
      });
    }
    throw new Error(`Failed to fetch latest sync: ${error.message}`);
  }

  // Calculate time since last sync
  const timeSinceSync = Date.now() - new Date(sync.started_at);
  const hoursSinceSync = Math.floor(timeSinceSync / 1000 / 60 / 60);

  // Check if can sync again
  const canSync = await SyncService.checkSyncFrequency(req.tenant.id);

  res.json({
    success: true,
    sync,
    hours_since_sync: hoursSinceSync,
    can_sync_now: canSync
  });
}));

/**
 * DELETE /api/sync/:id
 * Cancel a running sync (if possible)
 */
router.delete('/:id', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const syncId = req.params.id;

  // Get sync
  const { data: sync } = await supabase
    .from('sync_history')
    .select('*')
    .eq('id', syncId)
    .eq('tenant_id', req.tenant.id)
    .single();

  if (!sync) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Sync job not found'
    });
  }

  if (sync.status !== 'running') {
    return res.status(400).json({
      error: 'Bad Request',
      message: `Cannot cancel sync with status: ${sync.status}`
    });
  }

  // Mark as failed (actual cancellation would require more complex worker management)
  await supabase
    .from('sync_history')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: 'Cancelled by user'
    })
    .eq('id', syncId);

  res.json({
    success: true,
    message: 'Sync cancelled successfully'
  });
}));

module.exports = router;
