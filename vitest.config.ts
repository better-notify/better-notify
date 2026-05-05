import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    typecheck: {
      enabled: false,
      include: [
        'src/**/*.test-d.ts',
        'src/**/*.test.ts',
        'packages/*/src/**/*.test-d.ts',
        'packages/*/src/**/*.test.ts',
      ],
    },
    coverage: {
      enabled: true,
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test-d.ts',
        '**/types.ts',
        '**/*.types.ts',
        '**/with-*.types.ts',
        '**/template.ts',
        '**/transport.ts',
        '**/test-utils.ts',
        'packages/*/src/index.ts',
        'packages/*/src/transports/index.ts',
        'packages/*/src/middlewares/index.ts',
        'packages/*/src/plugins/index.ts',
        'packages/*/src/sinks/index.ts',
        'packages/*/src/stores/index.ts',
        'packages/*/src/tracers/index.ts',
        'packages/*/src/channel/index.ts',
        'packages/create-better-notify/src/**',
      ],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 100,
        statements: 100,
        functions: 100,
        branches: 100,
      },
    },
  },
});
