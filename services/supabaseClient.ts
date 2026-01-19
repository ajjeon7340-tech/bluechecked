import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gktxidrombffoafnvyir.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debugging: Log to browser console to verify keys are loaded
if (!supabaseKey) {
    console.error("❌ Supabase Anon Key missing! Check .env.local for VITE_SUPABASE_ANON_KEY");
} else {
    console.log("✅ Supabase Client initialized with:", supabaseUrl);
}

export const isConfigured = !!(supabaseUrl && supabaseKey && supabaseUrl.startsWith('http'));

// Initialize client with empty strings if missing to avoid crash, but allow App.tsx to handle the connection error
// We use a valid but empty URL structure to prevent 'ERR_NAME_NOT_RESOLVED' network noise in console
const validUrl = isConfigured ? supabaseUrl : 'https://missing-env-vars.supabase.co';

export const supabase = createClient(validUrl, supabaseKey || 'missing-key');
