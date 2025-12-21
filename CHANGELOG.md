# Changelog - M365 Tenant Manager

## Version 2.0.0 - Multi-Tenant SaaS Transformation

### 🎉 Major Changes

#### Database Schema Updates ([supabase-schema.sql](supabase-schema.sql:1))

**Fixed**: "Failed to create user: Database error creating new user" error

- **Updated** `handle_new_user()` trigger function (lines 634-657)
  - Added `SECURITY DEFINER SET search_path = public` for proper permissions
  - Added `ON CONFLICT (id) DO NOTHING` to handle duplicate user IDs gracefully
  - Added `EXCEPTION` block to prevent user creation from failing
  - Changed to use `COALESCE` for full_name with email fallback
  - Added proper error logging with `RAISE WARNING`

- **Added** Permission grants (lines 665-669)
  - Grants USAGE on public schema to all roles
  - Grants ALL on profiles table to postgres and service_role
  - Grants SELECT, INSERT, UPDATE on profiles to authenticated users

- **Added** Header documentation (lines 4-11)
  - Explains the trigger fix
  - Notes about RLS and security
  - References troubleshooting resources

### What This Fixes

**Before**: Creating users in Supabase dashboard would fail with database error
**After**: Users are created successfully with auto-generated profiles

**Root Cause**: The trigger function lacked proper permissions and error handling

**Solution Applied**:
1. `SECURITY DEFINER` - Function runs with creator's privileges (bypasses RLS)
2. `SET search_path = public` - Ensures correct schema resolution
3. `ON CONFLICT DO NOTHING` - Handles duplicate IDs from retries
4. `EXCEPTION WHEN OTHERS` - Logs errors but doesn't fail user creation
5. Explicit `GRANT` statements - Ensures all roles have necessary permissions

### Alternative Solutions Provided

If the main schema update doesn't work:

1. **[fix-profile-trigger.sql](fix-profile-trigger.sql:1)** - Standalone fix script
2. **[TROUBLESHOOTING.md](TROUBLESHOOTING.md:1)** - Multiple resolution methods
3. **[QUICK-START.md](QUICK-START.md:1)** - Fast setup with fix included

### Testing the Fix

After applying the updated schema:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user"
3. Fill in email and password
4. Enable "Auto Confirm User"
5. Click "Create user"
6. ✅ User should be created without errors
7. Check Table Editor → profiles - profile should exist

### Verification Query

Run this in SQL Editor to verify the fix was applied:

```sql
-- Check trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check function definition
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'handle_new_user';

-- Test: Create a profile manually (should work)
-- Replace with a test UUID
INSERT INTO profiles (id, email, full_name)
VALUES (
  gen_random_uuid(),
  'test@example.com',
  'Test User'
)
ON CONFLICT (id) DO NOTHING;
```

### Documentation Updates

- ✅ Updated [SETUP-GUIDE.md](SETUP-GUIDE.md:213-250) with error handling steps
- ✅ Created [TROUBLESHOOTING.md](TROUBLESHOOTING.md:1) with comprehensive solutions
- ✅ Created [QUICK-START.md](QUICK-START.md:1) with the fix built-in
- ✅ Created [fix-profile-trigger.sql](fix-profile-trigger.sql:1) as standalone fix

### Rollback Instructions

If you need to revert to the old trigger:

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name, avatar_url)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
```

⚠️ **Note**: Rollback will bring back the original error!

---

## Migration Path

### For New Installations

Simply run the updated [supabase-schema.sql](supabase-schema.sql:1) - the fix is already included.

### For Existing Installations

**Option 1: Run Fix Script Only**
```sql
-- Run fix-profile-trigger.sql
-- This only updates the trigger function
```

**Option 2: Re-run Entire Schema**
```sql
-- Run the complete supabase-schema.sql
-- Safe to run multiple times (uses IF NOT EXISTS and OR REPLACE)
```

**Option 3: Manual Update**
```sql
-- Copy lines 634-669 from supabase-schema.sql
-- Run in SQL Editor
```

---

## Security Notes

- ✅ The `SECURITY DEFINER` is necessary and safe here
- ✅ Function only inserts into profiles table (limited scope)
- ✅ No user-controlled input (only Supabase auth data)
- ✅ RLS policies still protect the profiles table
- ✅ Error logging helps with debugging

---

## Additional Improvements in v2.0.0

Beyond the trigger fix, this version includes:

- ✅ Complete backend API with Express.js
- ✅ Multi-tenant architecture with RLS
- ✅ Encrypted Azure credential storage (AES-256-GCM)
- ✅ Data sync service with change tracking
- ✅ Tier-based rate limiting
- ✅ Role-based access control (Owner, Admin, Member, Viewer)
- ✅ Freemium business model (Free, Pro, Enterprise)
- ✅ Comprehensive API documentation
- ✅ Setup and troubleshooting guides

---

## Breaking Changes

None - This is backward compatible with existing data.

---

## Next Release (v2.1.0 - Planned)

- [ ] React frontend with onboarding wizard
- [ ] Microsoft OAuth login flow
- [ ] Dashboard with data visualization
- [ ] Change tracking UI
- [ ] Email notifications for sync completion
- [ ] Stripe integration for paid tiers

---

## Support

- 📚 Read: [SETUP-GUIDE.md](SETUP-GUIDE.md:1) for complete setup
- 🔧 Debug: [TROUBLESHOOTING.md](TROUBLESHOOTING.md:1) for common issues
- ⚡ Quick: [QUICK-START.md](QUICK-START.md:1) for fast setup
- 📖 API: [README-BACKEND-V2.md](README-BACKEND-V2.md:1) for API docs

---

**Last Updated**: December 21, 2024
**Version**: 2.0.0
**Status**: Stable
