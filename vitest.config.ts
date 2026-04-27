import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    typecheck: {
      enabled: false,
      include: ['packages/*/src/**/*.test-d.ts', 'packages/*/src/**/*.test.ts'],
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test-d.ts',
        '**/types.ts',
        '**/multi.types.ts',
        '**/with-*.types.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
