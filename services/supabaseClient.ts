import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = !!supabaseUrl && !!supabaseAnonKey;

// Safely create client - if config is missing, create a dummy one to prevent crash
export const supabase = isConfigured 
    ? createClient(supabaseUrl, supabaseAnonKey) 
    : createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.ZRrHA1JJJW8opsbqfvaHksT462IS48AT5fX6hdbd_7Q');