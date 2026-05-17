import { describe, it, expect } from 'vitest';
import { createAuth } from './create-auth.js';

const makeRequest = (headers: Record<string, string> = {}): Request =>
  new Request('http://localhost/mcp', { headers });

describe('createAuth', () => {
  it('returns ok when fn returns ok', async () => {
    const auth = createAuth(() => ({ ok: true }));
    const result = await auth.verify(makeRequest());
    expect(result).toEqual({ ok: true });
  });

  it('returns failure with reason', async () => {
    const auth = createAuth(() => ({ ok: false, reason: 'nope' }));
    const result = await auth.verify(makeRequest());
    expect(result).toEqual({ ok: false, reason: 'nope' });
  });

  it('supports async fn', async () => {
    const auth = createAuth(async () => ({ ok: true, context: { userId: '123' } }));
    const result = await auth.verify(makeRequest());
    expect(result).toEqual({ ok: true, context: { userId: '123' } });
  });
});
