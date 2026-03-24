import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Dependencies are now bundled to ensure version consistency
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    pool: 'threads',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/components/**/*.test.tsx'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      all: true,
      include: [
        'App.tsx',
        'types.ts',
        'components/*.tsx',
        'services/*.ts',
        'i18n/**/*.ts',
      ],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.swp',
        'services/supabaseClient.ts',
      ],
    },
  },
});