const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { setTenantContext } = require('../middleware/tenantContext');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/data/users
 * Get all users for tenant
 */
router.get('/users', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', req.tenant.tenant_id)
    .order('display_name');

  if (error) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  res.json({
    success: true,
    users: data || [],
    count: data?.length || 0
  });
}));

/**
 * GET /api/data/security-events
 * Get security events for tenant
 */
router.get('/security-events', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 100;

  const { data, error } = await supabase
    .from('security_events')
    .select('*')
    .eq('tenant_id', req.tenant.tenant_id)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch security events: ${error.message}`);
  }

  res.json({
    success: true,
    events: data || [],
    count: data?.length || 0
  });
}));

/**
 * GET /api/data/mailboxes
 * Get mailboxes for tenant
 */
router.get('/mailboxes', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('mailboxes')
    .select('*')
    .eq('tenant_id', req.tenant.tenant_id);

  if (error) {
    throw new Error(`Failed to fetch mailboxes: ${error.message}`);
  }

  res.json({
    success: true,
    mailboxes: data || [],
    count: data?.length || 0
  });
}));

/**
 * GET /api/data/licenses
 * Get all licenses for tenant
 */
router.get('/licenses', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('licenses')
    .select('*')
    .eq('tenant_id', req.tenant.tenant_id)
    .order('sku_part_number');

  if (error) {
    throw new Error(`Failed to fetch licenses: ${error.message}`);
  }

  res.json({
    success: true,
    licenses: data || [],
    count: data?.length || 0
  });
}));

/**
 * PUT /api/data/licenses/:id/cost
 * Update license cost information
 */
router.put('/licenses/:id/cost', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cost_per_unit, currency, cost_notes } = req.body;

  // Verify license belongs to tenant
  const { data: license, error: fetchError } = await supabase
    .from('licenses')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', req.tenant.tenant_id)
    .single();

  if (fetchError || !license) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'License not found or does not belong to this tenant'
    });
  }

  // Update license cost
  const { data, error } = await supabase
    .from('licenses')
    .update({
      cost_per_unit,
      currency: currency || 'USD',
      cost_notes,
      cost_updated_at: new Date().toISOString(),
      cost_updated_by: req.user.id
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update license cost: ${error.message}`);
  }

  res.json({
    success: true,
    message: 'License cost updated successfully',
    license: data
  });
}));

/**
 * GET /api/data/app-usage
 * Get Office 365 active user details from database
 * Supports periods: D30, D90, D180
 */
router.get('/app-usage', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { period = 'D30' } = req.query;

  // Validate period parameter
  const validPeriods = ['D30', 'D90', 'D180'];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({
      error: 'Invalid Parameter',
      message: `Period must be one of: ${validPeriods.join(', ')}`
    });
  }

  // Get data from database
  const { data: appUsageData, error } = await supabase
    .from('app_usage')
    .select('*')
    .eq('tenant_id', req.tenant.tenant_id)
    .eq('period', period)
    .order('synced_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch app usage data: ${error.message}`);
  }

  // Get the most recent sync time
  const lastSync = appUsageData.length > 0 ? appUsageData[0].synced_at : null;

  res.json({
    success: true,
    period,
    data: appUsageData || [],
    count: appUsageData?.length || 0,
    last_sync: lastSync
  });
}));

/**
 * POST /api/data/app-usage/sync
 * Sync Office 365 active user details from Microsoft Graph API and save to database
 * Supports periods: D30, D90, D180
 */
