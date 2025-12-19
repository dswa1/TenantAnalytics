// M365 Tenant Manager - Backend API Service
// Supports both M365 Tenant Storage and Supabase Database

const express = require('express');
const cors = require('cors');
const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3001;

// Microsoft Graph Client Setup
function getAuthenticatedClient(tenantId, clientId, clientSecret) {
    const credential = new ClientSecretCredential(
        tenantId,
        clientId,
        clientSecret
    );

    return Client.initWithMiddleware({
        authProvider: {
            getAccessToken: async () => {
                const token = await credential.getToken('https://graph.microsoft.com/.default');
                return token.token;
            }
        }
    });
}

// Storage Strategy Pattern
class StorageStrategy {
    async saveData(data, dataType) {
        throw new Error('Method not implemented');
    }
    
    async getData(dataType, filters) {
        throw new Error('Method not implemented');
    }
}

// M365 Tenant Storage (SharePoint/Azure Storage)
class M365TenantStorage extends StorageStrategy {
    constructor(graphClient) {
        super();
        this.client = graphClient;
        this.listName = 'TenantAnalytics';
    }

    async ensureList() {
        // Create SharePoint list if it doesn't exist
        try {
            const siteId = await this.getSiteId();
            const lists = await this.client
                .api(`/sites/${siteId}/lists`)
                .filter(`displayName eq '${this.listName}'`)
                .get();

            if (lists.value.length === 0) {
                await this.createAnalyticsList(siteId);
            }
        } catch (error) {
            console.error('Error ensuring list:', error);
        }
    }

    async getSiteId() {
        const site = await this.client
            .api('/sites/root')
            .get();
        return site.id;
    }

    async createAnalyticsList(siteId) {
        const list = {
            displayName: this.listName,
            columns: [
                { name: 'DataType', text: {} },
                { name: 'Timestamp', dateTime: {} },
                { name: 'DataPayload', text: {} },
                { name: 'UserId', text: {} },
                { name: 'MetricValue', number: {} }
            ],
            list: {
                template: 'genericList'
            }
        };

        await this.client
            .api(`/sites/${siteId}/lists`)
            .post(list);
    }

    async saveData(data, dataType) {
        const siteId = await this.getSiteId();
        
        const listItem = {
            fields: {
                Title: dataType,
                DataType: dataType,
                Timestamp: new Date().toISOString(),
                DataPayload: JSON.stringify(data),
                MetricValue: data.value || 0
            }
        };

        return await this.client
            .api(`/sites/${siteId}/lists/${this.listName}/items`)
            .post(listItem);
    }

    async getData(dataType, filters = {}) {
        const siteId = await this.getSiteId();
        let query = this.client.api(`/sites/${siteId}/lists/${this.listName}/items?expand=fields`);

        if (dataType) {
            query = query.filter(`fields/DataType eq '${dataType}'`);
        }

        const response = await query.get();
        return response.value.map(item => JSON.parse(item.fields.DataPayload));
    }
}

// Supabase Storage
class SupabaseStorage extends StorageStrategy {
    constructor(supabaseUrl, supabaseKey) {
        super();
        this.client = createClient(supabaseUrl, supabaseKey);
    }

    async saveData(data, dataType) {
        const { data: result, error } = await this.client
            .from('tenant_analytics')
            .insert([{
                data_type: dataType,
                timestamp: new Date().toISOString(),
                data_payload: data,
                tenant_id: data.tenantId,
                user_id: data.userId,
                metric_value: data.value || 0
            }]);

        if (error) throw error;
        return result;
    }

    async getData(dataType, filters = {}) {
        let query = this.client
            .from('tenant_analytics')
            .select('*')
            .order('timestamp', { ascending: false });

        if (dataType) {
            query = query.eq('data_type', dataType);
        }

        if (filters.startDate) {
            query = query.gte('timestamp', filters.startDate);
        }

        if (filters.endDate) {
            query = query.lte('timestamp', filters.endDate);
        }

        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data.map(item => item.data_payload);
    }
}

