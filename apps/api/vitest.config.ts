import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    // Integration tests share one test database and truncate tables between
    // cases, so test files must not run in parallel against each other.
    fileParallelism: false,
  },
});
