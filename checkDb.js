import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Helper to parse .env content robustly
const parseEnv = (content) => {
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) return;
    
    const firstEquals = trimmed.indexOf('=');
    if (firstEquals === -1) return;
    
    const key = trimmed.substring(0, firstEquals).trim();
    let value = trimmed.substring(firstEquals + 1).trim();
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    env[key] = value;
  });
  return env;
};

// Try loading .env.local first, then .env
let env = {};
const files = ['.env.local', '.env'];

for (const file of files) {
  try {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      console.log(`📄 Loading config from ${file}`);
      const envConfig = fs.readFileSync(envPath, 'utf8');
      const parsed = parseEnv(envConfig);
      env = { ...env, ...parsed };
    }
  } catch (e) {
    console.warn(`⚠️ Could not read ${file}:`, e.message);
  }
}

const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  console.log("Found keys:", Object.keys(env));
  console.log("Please ensure your .env.local file contains:");
  console.log("VITE_SUPABASE_URL=https://your-project.supabase.co");
  console.log("VITE_SUPABASE_ANON_KEY=your-anon-key");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log(`📡 Connecting to ${SUPABASE_URL}...`);

const { data, error } = await supabase.from('profiles').select('*');

if (error) console.error("❌ Error:", error.message);
else console.log("✅ Profiles found:", data);