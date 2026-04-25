import { describe, expect, it } from 'vitest';
import { bullmq } from './index.js';

describe('@emailrpc/bullmq (stub)', () => {
  it('throws not-implemented at construction', () => {
    expect(() => bullmq({ connection: { url: 'redis://localhost:6379' } })).toThrow(
      /not implemented/,
    );
  });
});
