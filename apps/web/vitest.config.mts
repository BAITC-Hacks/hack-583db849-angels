import { defineConfig } from 'vitest/config';

/**
 * jsdom for every test: the MSW handlers read and write `document.cookie`, so a
 * node environment could not exercise the mock session at all.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**'],
    restoreMocks: true,
  },
});
