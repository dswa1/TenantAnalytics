const { supabase } = require('../config/supabase');
const EncryptionService = require('./EncryptionService');
const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');

/**
 * Sync service for fetching and caching Microsoft 365 data
 * Implements delta tracking to detect changes
 */
class SyncService {
  /**
   * Start a sync job for a tenant
   * @param {string} tenantId - Internal tenant UUID
   * @param {string[]} syncTypes - Types of data to sync (e.g., ['users', 'licenses'])
   * @param {string} userId - User who triggered the sync
   * @returns {Promise<string>} - Sync ID
   */
  async startSync(tenantId, syncTypes, userId) {
    try {
      // Check sync frequency limits based on tier
      const canSync = await this.checkSyncFrequency(tenantId);
      if (!canSync) {
        throw new Error('Sync rate limit exceeded for your subscription tier');
      }

      // Create sync record
      const { data: syncRecord, error } = await supabase
        .from('sync_history')
        .insert({
          tenant_id: tenantId,
          sync_type: syncTypes.join(','),
          status: 'running',
          triggered_by: userId
        })
        .select()
        .single();

      if (error) throw error;

      // Run sync in background (don't await)
      this.performSync(syncRecord.id, tenantId, syncTypes).catch(err => {
        console.error('Background sync error:', err);
      });

      return syncRecord.id;
    } catch (error) {
      console.error('Failed to start sync:', error);
      throw error;
    }
  }

  /**
   * Check if tenant can sync based on frequency limits
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<boolean>}
   */
  async checkSyncFrequency(tenantId) {
    try {
      console.log('[CHECK SYNC FREQUENCY] Checking for tenant:', tenantId);

      // Get tenant subscription tier
      const { data: tenant } = await supabase
        .from('tenants')
        .select('subscription_tier')
        .eq('id', tenantId)
        .single();

      console.log('[CHECK SYNC FREQUENCY] Tenant tier:', tenant?.subscription_tier);
      if (!tenant) {
        console.log('[CHECK SYNC FREQUENCY] No tenant found');
        return false;
      }

      // Get tier limits
      const { data: limits } = await supabase
        .from('feature_limits')
        .select('sync_frequency_hours')
        .eq('tier', tenant.subscription_tier)
        .single();

      console.log('[CHECK SYNC FREQUENCY] Limits:', limits);
      if (!limits) {
        console.log('[CHECK SYNC FREQUENCY] No limits found for tier');
        return false;
      }

      const frequencyHours = limits.sync_frequency_hours;
      console.log('[CHECK SYNC FREQUENCY] Frequency hours required:', frequencyHours);

      // If frequency is 0, allow unlimited syncs (enterprise tier)
      if (frequencyHours === 0) {
        console.log('[CHECK SYNC FREQUENCY] Unlimited syncs allowed (enterprise tier)');
        return true;
      }

      // Check last sync time
      const { data: lastSync } = await supabase
        .from('sync_history')
        .select('started_at')
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      console.log('[CHECK SYNC FREQUENCY] Last sync:', lastSync);
      if (!lastSync) {
        console.log('[CHECK SYNC FREQUENCY] First sync - allowing');
        return true; // First sync
      }

      const lastSyncTime = new Date(lastSync.started_at);
      const timeSinceLastSync = (Date.now() - lastSyncTime) / 1000 / 60 / 60; // hours

      console.log('[CHECK SYNC FREQUENCY] Hours since last sync:', timeSinceLastSync);
      console.log('[CHECK SYNC FREQUENCY] Can sync:', timeSinceLastSync >= frequencyHours);

      return timeSinceLastSync >= frequencyHours;
    } catch (error) {
      console.error('Error checking sync frequency:', error);
      return true; // Allow sync on error
    }
  }

  /**
   * Perform the actual sync operation
   * @param {string} syncId - Sync history record ID
   * @param {string} tenantId - Tenant UUID
   * @param {string[]} syncTypes - Data types to sync
   */
  async performSync(syncId, tenantId, syncTypes) {
    try {
      // Get Azure credentials
      const graphClient = await this.getGraphClient(tenantId);

      let totalAdded = 0;
      let totalUpdated = 0;
      let totalDeleted = 0;

      // Sync each data type
      for (const syncType of syncTypes) {
        const result = await this.syncDataType(syncId, tenantId, syncType, graphClient);
        totalAdded += result.added;
        totalUpdated += result.updated;
        totalDeleted += result.deleted || 0;
      }

      // Mark sync as completed
      await supabase
        .from('sync_history')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          records_synced: totalAdded + totalUpdated,
          records_added: totalAdded,
          records_updated: totalUpdated,
          records_deleted: totalDeleted
        })
        .eq('id', syncId);

