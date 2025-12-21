# M365 Tenant Manager - Complete Setup Guide

This guide will walk you through setting up the M365 Tenant Manager from scratch.

## 📋 Prerequisites

- ✅ Node.js 16+ installed
- ✅ npm or yarn package manager
- ✅ Supabase account (free tier works)
- ✅ Azure AD Global Administrator access (for testing)
- ✅ Git installed

## 🎯 Part 1: Supabase Setup (10 minutes)

### Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign in with GitHub or email
4. Click "New Project"
5. Choose your organization
6. Enter project details:
   - **Name**: M365-Tenant-Manager
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
7. Click "Create new project" (takes ~2 minutes)

### Step 2: Configure Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click "New query"
3. Open your local `supabase-schema.sql` file
4. Copy the **entire contents**
5. Paste into SQL Editor
6. Click "Run" (bottom right)
7. Verify success: Should see "Success. No rows returned"

### Step 3: Verify Tables Created

1. Go to **Table Editor** in left sidebar
2. You should see these tables:
   - profiles
   - tenants
   - tenant_members
   - azure_app_credentials
   - sync_history
   - data_changes
   - feature_limits
   - users (M365 data)
   - licenses
   - devices
   - mailboxes
   - security_events
   - etc.

### Step 4: Get API Credentials

1. Go to **Settings** > **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhb...` (safe for frontend)
   - **service_role key**: `eyJhb...` (backend only, keep secret!)

### Step 5: Configure Microsoft OAuth

1. In Supabase: **Authentication** > **Providers**
2. Find **Azure** and toggle it ON
3. You'll need an Azure AD app (create in Part 2)
4. Enter:
   - **Azure Tenant ID**: Your Azure AD tenant ID
   - **Application (client) ID**: From Azure app registration
   - **Client Secret**: From Azure app registration
5. Save configuration

## 🔧 Part 2: Azure AD App Registration (15 minutes)

### Step 1: Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Fill in details:
   - **Name**: M365 Tenant Manager Auth
   - **Supported account types**: Single tenant
   - **Redirect URI**:
     - Type: Web
     - URL: `https://your-project.supabase.co/auth/v1/callback`
5. Click **Register**

### Step 2: Configure Authentication

1. In your new app, go to **Authentication**
2. Under **Implicit grant and hybrid flows**, check:
   - ✅ ID tokens
3. Under **Advanced settings**:
   - Allow public client flows: **No**
4. Click **Save**

