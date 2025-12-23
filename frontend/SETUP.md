# M365 Tenant Manager - React Frontend Setup

Secure React frontend for the M365 Tenant Manager multi-tenant SaaS platform.

## 🔒 Security Features

This React app is built with security as the top priority:

- ✅ **No credentials in frontend** - Azure secrets and Supabase service role key stay in backend only
- ✅ **JWT authentication** - Only Supabase anon key and user tokens in browser
- ✅ **Backend API proxy** - All Microsoft Graph calls go through backend
- ✅ **Row Level Security** - Supabase RLS policies enforce data isolation
- ✅ **No business logic** - Data processing happens in backend
- ✅ **HTTPS only** - Enforced in production

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Create `.env` file in `frontend/` directory:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here
REACT_APP_API_URL=http://localhost:3000
```

**IMPORTANT:** Only use the Supabase **anon key** (public role key), NEVER the service role key!

To find your keys:
1. Go to Supabase Dashboard → Settings → API
2. Copy **URL** and **anon/public** key
3. DO NOT use the `service_role` key in frontend!

### 3. Run Development Server

```bash
npm start
```

App will open at [http://localhost:3001](http://localhost:3001)

### 4. Build for Production

```bash
npm run build
```

This creates an optimized production build in `build/` folder.

The backend server is already configured to serve this build.

## 📁 Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── auth/              # Login, OAuth callbacks
│   │   ├── onboarding/        # Tenant setup flow
│   │   ├── dashboard/         # Main dashboard and tabs
│   │   └── common/            # Reusable components
│   ├── contexts/
│   │   ├── AuthContext.jsx    # Authentication state
│   │   └── TenantContext.jsx  # Tenant selection state
│   ├── services/
│   │   ├── api.js             # Backend API client (with JWT)
│   │   └── supabase.js        # Supabase client (anon key only)
│   ├── utils/
│   │   ├── formatters.js      # Date, number, byte formatters
│   │   └── constants.js       # App constants
│   ├── App.jsx                # Main app with routing
│   └── index.js               # Entry point
├── .env                       # Environment variables (DO NOT COMMIT!)
└── tailwind.config.js         # Tailwind CSS config
```

## 🔐 Security Checklist

Before deploying to production:

- [ ] `.env` file is NOT committed to git
- [ ] Only Supabase anon key in `.env` (not service role key)
- [ ] No Azure credentials in frontend code
- [ ] HTTPS enabled in production
- [ ] Backend API_URL uses HTTPS in production
- [ ] CORS configured correctly in backend

## 🐛 Troubleshooting

### "Invalid credentials" or 401 errors

- Check that backend is running on port 3000
- Verify JWT token is valid (try logging out and back in)
- Check `.env` has correct `REACT_APP_API_URL`

### "CORS error"

- Verify backend `FRONTEND_URL` matches your frontend URL
- Check backend CORS configuration in `backend/server.js`

### "Supabase error"

- Verify `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` are correct
- DO NOT use service role key in frontend
- Check Supabase RLS policies are enabled
