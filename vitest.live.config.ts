import { defineConfig } from 'vitest/config';

// Live smoke tests hit the real Spotify endpoints. Run on demand via
// `npm run test:live` — never part of `npm test` or CI (the default config
// does not include tests/live/ at all, and the tests self-skip when CI=1).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/live/**/*.live.test.ts'],
    testTimeout: 30_000,
    retry: 1,
  },
});
