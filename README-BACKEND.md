# M365 Tenant Manager - Backend Setup

## Why a Backend Server?

The backend server is required because:
1. **CORS Security**: Browsers block direct API calls to Microsoft's token endpoint from frontend JavaScript
2. **Client Secret Protection**: The Client Secret should never be exposed in browser code (visible in page source)
3. **Secure Authentication**: The server handles the client credentials flow securely

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Backend Server
```bash
npm start
```

The server will run on **http://localhost:3000**

### 3. Start the Frontend
In a separate terminal:
```bash
http-server -p 8000
```

The frontend will run on **http://localhost:8000**

### 4. Access the Application
Open your browser to: **http://localhost:8000/m365-tenant-manager-v2.html**

## How It Works

### Architecture
```
Browser (Frontend)          Backend Server (Node.js)       Microsoft APIs
     |                              |                            |
     |-- Azure Config ------------->|                            |
     |                              |-- Store Config             |
     |                              |                            |
     |-- Fetch Data Request ------->|                            |
     |                              |-- Get Token -------------->|
     |                              |<-- Access Token -----------|
     |                              |-- Call Graph API --------->|
     |                              |<-- User Data --------------|
     |<-- Return Data --------------|                            |
```

### API Endpoints

#### POST /api/config
Configure Azure credentials (sent once from frontend)
```json
{
  "tenantId": "your-tenant-id",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret"
}
```

#### GET /api/graph/*
Proxy requests to Microsoft Graph API

Examples:
- `GET /api/graph/users`
- `GET /api/graph/subscribedSkus`
- `GET /api/graph/security/secureScores`

#### GET /api/health
Check if the server is configured and running

## Security Notes

⚠️ **Important**: This is a development setup. For production:
1. Use environment variables for secrets (never hardcode)
2. Add authentication to the backend API
3. Use HTTPS for all connections
4. Implement rate limiting
5. Add proper error logging and monitoring

## Troubleshooting

### "Backend configuration failed" error
- Make sure the backend server is running (`npm start`)
- Check that it's listening on port 3000
- Verify no firewall is blocking localhost:3000

### "Permission denied" error
- Ensure you added **Application** permissions (not Delegated) in Azure Portal
- Grant admin consent in Azure Portal
- Verify the permissions are showing as "Granted" with a green checkmark

### "Authentication failed" error
- Double-check your Client Secret value
- Client Secrets expire - you may need to create a new one
- Verify Tenant ID and Client ID are correct
