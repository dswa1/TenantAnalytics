const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Store config (in production, use environment variables)
let azureConfig = {
    tenantId: '',
    clientId: '',
    clientSecret: ''
};

// Endpoint to save Azure configuration
app.post('/api/config', (req, res) => {
    const { tenantId, clientId, clientSecret } = req.body;

    if (!tenantId || !clientId || !clientSecret) {
        return res.status(400).json({ error: 'Missing required configuration' });
    }

    azureConfig = { tenantId, clientId, clientSecret };
    res.json({ success: true, message: 'Configuration saved' });
});

// Endpoint to get access token
app.get('/api/token', async (req, res) => {
    if (!azureConfig.tenantId || !azureConfig.clientId || !azureConfig.clientSecret) {
        return res.status(400).json({ error: 'Azure configuration not set. Please configure first.' });
    }

    const tokenEndpoint = `https://login.microsoftonline.com/${azureConfig.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        client_id: azureConfig.clientId,
        client_secret: azureConfig.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
    });

    try {
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const data = await response.json();

        if (!response.ok) {
            const errorMsg = data.error_description || data.error || 'Failed to get access token';
            return res.status(response.status).json({ error: errorMsg });
        }

        if (!data.access_token) {
            return res.status(500).json({ error: 'No access token received. Check your Client Secret.' });
        }

        res.json({
            access_token: data.access_token,
            expires_in: data.expires_in
        });
    } catch (error) {
        console.error('Error getting access token:', error);
        res.status(500).json({ error: error.message });
    }
});

// Proxy endpoint for Microsoft Graph API calls
app.get('/api/graph/*', async (req, res) => {
    // Get the path after /api/graph/
    const graphPath = req.params[0];
    const queryString = req.url.split('?')[1];
    const graphUrl = `https://graph.microsoft.com/v1.0/${graphPath}${queryString ? '?' + queryString : ''}`;

    // Get access token first
    const tokenEndpoint = `https://login.microsoftonline.com/${azureConfig.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        client_id: azureConfig.clientId,
        client_secret: azureConfig.clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials'
    });

    try {
        // Get token
        const tokenResponse = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || !tokenData.access_token) {
            return res.status(401).json({ error: 'Failed to authenticate with Microsoft' });
        }

        // Make Graph API request
        const graphResponse = await fetch(graphUrl, {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Content-Type': 'application/json'
            }
        });

        // Check if this is a report endpoint that returns CSV/text
        const contentType = graphResponse.headers.get('content-type');
        const isTextResponse = contentType && (contentType.includes('text/csv') || contentType.includes('text/plain') || contentType.includes('application/octet-stream'));

        if (isTextResponse || graphPath.includes('/reports/')) {
            // Return text response for reports
            const textData = await graphResponse.text();

            if (!graphResponse.ok) {
                return res.status(graphResponse.status).send(textData);
            }

            // Set content type to text/plain and send the CSV
            res.setHeader('Content-Type', 'text/plain');
            res.send(textData);
        } else {
            // Return JSON for regular endpoints
            const graphData = await graphResponse.json();

            if (!graphResponse.ok) {
                return res.status(graphResponse.status).json(graphData);
            }

            res.json(graphData);
        }
    } catch (error) {
        console.error('Error calling Graph API:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        configured: !!(azureConfig.tenantId && azureConfig.clientId && azureConfig.clientSecret)
    });
});

app.listen(PORT, () => {
    console.log(`🚀 M365 Tenant Manager API Server running on http://localhost:${PORT}`);
    console.log(`📊 Frontend should connect to: http://localhost:${PORT}/api`);
});