### Step 3: Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Description: "Supabase Auth"
4. Expires: Choose duration (24 months recommended)
5. Click **Add**
6. **IMMEDIATELY copy the Value** (you can't see it again!)
7. Save this secret securely

### Step 4: Copy Credentials

You now have:
- ✅ Application (client) ID: `12345678-1234-1234-1234-123456789abc`
- ✅ Directory (tenant) ID: `87654321-4321-4321-4321-cba987654321`
- ✅ Client secret value: `abc~def~ghi...`

Add these to your Supabase Azure provider (Part 1, Step 5).

## 🚀 Part 3: Backend Setup (10 minutes)

### Step 1: Clone/Download Project

```bash
cd your-projects-folder
# If using git:
git pull origin main

# Navigate to project
cd TenantAnalytics
```

### Step 2: Install Dependencies

```bash
npm install
```

This installs:
- Express web framework
- Supabase client
- Azure Identity & Graph client
- Rate limiting
- Encryption tools

### Step 3: Generate Encryption Key

```bash
npm run generate-key
```

Copy the output (64-character hex string): `ENCRYPTION_KEY=abc123...`

### Step 4: Configure Environment Variables

1. Copy example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` file with your values:
   ```env
   # Supabase (from Part 1, Step 4)
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyJhbG...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

   # Encryption (from Step 3)
   ENCRYPTION_KEY=your-64-char-hex-key

   # Server
   NODE_ENV=development
   PORT=3000
   APP_URL=http://localhost:3000
   FRONTEND_URL=http://localhost:3001
   ```

3. Save the file

### Step 5: Start the Server

```bash
npm run dev
```

You should see:
```
🚀 M365 Tenant Manager API Server
📍 Server running on port 3000
🌐 Environment: development
🔗 API URL: http://localhost:3000/api
💚 Health check: http://localhost:3000/health
```

### Step 6: Test the API

Open a new terminal and test:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-12-21T...",
  "service": "M365 Tenant Manager API",
  "version": "2.0.0"
}
```

## 🧪 Part 4: Testing the Flow (20 minutes)

### Test 1: User Signup

⚠️ **Common Issue**: If you get "Failed to create user: Database error creating new user", see the fix below.

#### Option A: Using Supabase Dashboard (may need fix)

1. Go to Supabase Dashboard > **Authentication** > **Users**
2. Click **Add user** manually (for testing):
   - **Email**: your@email.com
   - **Password**: Create a strong password
   - Auto-confirm: ON
3. Click **Create user**

**If you get an error:**
1. Go to **SQL Editor**
2. Run the contents of `fix-profile-trigger.sql`
3. Try creating the user again

#### Option B: Using Supabase API (recommended for testing)

```bash
curl -X POST 'https://YOUR-PROJECT.supabase.co/auth/v1/signup' \
  -H 'apikey: YOUR-ANON-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "data": {
      "full_name": "Test User"
    }
  }'
```

#### Verify User Created

1. Check **Authentication** > **Users** - user should appear
2. Check **Table Editor** > **profiles** - profile should be auto-created
3. Verify email is confirmed (or disable email confirmation in Auth settings)

### Test 2: Get Auth Token

Use Supabase client in browser console or use this approach:

1. Install a REST client (Postman, Insomnia, or Thunder Client for VS Code)
2. Create POST request:
   ```
   POST https://your-project.supabase.co/auth/v1/token?grant_type=password

   Headers:
   apikey: YOUR_ANON_KEY
   Content-Type: application/json

   Body:
   {
     "email": "your@email.com",
     "password": "your-password"
   }
   ```

3. Save the `access_token` from response

### Test 3: Create a Tenant

```http
POST http://localhost:3000/api/tenants

Headers:
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

Body:
{
  "tenant_id": "12345678-1234-1234-1234-123456789abc",
  "tenant_name": "Test Company",
  "domain": "testcompany.com"
}
```

Expected response:
```json
{
  "success": true,
  "message": "Tenant created successfully",
  "tenant": {
    "id": "uuid-here",
    "tenant_id": "12345678-1234-1234-1234-123456789abc",
    "tenant_name": "Test Company",
    "role": "owner"
  }
}
```

### Test 4: Setup Azure Credentials

```http
POST http://localhost:3000/api/azure/setup

Headers:
Authorization: Bearer YOUR_ACCESS_TOKEN
X-Tenant-ID: YOUR_TENANT_UUID
Content-Type: application/json

Body:
{
  "client_id": "your-azure-app-client-id",
  "tenant_id_azure": "your-azure-tenant-id",
  "client_secret": "your-azure-client-secret"
}
```

### Test 5: Get Admin Consent URL

```http
GET http://localhost:3000/api/azure/consent-url

Headers:
Authorization: Bearer YOUR_ACCESS_TOKEN
X-Tenant-ID: YOUR_TENANT_UUID
```

Copy the `consent_url` from response and open in browser. Sign in as Global Admin and grant consent.

### Test 6: Start a Sync

```http
POST http://localhost:3000/api/sync/start

Headers:
Authorization: Bearer YOUR_ACCESS_TOKEN
X-Tenant-ID: YOUR_TENANT_UUID
Content-Type: application/json

Body:
{
  "sync_types": ["users", "licenses"]
}
```

Save the `sync_id` from response.

### Test 7: Check Sync Status

```http
GET http://localhost:3000/api/sync/SYNC_ID/status

Headers:
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## ✅ Verification Checklist

After setup, verify:

- [ ] Supabase project created
- [ ] All database tables exist
- [ ] RLS policies enabled (check Table Editor > Policies)
- [ ] Microsoft OAuth configured in Supabase
- [ ] Azure AD app created with redirect URI
- [ ] Backend server starts without errors
- [ ] Health check endpoint returns 200
- [ ] User can sign up/login
- [ ] Tenant can be created
- [ ] Azure credentials can be saved
- [ ] Admin consent flow works
- [ ] Sync can be triggered

## 🚨 Common Issues

### "ENCRYPTION_KEY not set"

**Solution**: Run `npm run generate-key` and add to `.env`

### "Cannot connect to Supabase"

**Solution**:
1. Check SUPABASE_URL in `.env`
2. Verify project is active in Supabase dashboard
3. Check firewall/network restrictions

### "Invalid token" error

**Solution**:
1. Token may have expired (default: 1 hour)
2. Request new token with login endpoint
3. Check token is passed in Authorization header

### Sync fails with 401 Unauthorized

**Solution**:
1. Verify Azure app has correct permissions
2. Ensure admin consent was granted
3. Check credentials with `/api/azure/validate`

### Cross-tenant data visible

**Solution**:
1. RLS policies not enabled
2. Re-run RLS section of supabase-schema.sql
3. Test with different users/tenants

### Rate limit errors (429)

**Solution**:
- Free tier: 1 sync per 24 hours
- Wait for cooldown period
- Upgrade subscription tier

## 📚 Next Steps

1. **Build Frontend** - Create React app with login/onboarding
2. **Deploy to Production** - Railway/Vercel deployment
3. **Add Team Members** - Invite users to tenants
4. **Monitor Syncs** - Track data changes
5. **Upgrade Features** - Implement Pro/Enterprise features

## 🔒 Security Best Practices

1. ✅ Never commit `.env` file
2. ✅ Keep ENCRYPTION_KEY secret
3. ✅ Use SERVICE_ROLE_KEY only in backend
4. ✅ Enable SSL/TLS in production
5. ✅ Regularly rotate Azure client secrets
6. ✅ Monitor Supabase auth logs
7. ✅ Set up Sentry or error tracking

## 📞 Need Help?

- Check `README-BACKEND-V2.md` for API documentation
- Review Supabase logs: Dashboard > Logs
- Check server logs: `npm run dev` output
- Verify RLS policies in Supabase Table Editor

Enjoy your new multi-tenant M365 management platform! 🎉
