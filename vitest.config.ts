import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
    // The SQLite driver keeps a single in-memory database per process, so the
    // suite runs in one fork to keep the database deterministic.
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    restoreMocks: true,
  },
});
