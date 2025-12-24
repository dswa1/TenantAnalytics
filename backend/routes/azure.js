const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { setTenantContext, requireRole } = require('../middleware/tenantContext');
const { asyncHandler } = require('../middleware/errorHandler');
const EncryptionService = require('../services/EncryptionService');

/**
 * POST /api/azure/setup
 * Store Azure app credentials for a tenant (encrypted)
 * Only owner/admin can set up Azure credentials
 */
router.post('/setup', authenticate, setTenantContext, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { client_id, tenant_id_azure, client_secret } = req.body;

  // Validate required fields
  if (!client_id || !tenant_id_azure || !client_secret) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'client_id, tenant_id_azure, and client_secret are required'
    });
  }

  // Validate format (basic checks)
  if (client_id.length < 32 || tenant_id_azure.length < 32) {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid client_id or tenant_id_azure format'
    });
  }

  try {
    // Encrypt client secret
    const encryptedSecret = EncryptionService.encrypt(client_secret);

    // Check if credentials already exist
    const { data: existing } = await supabase
      .from('azure_app_credentials')
      .select('id')
      .eq('tenant_id', req.tenant.id)
      .single();

    let credentials;
    if (existing) {
      // Update existing credentials
      const { data, error } = await supabase
        .from('azure_app_credentials')
        .update({
          client_id,
          tenant_id_azure,
          client_secret_encrypted: encryptedSecret,
          is_valid: false, // Reset validation status
          last_validated: null,
          consent_granted: false,
          consent_granted_at: null
        })
        .eq('tenant_id', req.tenant.id)
        .select()
        .single();

      if (error) throw error;
      credentials = data;
    } else {
      // Insert new credentials
      const { data, error } = await supabase
        .from('azure_app_credentials')
        .insert({
          tenant_id: req.tenant.id,
          client_id,
          tenant_id_azure,
          client_secret_encrypted: encryptedSecret,
          created_by: req.user.id
        })
        .select()
        .single();

      if (error) throw error;
      credentials = data;
    }

    res.json({
      success: true,
      message: 'Azure credentials saved successfully',
      credentials: {
        id: credentials.id,
        client_id: credentials.client_id,
        tenant_id_azure: credentials.tenant_id_azure,
        is_valid: credentials.is_valid,
        consent_granted: credentials.consent_granted
      }
    });
  } catch (error) {
    console.error('Failed to save Azure credentials:', error);
    throw new Error(`Failed to save credentials: ${error.message}`);
  }
}));

/**
 * GET /api/azure/credentials
 * Get Azure credentials for a tenant (without secret)
 */
router.get('/credentials', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { data: credentials, error } = await supabase
    .from('azure_app_credentials')
    .select('id, client_id, tenant_id_azure, consent_granted, consent_granted_at, is_valid, last_validated, created_at')
    .eq('tenant_id', req.tenant.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No Azure credentials configured for this tenant',
        setup_required: true
      });
    }
    throw new Error(`Failed to fetch credentials: ${error.message}`);
  }

  res.json({
    success: true,
    credentials
  });
}));

/**
 * GET /api/azure/status
 * Get Azure setup and consent status for a tenant
 */
router.get('/status', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { data: credentials, error } = await supabase
    .from('azure_app_credentials')
    .select('id, client_id, tenant_id_azure, consent_granted, consent_granted_at, is_valid, last_validated, created_at')
    .eq('tenant_id', req.tenant.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.json({
        success: true,
        status: {
          configured: false,
          admin_consent_granted: false,
          is_valid: false,
          setup_required: true
        }
      });
    }
    throw new Error(`Failed to fetch status: ${error.message}`);
  }

  res.json({
    success: true,
    status: {
      configured: true,
      admin_consent_granted: credentials.consent_granted || false,
      is_valid: credentials.is_valid || false,
      last_validated: credentials.last_validated,
      consent_granted_at: credentials.consent_granted_at,
      client_id: credentials.client_id,
      tenant_id_azure: credentials.tenant_id_azure
    }
  });
}));

/**
 * GET /api/azure/consent-url
 * Generate Microsoft admin consent URL
 */
