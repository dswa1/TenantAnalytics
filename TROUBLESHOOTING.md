# Troubleshooting Guide - M365 Tenant Manager

## Issue: "Failed to create user: Database error creating new user"

This error occurs in Supabase when creating a user through the dashboard. Here are the solutions:

### Solution 1: Fix the Profile Trigger (Recommended)

The auto-profile creation trigger may have permission issues. Run the fix:

1. Go to Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Copy and paste the contents of `fix-profile-trigger.sql`
4. Click **Run**
5. Try creating the user again

### Solution 2: Create User via API (Alternative)

Instead of using Supabase dashboard, use the Supabase API:

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

### Solution 3: Disable Email Confirmation (For Testing)

1. Go to Supabase Dashboard → **Authentication** → **Settings**
2. Find **Email Auth** section
3. Disable "**Enable email confirmations**" (for development only!)
4. Try creating user again

### Solution 4: Manual Profile Creation

If trigger still fails, create profile manually after user creation:

1. Create user in **Authentication** → **Users** → **Add user**
2. Note the User ID
3. Go to **SQL Editor** and run:

```sql
INSERT INTO profiles (id, email, full_name, subscription_tier)
VALUES (
  'USER-UUID-HERE',
  'test@example.com',
  'Test User',
  'free'
);
```

### Solution 5: Check RLS Policies

The RLS policies might be blocking the insert. Temporarily disable RLS for testing:

1. Go to **Table Editor** → **profiles** table
2. Click the lock icon next to table name
3. Toggle **Enable RLS** OFF temporarily
4. Try creating user
5. Re-enable RLS after testing

**⚠️ WARNING:** Never disable RLS in production!

### Verify the Fix

After applying a solution, verify:

1. Create a test user
2. Check **Table Editor** → **profiles** - user should appear
3. Check **Authentication** → **Users** - user should be confirmed

---

## Issue: "Invalid token" or 401 Unauthorized

### Cause
JWT tokens expire after 1 hour by default.

### Solution
Request a new token:

```bash
curl -X POST 'https://YOUR-PROJECT.supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: YOUR-ANON-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "password": "YourPassword"
  }'
```

Save the new `access_token` from response.

---

## Issue: "Tenant ID required" (400 Error)

### Cause
Missing `X-Tenant-ID` header in request.

### Solution
Add header to all tenant-specific API calls:

```bash
curl -X GET 'http://localhost:3000/api/sync/history' \
  -H 'Authorization: Bearer YOUR-TOKEN' \
  -H 'X-Tenant-ID: YOUR-TENANT-UUID'
```

---

## Issue: Sync Fails with "Azure credentials not configured"

### Debugging Steps

1. **Check credentials exist:**
```bash
curl -X GET 'http://localhost:3000/api/azure/credentials' \
  -H 'Authorization: Bearer YOUR-TOKEN' \
  -H 'X-Tenant-ID: YOUR-TENANT-UUID'
```

2. **Validate credentials:**
```bash
curl -X POST 'http://localhost:3000/api/azure/validate' \
  -H 'Authorization: Bearer YOUR-TOKEN' \
  -H 'X-Tenant-ID: YOUR-TENANT-UUID'
```

3. **Check Supabase database:**
   - Go to **Table Editor** → **azure_app_credentials**
   - Verify your tenant has a record
   - Check `is_valid` and `consent_granted` columns

### Common Fixes

- Re-run Azure setup: `POST /api/azure/setup`
- Grant admin consent: `GET /api/azure/consent-url`
- Verify Azure app permissions in Azure Portal

---

## Issue: "Sync rate limit exceeded" (429 Error)

### Cause
You've exceeded the sync frequency for your subscription tier.

### Tier Limits (syncs per hour)
- **Free**: 1 sync every 24 hours
- **Pro**: 10 syncs per hour
- **Enterprise**: 60 syncs per hour

### Solution
Wait for the cooldown period or upgrade your tier:

```bash
# Check when you can sync again
curl -X GET 'http://localhost:3000/api/sync/latest' \
  -H 'Authorization: Bearer YOUR-TOKEN' \
  -H 'X-Tenant-ID: YOUR-TENANT-UUID'
```

Response includes `hours_since_sync` and `can_sync_now`.

---

## Issue: Server Won't Start - "ENCRYPTION_KEY not set"

### Solution

1. Generate a new key:
```bash
npm run generate-key
```

2. Copy the output to `.env`:
```env
ENCRYPTION_KEY=your-64-character-hex-key
```

3. Restart server:
```bash
npm run dev
```

---

## Issue: Cross-Tenant Data Visible (Security Issue!)

### Immediate Action Required

This means RLS policies aren't working!

1. **Stop using the application immediately**
2. Go to Supabase **Table Editor**
3. For each table, verify RLS is enabled:
   - profiles ✅
   - tenants ✅
   - tenant_members ✅
   - users ✅
   - licenses ✅
   - All data tables ✅

4. Click each table name, verify policies exist:
   - Go to **Policies** tab
   - Should see policies like "Access tenant users"

5. If missing, re-run the RLS section from `supabase-schema.sql`

---

## Issue: Cannot Connect to Supabase

### Check Network

```bash
curl https://YOUR-PROJECT.supabase.co/rest/v1/
```

### Verify Environment Variables

```bash
# Check .env file
cat .env | grep SUPABASE
```

Should show:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Verify Project Status

1. Go to Supabase Dashboard
2. Check project status (should be "Active")
3. Check for any paused/disabled notices

---

## Issue: Admin Consent Redirect Fails

### Check Redirect URI

1. In Azure Portal → Your App → **Authentication**
2. Verify redirect URI matches:
   ```
   https://YOUR-PROJECT.supabase.co/auth/v1/callback
   ```

3. Also add for backend:
   ```
   http://localhost:3000/api/azure/consent-callback
   ```

### Check State Parameter

The state parameter encodes tenant and user info. If it fails:

1. Check browser console for errors
2. Verify `APP_URL` in `.env` is correct
3. Test consent URL in incognito mode

---

## Database Schema Issues

### Missing Tables

Re-run the schema:

```sql
-- In Supabase SQL Editor
\i supabase-schema.sql
```

### Column Doesn't Exist

Check table structure:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'your_table_name';
```

### Foreign Key Violations

Check relationships:

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
```

---

## Getting More Help

### Enable Debug Logging

In `.env`:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

Restart server and check detailed logs.

### Check Supabase Logs

1. Supabase Dashboard → **Logs**
2. Filter by:
   - API logs
   - Auth logs
   - Database logs

### Test Individual Components

```bash
# Test Supabase connection
node -e "const { createClient } = require('@supabase/supabase-js'); const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY); client.from('profiles').select('*').then(console.log)"

# Test encryption
node -e "const crypto = require('crypto'); console.log('ENCRYPTION_KEY=' + crypto.randomBytes(32).toString('hex'))"

# Test server health
curl http://localhost:3000/health
```

### Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 400 | Bad Request | Check request body/headers |
| 401 | Unauthorized | Token expired or invalid |
| 403 | Forbidden | Insufficient permissions/role |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate record (check unique constraints) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Check server logs |

---

## Still Having Issues?

1. Check server logs: `npm run dev` output
2. Check Supabase logs: Dashboard → Logs
3. Verify all environment variables are set
4. Test with a fresh Supabase project
5. Review SETUP-GUIDE.md step-by-step

If the issue persists, gather:
- Server logs
- Supabase logs
- Request/response details
- Environment (Node version, OS, etc.)
