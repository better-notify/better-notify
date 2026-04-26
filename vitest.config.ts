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
        'packages/core/src/types.ts',
        'packages/core/src/template.ts',
        'packages/core/src/plugin.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