      console.log(`Sync ${syncId} completed: ${totalAdded} added, ${totalUpdated} updated, ${totalDeleted} deleted`);
    } catch (error) {
      console.error('Sync failed:', error);

      // Mark sync as failed
      await supabase
        .from('sync_history')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: error.message
        })
        .eq('id', syncId);
    }
  }

  /**
   * Get Microsoft Graph client for a tenant
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Client>}
   */
  async getGraphClient(tenantId) {
    // Get Azure credentials
    const { data: credentials, error } = await supabase
      .from('azure_app_credentials')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !credentials) {
      throw new Error('Azure credentials not configured');
    }

    if (!credentials.is_valid || !credentials.consent_granted) {
      throw new Error('Azure credentials not validated or consent not granted');
    }

    // Decrypt client secret
    const clientSecret = EncryptionService.decrypt(credentials.client_secret_encrypted);

    // Create credential
    const credential = new ClientSecretCredential(
      credentials.tenant_id_azure,
      credentials.client_id,
      clientSecret
    );

    // Create auth provider
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    });

    // Create Graph client
    return Client.initWithMiddleware({ authProvider });
  }

  /**
   * Sync a specific data type
   * @param {string} syncId - Sync history ID
   * @param {string} tenantId - Tenant UUID
   * @param {string} dataType - Type of data to sync
   * @param {Client} graphClient - Microsoft Graph client
   * @returns {Promise<{added: number, updated: number, deleted: number}>}
   */
  async syncDataType(syncId, tenantId, dataType, graphClient) {
    switch (dataType) {
      case 'users':
        return await this.syncUsers(syncId, tenantId, graphClient);
      case 'licenses':
        return await this.syncLicenses(syncId, tenantId, graphClient);
      case 'devices':
        return await this.syncDevices(syncId, tenantId, graphClient);
      case 'mailboxes':
        return await this.syncMailboxes(syncId, tenantId, graphClient);
      default:
        console.warn(`Unknown sync type: ${dataType}`);
        return { added: 0, updated: 0, deleted: 0 };
    }
  }

  /**
   * Sync users from Microsoft Graph
   */
  async syncUsers(syncId, tenantId, graphClient) {
    try {
      // Get tenant_id (Azure tenant ID) for foreign key
      const { data: tenant } = await supabase
        .from('tenants')
        .select('tenant_id')
        .eq('id', tenantId)
        .single();

      const azureTenantId = tenant.tenant_id;

      // Fetch users from Microsoft Graph
      const response = await graphClient
        .api('/users')
        .select('id,displayName,userPrincipalName,accountEnabled,createdDateTime,assignedLicenses,signInActivity')
        .top(999)
        .get();

      const graphUsers = response.value;

      // Get existing users from database
      const { data: existingUsers } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', azureTenantId);

      const existingMap = new Map(existingUsers.map(u => [u.user_id, u]));
      let added = 0;
      let updated = 0;

      // Process each user
      for (const graphUser of graphUsers) {
        const existing = existingMap.get(graphUser.id);

        const userData = {
          tenant_id: azureTenantId,
          user_id: graphUser.id,
          display_name: graphUser.displayName,
          user_principal_name: graphUser.userPrincipalName,
          account_enabled: graphUser.accountEnabled,
          created_datetime: graphUser.createdDateTime,
          last_sign_in: graphUser.signInActivity?.lastSignInDateTime,
          licenses: graphUser.assignedLicenses || [],
          is_licensed: graphUser.assignedLicenses && graphUser.assignedLicenses.length > 0
        };

        if (!existing) {
          // Insert new user
          await supabase.from('users').insert(userData);

          // Record change
          await this.recordChange(syncId, tenantId, 'users', graphUser.id, 'added', null, graphUser);
          added++;
        } else {
          // Check for changes
          const hasChanges = this.detectUserChanges(existing, userData);

          if (hasChanges) {
            // Update user
            await supabase
              .from('users')
              .update(userData)
              .eq('user_id', graphUser.id)
              .eq('tenant_id', azureTenantId);

            // Record change
            await this.recordChange(syncId, tenantId, 'users', graphUser.id, 'updated', existing, graphUser);
            updated++;
          }
        }
      }

      return { added, updated, deleted: 0 };
    } catch (error) {
      console.error('Error syncing users:', error);
      throw error;
    }
  }

  /**
   * Sync licenses from Microsoft Graph
   */
  async syncLicenses(syncId, tenantId, graphClient) {
    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('tenant_id')
        .eq('id', tenantId)
        .single();

      const azureTenantId = tenant.tenant_id;

      // Fetch licenses from Microsoft Graph
      const response = await graphClient
        .api('/subscribedSkus')
        .get();

      const graphLicenses = response.value;
      let added = 0;
      let updated = 0;

      for (const graphLicense of graphLicenses) {
        const availableUnits = graphLicense.prepaidUnits.enabled - graphLicense.consumedUnits;
        const utilization = graphLicense.prepaidUnits.enabled > 0
          ? (graphLicense.consumedUnits / graphLicense.prepaidUnits.enabled * 100).toFixed(2)
          : 0;

        const licenseData = {
          tenant_id: azureTenantId,
          sku_id: graphLicense.skuId,
          sku_part_number: graphLicense.skuPartNumber,
          service_plans: graphLicense.servicePlans,
          prepaid_units: graphLicense.prepaidUnits,
          consumed_units: graphLicense.consumedUnits,
          available_units: availableUnits,
          utilization_percentage: utilization
        };

        // Upsert license
        const { data: existing } = await supabase
          .from('licenses')
          .select('*')
          .eq('tenant_id', azureTenantId)
          .eq('sku_id', graphLicense.skuId)
          .single();

        if (!existing) {
          await supabase.from('licenses').insert(licenseData);
          await this.recordChange(syncId, tenantId, 'licenses', graphLicense.skuId, 'added', null, graphLicense);
          added++;
        } else {
          if (existing.consumed_units !== graphLicense.consumedUnits) {
            await supabase
              .from('licenses')
              .update(licenseData)
              .eq('sku_id', graphLicense.skuId)
              .eq('tenant_id', azureTenantId);

            await this.recordChange(syncId, tenantId, 'licenses', graphLicense.skuId, 'updated', existing, graphLicense);
            updated++;
          }
        }
      }

      return { added, updated, deleted: 0 };
    } catch (error) {
      console.error('Error syncing licenses:', error);
      throw error;
    }
  }

  /**
   * Sync devices from Microsoft Graph
   */
  async syncDevices(syncId, tenantId, graphClient) {
    // Similar implementation to syncUsers
    return { added: 0, updated: 0, deleted: 0 };
  }

  /**
   * Sync mailboxes from Microsoft Graph Reports API
   * Uses the getMailboxUsageDetail report which provides actual storage and item counts
   */
  async syncMailboxes(syncId, tenantId, graphClient) {
    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('tenant_id')
        .eq('id', tenantId)
        .single();

      if (!tenant) {
        throw new Error(`Tenant not found: ${tenantId}`);
      }

      const azureTenantId = tenant.tenant_id;

      console.log('[MAILBOX SYNC] Fetching mailbox usage report from Graph API...');

      // Fetch mailbox usage report using Graph SDK
      // Returns a stream/buffer with CSV data
      const stream = await graphClient
        .api('/reports/getMailboxUsageDetail(period=\'D7\')')
        .get();

      console.log('[MAILBOX SYNC] Stream type:', typeof stream);
      console.log('[MAILBOX SYNC] Stream constructor:', stream?.constructor?.name);

      // Convert stream/buffer to string
      let csvText;

      // Handle ReadableStream (Node.js fetch API or Web Streams API)
      if (stream && stream.constructor && stream.constructor.name === 'ReadableStream') {
        console.log('[MAILBOX SYNC] Converting ReadableStream to text...');
        const reader = stream.getReader();
        const chunks = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        // Combine chunks and convert to string
        const buffer = Buffer.concat(chunks);
        csvText = buffer.toString('utf-8');
        console.log('[MAILBOX SYNC] ReadableStream converted to text');
      } else if (typeof stream === 'string') {
        csvText = stream;
        console.log('[MAILBOX SYNC] Used string conversion');
      } else if (Buffer.isBuffer(stream)) {
        csvText = stream.toString('utf-8');
        console.log('[MAILBOX SYNC] Used Buffer.toString()');
      } else if (stream && typeof stream.text === 'function') {
        csvText = await stream.text();
        console.log('[MAILBOX SYNC] Used stream.text()');
      } else if (stream && stream.value) {
        // Might be wrapped in a value property
        csvText = stream.value;
        console.log('[MAILBOX SYNC] Used stream.value');
      } else {
        // Last resort - try to convert to string
        csvText = String(stream);
        console.log('[MAILBOX SYNC] Used String() conversion');
      }

      console.log('[MAILBOX SYNC] CSV text length:', csvText?.length);
      console.log('[MAILBOX SYNC] First 200 chars:', csvText?.substring(0, 200));

      // Parse CSV response
      const lines = csvText.split('\n');
      if (lines.length <= 1) {
        console.log('[MAILBOX SYNC] No mailbox data in report');
        return { added: 0, updated: 0, deleted: 0 };
      }

      // Parse CSV headers (remove BOM and quotes)
      const headers = lines[0].split(',').map(h =>
        h.trim().replace(/"/g, '').replace(/^\uFEFF/, '')
      );

      console.log('[MAILBOX SYNC] CSV Headers:', headers);

      // Find column indices
      const upnIndex = headers.findIndex(h => h.toLowerCase().includes('user principal name'));
      const displayNameIndex = headers.findIndex(h => h.toLowerCase() === 'display name');
      const createdDateIndex = headers.findIndex(h => h.toLowerCase().includes('created date'));
      const storageUsedIndex = headers.findIndex(h =>
        h.toLowerCase().includes('storage used') && h.toLowerCase().includes('byte')
      );
      const itemCountIndex = headers.findIndex(h => h.toLowerCase() === 'item count');

      console.log('[MAILBOX SYNC] Column indices - UPN:', upnIndex, 'Display Name:', displayNameIndex,
                  'Created Date:', createdDateIndex, 'Storage:', storageUsedIndex, 'Item Count:', itemCountIndex);

      if (upnIndex === -1 || storageUsedIndex === -1 || displayNameIndex === -1) {
        throw new Error('Required columns not found in mailbox usage report');
      }

      // Get existing mailboxes from database
      const { data: existingMailboxes } = await supabase
        .from('mailboxes')
        .select('*')
        .eq('tenant_id', azureTenantId);

      const existingMap = new Map(existingMailboxes?.map(m => [m.user_id, m]) || []);
      let added = 0;
      let updated = 0;

      // Get users to map by User Principal Name
      const { data: users } = await supabase
        .from('users')
        .select('user_id, display_name, user_principal_name')
        .eq('tenant_id', azureTenantId);

      // Create map by UPN (case-insensitive)
      const userMap = new Map();
      users?.forEach(u => {
        if (u.user_principal_name) {
          userMap.set(u.user_principal_name.toLowerCase(), u);
        }
      });

      // Parse each CSV row
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());

        const upn = values[upnIndex] || '';
        const displayName = values[displayNameIndex] || '';
        const storageUsedBytes = parseInt(values[storageUsedIndex]) || 0;
        const itemCount = parseInt(values[itemCountIndex]) || 0;

        if (!upn || !displayName) continue;

        // Match user by User Principal Name
        const user = userMap.get(upn.toLowerCase());

        if (!user) {
          console.log(`[MAILBOX SYNC] User not found for UPN: ${upn}, skipping`);
          continue;
        }

        const mailboxData = {
          tenant_id: azureTenantId,
          user_id: user.user_id,
          user_principal_name: user.user_principal_name,
          storage_used_bytes: storageUsedBytes,
          item_count: itemCount,
          updated_at: new Date().toISOString()
        };

        console.log(`[MAILBOX SYNC] Processing mailbox for UPN: ${upn}, User ID: ${user.user_id}, Storage: ${storageUsedBytes}, Items: ${itemCount}`);

        const existing = existingMap.get(user.user_id);

        if (!existing) {
          // Insert new mailbox
          const { data: insertedData, error: insertError } = await supabase.from('mailboxes').insert(mailboxData);
          if (insertError) {
            console.error(`[MAILBOX SYNC] Insert error for ${upn}:`, insertError);
          } else {
            console.log(`[MAILBOX SYNC] Inserted mailbox for ${upn}`);
            await this.recordChange(syncId, tenantId, 'mailboxes', user.user_id, 'added', null, mailboxData);
            added++;
          }
        } else {
          // Update if data changed
          if (existing.item_count !== itemCount || existing.storage_used_bytes !== storageUsedBytes) {
            const { error: updateError } = await supabase
              .from('mailboxes')
              .update(mailboxData)
              .eq('user_id', user.user_id)
              .eq('tenant_id', azureTenantId);

            if (updateError) {
              console.error(`[MAILBOX SYNC] Update error for ${upn}:`, updateError);
            } else {
              await this.recordChange(syncId, tenantId, 'mailboxes', user.user_id, 'updated', existing, mailboxData);
              updated++;
            }
          }
        }
      }

      console.log(`[MAILBOX SYNC] Completed: ${added} added, ${updated} updated`);
      return { added, updated, deleted: 0 };
    } catch (error) {
      console.error('[MAILBOX SYNC] Error:', error);
      throw error;
    }
  }

  /**
   * Record a data change in the database
   */
  async recordChange(syncId, tenantId, dataType, recordId, changeType, oldData, newData) {
    try {
      await supabase.from('data_changes').insert({
        sync_id: syncId,
        tenant_id: tenantId,
        data_type: dataType,
        record_id: recordId,
        change_type: changeType,
        old_data: oldData || null,
        new_data: newData || null
      });
    } catch (error) {
      console.error('Error recording change:', error);
      // Don't throw - this shouldn't stop the sync
    }
  }

  /**
   * Detect if user data has changed
   */
  detectUserChanges(existing, newData) {
    return (
      existing.display_name !== newData.display_name ||
      existing.account_enabled !== newData.account_enabled ||
      existing.is_licensed !== newData.is_licensed ||
      JSON.stringify(existing.licenses) !== JSON.stringify(newData.licenses)
    );
  }
}

module.exports = new SyncService();
