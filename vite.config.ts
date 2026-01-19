import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'recharts',
        'lucide-react',
        '@google/genai',
        '@supabase/supabase-js'
      ]
    }
  }
});