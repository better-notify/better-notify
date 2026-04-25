import { describe, expect, it } from 'vitest';
import { reactEmail } from './index.js';

describe('@emailrpc/react-email (stub)', () => {
  it('returns an adapter that throws not-implemented at render time', async () => {
    const adapter = reactEmail<{ name: string }>(() => null);
    await expect(adapter.render({ name: 'x' })).rejects.toThrow(/not implemented/);
  });
});
