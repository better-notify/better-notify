import { describe, expect, it } from 'vitest';
import { handlebarsTemplate } from './index.js';

describe('@betternotify/handlebars (stub)', () => {
  it('returns an adapter that throws not-implemented at render time', async () => {
    const adapter = handlebarsTemplate<{ name: string }>('Hello {{name}}');
    await expect(adapter.render({ input: { name: 'x' }, ctx: {} })).rejects.toThrow(
      /not implemented/,
    );
  });
});
