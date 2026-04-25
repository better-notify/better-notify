import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['packages/*/src/**/*.test-d.ts', 'packages/*/src/**/*.test.ts'],
    },
  },
});
