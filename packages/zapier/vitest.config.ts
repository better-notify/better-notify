import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    typecheck: {
      enabled: false,
      include: ['src/**/*.test-d.ts', 'src/**/*.test.ts'],
    },
  },
});
