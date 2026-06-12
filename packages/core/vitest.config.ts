import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Default to a Node-like environment (simulates native: no `window`/`document`).
    // Web/SSR-sensitive suites opt into jsdom per-file via `// @vitest-environment jsdom`.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
});
