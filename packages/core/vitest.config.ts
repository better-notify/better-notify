import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    typecheck: {
      enabled: true,
      include: ['src/**/*.test.ts'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.test-d.ts',
        '**/types.ts',
        '**/*.types.ts',
        'src/template.ts',
        'src/plugin.ts',
        'src/queue/index.ts',
      ],
    },
  },
});