router.get('/consent-url', authenticate, setTenantContext, asyncHandler(async (req, res) => {
  const { data: credentials, error } = await supabase
    .from('azure_app_credentials')
    .select('client_id, tenant_id_azure')
    .eq('tenant_id', req.tenant.id)
    .single();

  if (error || !credentials) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Azure credentials not configured. Please set up credentials first.',
      setup_required: true
    });
  }

  // Generate admin consent URL
  const redirectUri = encodeURIComponent(`${process.env.APP_URL}/api/azure/consent-callback`);
  const state = Buffer.from(JSON.stringify({
    tenant_id: req.tenant.id,
    user_id: req.user.id,
    timestamp: Date.now()
  })).toString('base64');

  const consentUrl = `https://login.microsoftonline.com/${credentials.tenant_id_azure}/adminconsent` +
    `?client_id=${credentials.client_id}` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}`;

  res.json({
    success: true,
    consent_url: consentUrl,
    instructions: {
      step1: 'Click the consent URL',
      step2: 'Sign in with your Microsoft 365 Global Administrator account',
      step3: 'Review and accept the permissions',
      step4: 'You will be redirected back to the application'
    }
  });
}));

/**
 * GET /api/azure/consent-callback
 * Handle admin consent callback from Microsoft
 */
router.get('/consent-callback', asyncHandler(async (req, res) => {
  const { admin_consent, tenant: azureTenantId, state, error: consentError } = req.query;

  if (consentError) {
    return res.redirect(`${process.env.FRONTEND_URL}/onboarding?consent=failed&error=${encodeURIComponent(consentError)}`);
  }

  if (admin_consent !== 'True') {
    return res.redirect(`${process.env.FRONTEND_URL}/onboarding?consent=denied`);
  }

  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
    const { tenant_id, user_id } = stateData;

    // Update credentials with consent status
    const { error: updateError } = await supabase
      .from('azure_app_credentials')
      .update({
        consent_granted: true,
        consent_granted_at: new Date().toISOString(),
        is_valid: true,
        last_validated: new Date().toISOString()
      })
      .eq('tenant_id', tenant_id);

    if (updateError) {
      throw updateError;
    }

    // Redirect to onboarding page with success parameter
    res.redirect(`${process.env.FRONTEND_URL}/onboarding?consent=success&tenant_id=${tenant_id}`);
  } catch (error) {
    console.error('Consent callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/onboarding?consent=failed&error=${encodeURIComponent('Failed to process consent')}`);
  }
}));

/**
 * POST /api/azure/validate
 * Validate Azure credentials by attempting to connect
 */
router.post('/validate', authenticate, setTenantContext, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const { data: credentials, error } = await supabase
    .from('azure_app_credentials')
    .select('*')
    .eq('tenant_id', req.tenant.id)
    .single();

  if (error || !credentials) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'Azure credentials not configured'
    });
  }

  try {
    // Decrypt secret
    const clientSecret = EncryptionService.decrypt(credentials.client_secret_encrypted);

    // Test connection to Microsoft Graph
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

    // Test API call
    await graphClient.api('/organization').get();

    // Update validation status
    await supabase
      .from('azure_app_credentials')
      .update({
        is_valid: true,
        last_validated: new Date().toISOString()
      })
      .eq('id', credentials.id);

    res.json({
      success: true,
      message: 'Azure credentials are valid',
      validated_at: new Date().toISOString()
    });
  } catch (error) {
    // Update validation status to false
    await supabase
      .from('azure_app_credentials')
      .update({
        is_valid: false,
        last_validated: new Date().toISOString()
      })
      .eq('id', credentials.id);

    res.status(401).json({
      success: false,
      error: 'Invalid Credentials',
      message: 'Failed to authenticate with Microsoft Graph. Please check your credentials.',
      details: error.message
    });
  }
}));

/**
 * DELETE /api/azure/credentials
 * Delete Azure credentials (owner only)
 */
router.delete('/credentials', authenticate, setTenantContext, requireRole('owner'), asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('azure_app_credentials')
    .delete()
    .eq('tenant_id', req.tenant.id);

  if (error) {
    throw new Error(`Failed to delete credentials: ${error.message}`);
  }

  res.json({
    success: true,
    message: 'Azure credentials deleted successfully'
  });
}));

/**
 * GET /api/azure/permissions
 * Get list of required Microsoft Graph API permissions
 */
router.get('/permissions', authenticate, asyncHandler(async (req, res) => {
  const requiredPermissions = [
    {
      api: 'Microsoft Graph',
      permissions: [
        { name: 'User.Read.All', type: 'Application', description: 'Read all users\' full profiles' },
        { name: 'Directory.Read.All', type: 'Application', description: 'Read directory data' },
        { name: 'Reports.Read.All', type: 'Application', description: 'Read all usage reports' },
        { name: 'AuditLog.Read.All', type: 'Application', description: 'Read audit log data' },
        { name: 'Policy.Read.All', type: 'Application', description: 'Read policies' },
        { name: 'Device.Read.All', type: 'Application', description: 'Read all devices' },
        { name: 'Mail.Read', type: 'Application', description: 'Read mail in all mailboxes' },
        { name: 'SecurityEvents.Read.All', type: 'Application', description: 'Read security events' },
        { name: 'IdentityRiskyUser.Read.All', type: 'Application', description: 'Read risky user information' }
      ]
    }
  ];

  res.json({
    success: true,
    required_permissions: requiredPermissions,
    setup_instructions_url: `${process.env.APP_URL}/docs/azure-setup`
  });
}));

module.exports = router;