// API Endpoints

// Initialize connection
app.post('/api/init', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, storageType, supabaseUrl, supabaseKey } = req.body;

        // Validate Azure credentials
        const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);
        
        // Test connection
        const organization = await graphClient.api('/organization').get();

        // Initialize storage
        let storage;
        if (storageType === 'supabase') {
            storage = new SupabaseStorage(supabaseUrl, supabaseKey);
        } else {
            storage = new M365TenantStorage(graphClient);
            await storage.ensureList();
        }

        res.json({
            success: true,
            organization: organization.value[0],
            storageType,
            message: 'Successfully connected to Microsoft Graph API'
        });

    } catch (error) {
        console.error('Initialization error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get all users with license information
app.post('/api/users', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret } = req.body;
        const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);

        const users = await graphClient
            .api('/users')
            .select('id,displayName,userPrincipalName,accountEnabled,createdDateTime,signInActivity')
            .top(999)
            .get();

        // Get license details for each user
        const usersWithLicenses = await Promise.all(
            users.value.map(async (user) => {
                try {
                    const licenses = await graphClient
                        .api(`/users/${user.id}/licenseDetails`)
                        .get();

                    return {
                        ...user,
                        licenses: licenses.value,
                        isLicensed: licenses.value.length > 0
                    };
                } catch (error) {
                    return {
                        ...user,
                        licenses: [],
                        isLicensed: false
                    };
                }
            })
        );

        res.json({
            success: true,
            data: usersWithLicenses,
            count: usersWithLicenses.length
        });

    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get license information
app.post('/api/licenses', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret } = req.body;
        const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);

        const subscribedSkus = await graphClient
            .api('/subscribedSkus')
            .get();

        const licenseData = subscribedSkus.value.map(sku => ({
            skuId: sku.skuId,
            skuPartNumber: sku.skuPartNumber,
            servicePlans: sku.servicePlans,
            prepaidUnits: sku.prepaidUnits,
            consumedUnits: sku.consumedUnits,
            availableUnits: sku.prepaidUnits.enabled - sku.consumedUnits,
            utilizationPercentage: ((sku.consumedUnits / sku.prepaidUnits.enabled) * 100).toFixed(2)
        }));

        res.json({
            success: true,
            data: licenseData
        });

    } catch (error) {
        console.error('Error fetching licenses:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get usage reports
app.post('/api/reports/usage', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, period = 'D30' } = req.body;
        const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);

        const reports = await Promise.all([
            graphClient.api(`/reports/getOffice365ActiveUserDetail(period='${period}')`).get(),
            graphClient.api(`/reports/getEmailActivityUserDetail(period='${period}')`).get(),
            graphClient.api(`/reports/getTeamsUserActivityUserDetail(period='${period}')`).get(),
            graphClient.api(`/reports/getSharePointActivityUserDetail(period='${period}')`).get()
        ]);

        res.json({
            success: true,
            data: {
                activeUsers: reports[0],
                emailActivity: reports[1],
                teamsActivity: reports[2],
                sharePointActivity: reports[3]
            }
        });

    } catch (error) {
        console.error('Error fetching usage reports:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get security information
app.post('/api/security/overview', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret } = req.body;
        const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);

        const [secureScores, riskyUsers, devices, conditionalAccessPolicies] = await Promise.all([
            graphClient.api('/security/secureScores').top(1).get(),
            graphClient.api('/identityProtection/riskyUsers').get(),
            graphClient.api('/devices').get(),
            graphClient.api('/identity/conditionalAccess/policies').get()
        ]);

        const securityData = {
            secureScore: secureScores.value[0],
            riskyUsers: riskyUsers.value,
            devices: devices.value,
            conditionalAccessPolicies: conditionalAccessPolicies.value,
            summary: {
                currentScore: secureScores.value[0]?.currentScore || 0,
                maxScore: secureScores.value[0]?.maxScore || 0,
                riskyUserCount: riskyUsers.value.length,
                deviceCount: devices.value.length,
                activePolicies: conditionalAccessPolicies.value.filter(p => p.state === 'enabled').length
            }
        };

        res.json({
            success: true,
            data: securityData
        });

    } catch (error) {
        console.error('Error fetching security data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get mailbox information
app.post('/api/mailboxes', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, period = 'D30' } = req.body;
        const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);

        const mailboxUsage = await graphClient
            .api(`/reports/getMailboxUsageDetail(period='${period}')`)
            .get();

        // Parse CSV response
        const lines = mailboxUsage.split('\n');
        const headers = lines[0].split(',');
        const data = lines.slice(1).map(line => {
            const values = line.split(',');
            return headers.reduce((obj, header, index) => {
                obj[header.trim()] = values[index]?.trim();
                return obj;
            }, {});
        });

        // Identify inactive mailboxes
        const inactiveMailboxes = data.filter(mailbox => {
            const lastActivityDate = new Date(mailbox['Last Activity Date']);
            const daysSinceActivity = (Date.now() - lastActivityDate) / (1000 * 60 * 60 * 24);
            return daysSinceActivity > 90;
        });

        res.json({
            success: true,
            data: {
                allMailboxes: data,
                inactiveMailboxes,
                inactiveCount: inactiveMailboxes.length
            }
        });

    } catch (error) {
        console.error('Error fetching mailbox data:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Remediation actions

// Block user account
app.post('/api/remediation/block-user', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, userId } = req.body;
        const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);

        await graphClient
            .api(`/users/${userId}`)
            .patch({
                accountEnabled: false
            });

        res.json({
            success: true,
            message: 'User account blocked successfully'
        });

    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Revoke user sessions
app.post('/api/remediation/revoke-sessions', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, userId } = req.body;
        const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);

        await graphClient
            .api(`/users/${userId}/revokeSignInSessions`)
            .post({});

        res.json({
            success: true,
            message: 'User sessions revoked successfully'
        });

    } catch (error) {
        console.error('Error revoking sessions:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Remove license from user
app.post('/api/remediation/remove-license', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, userId, skuId } = req.body;
        const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);

        await graphClient
            .api(`/users/${userId}/assignLicense`)
            .post({
                addLicenses: [],
                removeLicenses: [skuId]
            });

        res.json({
            success: true,
            message: 'License removed successfully'
        });

    } catch (error) {
        console.error('Error removing license:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete user (soft delete)
app.post('/api/remediation/delete-user', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, userId } = req.body;
        const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);

        await graphClient
            .api(`/users/${userId}`)
            .delete();

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Save analytics data
app.post('/api/analytics/save', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, storageType, supabaseUrl, supabaseKey, dataType, data } = req.body;
        
        let storage;
        if (storageType === 'supabase') {
            storage = new SupabaseStorage(supabaseUrl, supabaseKey);
        } else {
            const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);
            storage = new M365TenantStorage(graphClient);
        }

        await storage.saveData(data, dataType);

        res.json({
            success: true,
            message: 'Data saved successfully'
        });

    } catch (error) {
        console.error('Error saving analytics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get analytics data
app.post('/api/analytics/get', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, storageType, supabaseUrl, supabaseKey, dataType, filters } = req.body;
        
        let storage;
        if (storageType === 'supabase') {
            storage = new SupabaseStorage(supabaseUrl, supabaseKey);
        } else {
            const graphClient = getAuthenticatedClient(tenantId, clientId, clientSecret);
            storage = new M365TenantStorage(graphClient);
        }

        const data = await storage.getData(dataType, filters);

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('Error retrieving analytics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`M365 Tenant Manager API running on port ${PORT}`);
});

module.exports = app;
