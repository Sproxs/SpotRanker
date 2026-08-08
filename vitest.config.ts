import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests live in tests/ (outside every tsconfig include) so `vue-tsc -b`
// never sweeps them into the production build. Live smoke tests
// (tests/live/) are intentionally invisible here — see vitest.live.config.ts.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['tests/setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'worker',
          environment: 'node',
          include: ['tests/worker/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'frontend',
          environment: 'happy-dom',
          include: ['tests/frontend/**/*.test.ts'],
        },
      },
    ],
  },
});
