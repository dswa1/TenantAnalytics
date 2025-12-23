import { createClient } from '@supabase/supabase-js';

// Only use anon key in frontend (safe for public)
// Service role key MUST stay in backend only!
export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);
