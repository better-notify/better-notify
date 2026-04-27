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
        'packages/*/src/index.ts',
        'packages/*/src/transports/index.ts',
        'packages/*/src/middlewares/index.ts',
        'packages/*/src/plugins/index.ts',
        'packages/*/src/sinks/index.ts',
        'packages/*/src/stores/index.ts',
        'packages/*/src/tracers/index.ts',
        'packages/*/src/channel/index.ts',
        'packages/core/src/template.ts',
        'packages/core/src/transport.ts',
        'packages/core/src/lib/test-utils.ts',
        'packages/email/src/template.ts',
        'packages/email/src/lib/test-utils.ts',
      ],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
