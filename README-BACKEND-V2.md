# M365 Tenant Manager - Backend API v2.0

Multi-tenant SaaS backend for Microsoft 365 management and analytics with Supabase authentication, encrypted credentials, and data sync with change tracking.

## 🚀 Features

- ✅ **Multi-tenant Architecture** - Complete tenant isolation with Row Level Security (RLS)
- ✅ **Supabase Authentication** - JWT-based auth with Microsoft OAuth support
- ✅ **Encrypted Azure Credentials** - AES-256-GCM encryption for client secrets
- ✅ **Data Sync & Change Tracking** - Delta detection for all M365 data
- ✅ **Freemium Tiers** - Free, Pro, and Enterprise subscription levels
- ✅ **Tier-based Rate Limiting** - Automatic limits based on subscription
- ✅ **Role-based Access Control** - Owner, Admin, Member, Viewer roles
- ✅ **Comprehensive API** - RESTful endpoints for all operations

## 📁 Project Structure

```
backend/
├── config/
│   ├── supabase.js          # Supabase client configuration
│   └── encryption.js        # Encryption key validation
├── middleware/
│   ├── auth.js              # JWT authentication
│   ├── tenantContext.js     # Tenant access validation
│   ├── rateLimiter.js       # Tier-based rate limiting
│   └── errorHandler.js      # Global error handling
├── routes/
│   ├── tenants.js           # Tenant management endpoints
│   ├── azure.js             # Azure credentials & setup
│   └── sync.js              # Data synchronization
├── services/
│   ├── EncryptionService.js # AES-256-GCM encryption
│   └── SyncService.js       # M365 data sync logic
└── server.js                # Main Express application
```

## 🔧 Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
# Copy example file
cp .env.example .env

# Generate encryption key
npm run generate-key
```

### 3. Configure .env File

```env
# Supabase (from https://app.supabase.com/project/_/settings/api)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Encryption (generated with npm run generate-key)
ENCRYPTION_KEY=your-64-char-hex-key

# Server
PORT=3000
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
```

### 4. Set Up Supabase Database

1. Go to your Supabase project SQL Editor
2. Run the entire `supabase-schema.sql` file
3. Verify all tables and RLS policies are created

### 5. Configure Microsoft OAuth

1. In Supabase Dashboard: Authentication > Providers
2. Enable **Azure** provider
3. Add your Azure AD app credentials
4. Set redirect URL: `https://your-project.supabase.co/auth/v1/callback`

### 6. Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server will start on http://localhost:3000

## 📚 API Endpoints

### Authentication

Authentication is handled by Supabase Auth. All API requests require a Bearer token:

```http
Authorization: Bearer YOUR_SUPABASE_JWT_TOKEN
```

### Tenants

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/tenants` | List user's tenants | Required |
| GET | `/api/tenants/:id` | Get tenant details | Required |
| POST | `/api/tenants` | Create new tenant | Required |
| PUT | `/api/tenants/:id` | Update tenant | Owner only |
| DELETE | `/api/tenants/:id` | Delete tenant | Owner only |
| GET | `/api/tenants/:id/members` | List members | Required |
| POST | `/api/tenants/:id/members` | Add member | Owner/Admin |
| PUT | `/api/tenants/:id/members/:memberId` | Update member role | Owner/Admin |
| DELETE | `/api/tenants/:id/members/:memberId` | Remove member | Owner/Admin |

### Azure Setup

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/azure/setup` | Save Azure credentials | Owner/Admin |
| GET | `/api/azure/credentials` | Get credentials (no secret) | Required |
| GET | `/api/azure/consent-url` | Generate admin consent URL | Required |
| GET | `/api/azure/consent-callback` | Handle consent callback | Public |
| POST | `/api/azure/validate` | Validate credentials | Owner/Admin |
| DELETE | `/api/azure/credentials` | Delete credentials | Owner only |
| GET | `/api/azure/permissions` | List required permissions | Required |

### Data Sync

| Method | Endpoint | Description | Auth | Rate Limit |
|--------|----------|-------------|------|------------|
| POST | `/api/sync/start` | Start sync job | Required | Tier-based |
| GET | `/api/sync/:id/status` | Get sync status | Required | - |
| GET | `/api/sync/history` | List sync history | Required | - |
| GET | `/api/sync/changes` | Get data changes | Required | - |
| GET | `/api/sync/latest` | Get latest sync | Required | - |
| DELETE | `/api/sync/:id` | Cancel running sync | Required | - |

## 🔐 Security

### Row Level Security (RLS)

All data tables have RLS policies enforcing multi-tenant isolation:

