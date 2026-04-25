import { describe, expect, it } from 'vitest';
import { defineConfig } from './config.js';

describe('defineConfig', () => {
  it('returns the input config unchanged', () => {
    const config = {
      router: './emails/router.ts',
      provider: './emails/provider.ts',
      templates: { engine: 'react' as const, dir: './emails/templates' },
    };
    expect(defineConfig(config)).toBe(config);
  });
});
