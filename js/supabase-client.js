// ============================================================
// Supabase connection
// Get these from: Supabase Dashboard > Project Settings > API
// SUPABASE_URL      -> "Project URL"
// SUPABASE_ANON_KEY -> "anon public" key (safe to expose in frontend code)
// ============================================================
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
