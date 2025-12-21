const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase client with service role key (for backend use only)
// This bypasses RLS and should NEVER be exposed to the frontend
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Supabase client with anon key (for frontend use)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = {
  supabase,
  supabaseAnon
};
