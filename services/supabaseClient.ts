import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only use real backend if we have keys AND we are in production mode (or if VITE_USE_REAL_DB is set)
// This ensures local dev (npm run dev) uses mock data even if keys are present in .env
export const isConfigured = (import.meta.env.PROD || import.meta.env.VITE_USE_REAL_DB === 'true') && !!supabaseUrl && !!supabaseAnonKey;

// Safely create client - if config is missing, create a dummy one to prevent crash
export const supabase = isConfigured 
    ? createClient(supabaseUrl, supabaseAnonKey) 
    : createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.ZRrHA1JJJW8opsbqfvaHksT462IS48AT5fX6hdbd_7Q');