router.post('/app-usage/sync', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { period = 'D30' } = req.query;

  // Validate period parameter
  const validPeriods = ['D30', 'D90', 'D180'];
  if (!validPeriods.includes(period)) {
    return res.status(400).json({
      error: 'Invalid Parameter',
      message: `Period must be one of: ${validPeriods.join(', ')}`
    });
  }

  try {
    // Get Azure credentials for this tenant
    const { data: credentials, error: credError } = await supabase
      .from('azure_app_credentials')
      .select('*')
      .eq('tenant_id', req.tenant.id)
      .single();

    if (credError || !credentials) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Azure credentials not configured for this tenant'
      });
    }

    // Decrypt client secret
    const EncryptionService = require('../services/EncryptionService');
    const clientSecret = EncryptionService.decrypt(credentials.client_secret_encrypted);

    // Set up Microsoft Graph client
    const { ClientSecretCredential } = require('@azure/identity');
    const { Client } = require('@microsoft/microsoft-graph-client');
    const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');

    const credential = new ClientSecretCredential(
      credentials.tenant_id_azure,
      credentials.client_id,
      clientSecret
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    });

    const graphClient = Client.initWithMiddleware({ authProvider });

    // Fetch Office 365 active user details
    // This endpoint returns CSV data as a ReadableStream
    const reportStream = await graphClient
      .api(`/reports/getOffice365ActiveUserDetail(period='${period}')`)
      .get();

    console.log('Graph API report type:', typeof reportStream);

    // Convert ReadableStream to string
    let csvData = '';

    if (reportStream && typeof reportStream.getReader === 'function') {
      // It's a ReadableStream
      const reader = reportStream.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        csvData += decoder.decode(value, { stream: true });
      }
      csvData += decoder.decode(); // Flush remaining data
    } else if (typeof reportStream === 'string') {
      // Already a string
      csvData = reportStream;
    } else {
      throw new Error('Unexpected report format from Microsoft Graph API');
    }

    console.log('CSV data length:', csvData.length);
    console.log('CSV preview:', csvData.substring(0, 200));

    // Parse CSV data
    const lines = csvData.trim().split(/\r?\n/);
    if (lines.length < 2) {
      return res.json({
        success: true,
        period,
        message: 'No data available for this period',
        count: 0
      });
    }

    const headers = lines[0].split(',');
    const reportRefreshDate = new Date().toISOString().split('T')[0];
    const syncedAt = new Date().toISOString();

    // Delete old data for this period
    await supabase
      .from('app_usage')
      .delete()
      .eq('tenant_id', req.tenant.tenant_id)
      .eq('period', period);

    // Parse and insert new data
    const usageRecords = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;

      const values = lines[i].split(',');
      const record = {};
      headers.forEach((header, index) => {
        record[header.trim()] = values[index]?.trim() || '';
      });

      // Map CSV fields to database columns
      usageRecords.push({
        tenant_id: req.tenant.tenant_id,
        user_principal_name: record['User Principal Name'] || '',
        display_name: record['Display Name'] || '',
        report_refresh_date: record['Report Refresh Date'] || reportRefreshDate,
        is_deleted: record['Is Deleted'] === 'True',
        deleted_date: record['Deleted Date'] || null,

        has_exchange_license: record['Has Exchange License'] === 'True',
        has_onedrive_license: record['Has OneDrive License'] === 'True',
        has_sharepoint_license: record['Has SharePoint License'] === 'True',
        has_skype_license: record['Has Skype For Business License'] === 'True',
        has_yammer_license: record['Has Yammer License'] === 'True',
        has_teams_license: record['Has Teams License'] === 'True',

        exchange_last_activity_date: record['Exchange Last Activity Date'] || null,
        onedrive_last_activity_date: record['OneDrive Last Activity Date'] || null,
        sharepoint_last_activity_date: record['SharePoint Last Activity Date'] || null,
        skype_last_activity_date: record['Skype For Business Last Activity Date'] || null,
        yammer_last_activity_date: record['Yammer Last Activity Date'] || null,
        teams_last_activity_date: record['Teams Last Activity Date'] || null,

        exchange_license_assign_date: record['Exchange License Assign Date'] || null,
        onedrive_license_assign_date: record['OneDrive License Assign Date'] || null,
        sharepoint_license_assign_date: record['SharePoint License Assign Date'] || null,
        skype_license_assign_date: record['Skype For Business License Assign Date'] || null,
        yammer_license_assign_date: record['Yammer License Assign Date'] || null,
        teams_license_assign_date: record['Teams License Assign Date'] || null,

        assigned_products: record['Assigned Products'] || '',
        period,
        synced_at: syncedAt
      });
    }

    // Bulk insert
    if (usageRecords.length > 0) {
      const { error: insertError } = await supabase
        .from('app_usage')
        .insert(usageRecords);

      if (insertError) {
        throw new Error(`Failed to save app usage data: ${insertError.message}`);
      }
    }

    res.json({
      success: true,
      period,
      message: `Successfully synced ${usageRecords.length} user records`,
      count: usageRecords.length,
      synced_at: syncedAt
    });
  } catch (error) {
    console.error('Failed to sync app usage data:', error);

    if (error.statusCode === 401 || error.statusCode === 403) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Failed to authenticate with Microsoft Graph. Please check your Azure credentials.',
        details: error.message
      });
    }

    throw new Error(`Failed to sync app usage data: ${error.message}`);
  }
}));

module.exports = router;