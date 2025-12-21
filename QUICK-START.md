# Quick Start Guide - M365 Tenant Manager

## 🚀 Get Running in 10 Minutes

### 1. Fix Supabase Profile Creation (2 min)

The "Failed to create user" error is common. Here's the immediate fix:

1. Open Supabase Dashboard → **SQL Editor**
2. Click **New query**
3. Copy and paste this:

```sql
-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create fixed version
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

4. Click **Run**
5. ✅ Done! User creation should work now

### 2. Disable Email Confirmation (1 min)

For testing, disable email verification:

1. Go to **Authentication** → **Settings**
2. Find **Email Auth** section
3. Toggle OFF "**Enable email confirmations**"
4. Click **Save**

### 3. Create Test User (1 min)

Now create a user:

1. Go to **Authentication** → **Users**
2. Click **Add user**
3. Fill in:
   - Email: `test@example.com`
   - Password: `Test123456!`
   - Auto Confirm User: ✅ ON
4. Click **Create user**

### 4. Verify Profile Created (30 sec)

1. Go to **Table Editor** → **profiles**
2. You should see your test user
3. Note the `id` (UUID) - you'll need this

### 5. Set Up Environment (2 min)

```bash
# Copy environment template
cp .env.example .env

# Generate encryption key
npm run generate-key
```

Copy the output and edit `.env`:

```env
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
ENCRYPTION_KEY=your-generated-key-here

NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3001
```

### 6. Start Server (1 min)

```bash
npm run dev
```

You should see:
```
🚀 M365 Tenant Manager API Server
📍 Server running on port 3000
✅ All systems ready!
```

### 7. Get Auth Token (1 min)

Use curl or Postman:

```bash
curl -X POST 'https://YOUR-PROJECT.supabase.co/auth/v1/token?grant_type=password' \
  -H 'apikey: YOUR-ANON-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "test@example.com",
    "password": "Test123456!"
  }'
```

Copy the `access_token` from response.

### 8. Create Your First Tenant (1 min)

```bash
curl -X POST 'http://localhost:3000/api/tenants' \
  -H 'Authorization: Bearer YOUR-ACCESS-TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "tenant_id": "12345678-1234-1234-1234-123456789abc",
    "tenant_name": "Test Company",
    "domain": "test.com"
  }'
```

Save the tenant `id` from response.

### 9. Verify Everything Works (1 min)

```bash
# List your tenants
curl -X GET 'http://localhost:3000/api/tenants' \
  -H 'Authorization: Bearer YOUR-ACCESS-TOKEN'

# Should return your test tenant
```

## ✅ You're Done!

Your multi-tenant SaaS backend is now running!

## 🎯 Next Steps

1. **Add Azure Credentials**: Set up Microsoft Graph access
2. **Start a Sync**: Pull data from M365
3. **View Changes**: Track what changed
4. **Build Frontend**: Create React app for users

## 📚 Full Guides

- **SETUP-GUIDE.md** - Complete setup with Azure integration
- **README-BACKEND-V2.md** - Full API documentation
- **TROUBLESHOOTING.md** - Common issues and fixes

## 🆘 Common Quick Fixes

### "Invalid token"
Token expired. Get a new one (Step 7).

### "Tenant ID required"
Add header: `-H 'X-Tenant-ID: your-tenant-uuid'`

### "ENCRYPTION_KEY not set"
Run: `npm run generate-key` and add to `.env`

### Server won't start
Check `.env` file has all required variables.

## 🧪 Test API Endpoints

```bash
# Health check
curl http://localhost:3000/health

# API info
curl http://localhost:3000/api

# List tenants
curl http://localhost:3000/api/tenants \
  -H 'Authorization: Bearer TOKEN'

# Get Azure permissions required
curl http://localhost:3000/api/azure/permissions \
  -H 'Authorization: Bearer TOKEN'
```

## 🎉 Success!

You now have a working multi-tenant SaaS backend with:
- ✅ Authentication
- ✅ Multi-tenancy
- ✅ Encrypted credentials
- ✅ Data sync capability
- ✅ Change tracking
- ✅ Freemium tiers

Start building your frontend or integrate with your existing app!