- Users can only access tenants they're members of
- Azure credentials only accessible via backend service role
- Profile auto-creation on signup
- Membership-based data access

### Encryption

Azure client secrets are encrypted with AES-256-GCM:

```javascript
const EncryptionService = require('./services/EncryptionService');

// Encrypt
const encrypted = EncryptionService.encrypt(clientSecret);

// Decrypt
const decrypted = EncryptionService.decrypt(encrypted);
```

### Rate Limiting

Tier-based rate limits (per 15 minutes):

| Tier | API Requests | Syncs (per hour) |
|------|--------------|------------------|
| Free | 100 | 1 |
| Pro | 500 | 10 |
| Enterprise | 2000 | 60 |

## 📊 Data Sync & Change Tracking

### Starting a Sync

```javascript
POST /api/sync/start
Headers:
  Authorization: Bearer TOKEN
  X-Tenant-ID: tenant-uuid
Body:
{
  "sync_types": ["users", "licenses", "devices"]
}
```

### Viewing Changes

```javascript
GET /api/sync/changes?since=2024-01-01T00:00:00Z&data_type=users
```

Response includes:
- Added records
- Updated records
- Deleted records
- Old vs new data comparison

### Change Types

The system tracks three types of changes:

1. **Added** - New records from M365
2. **Updated** - Existing records with changes
3. **Deleted** - Records removed from M365

## 🎯 Subscription Tiers

### Feature Limits

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Max Tenants | 1 | 3 | Unlimited |
| Max Users/Tenant | 50 | 500 | Unlimited |
| Data Retention | 7 days | 90 days | 365 days |
| Sync Frequency | 24 hours | 6 hours | 1 hour |
| Advanced Analytics | ❌ | ✅ | ✅ |
| API Access | ❌ | ✅ | ✅ |
| Change Tracking | ❌ | ✅ | ✅ |
| Priority Support | ❌ | ❌ | ✅ |
| White Label | ❌ | ❌ | ✅ |

## 🛠️ Development

### Running Tests

```bash
npm test
```

### Debugging

Enable detailed logging:

```env
LOG_LEVEL=debug
```

### Database Migrations

All schema changes should be added to `supabase-schema.sql` and tested in a development environment first.

## 🚀 Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Configure production URLs in `.env`
3. Set up SSL/TLS certificates
4. Configure Supabase production instance

### Recommended Platforms

- **Backend**: Railway, DigitalOcean App Platform, AWS Elastic Beanstalk
- **Database**: Supabase Pro tier ($25/month minimum)
- **Frontend**: Vercel, Netlify

## 📖 API Usage Examples

### Create a Tenant

```javascript
const response = await fetch('http://localhost:3000/api/tenants', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    tenant_id: 'microsoft-tenant-id',
    tenant_name: 'Acme Corporation',
    domain: 'acme.com'
  })
});
```

### Setup Azure Credentials

```javascript
const response = await fetch('http://localhost:3000/api/azure/setup', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId
  },
  body: JSON.stringify({
    client_id: 'azure-app-client-id',
    tenant_id_azure: 'azure-tenant-id',
    client_secret: 'azure-client-secret'
  })
});
```

### Start a Sync

```javascript
const response = await fetch('http://localhost:3000/api/sync/start', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId
  },
  body: JSON.stringify({
    sync_types: ['users', 'licenses']
  })
});

const { sync_id } = await response.json();

// Poll for status
const status = await fetch(`http://localhost:3000/api/sync/${sync_id}/status`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

## ⚠️ Important Notes

1. **Never expose ENCRYPTION_KEY** - This is used to encrypt Azure client secrets
2. **Use SERVICE_ROLE_KEY only in backend** - Never expose to frontend
3. **Test RLS policies thoroughly** - Ensure no cross-tenant data leaks
4. **Rate limit enforcement** - Implement frontend handling for 429 errors
5. **Sync frequency limits** - Respect tier-based sync restrictions

## 🐛 Troubleshooting

### "Encryption key not set" Error

Run: `npm run generate-key` and add to `.env`

### "Invalid token" Error

Ensure you're using a valid Supabase JWT token from authentication.

### Sync Fails with 401

1. Check Azure credentials are valid
2. Verify admin consent was granted
3. Validate credentials: `POST /api/azure/validate`

### Cross-tenant data visible

RLS policies may not be enabled. Re-run the RLS section of `supabase-schema.sql`.

## 📞 Support

For issues, please check:
1. Server logs: `npm run dev`
2. Supabase logs: Dashboard > Logs
3. API responses for error details

## 📝 License

MIT License - See LICENSE file for details
