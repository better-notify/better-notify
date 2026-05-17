import { describe, it, expect } from 'vitest';
import { bearerAuth } from './bearer-auth.js';

const makeRequest = (headers: Record<string, string> = {}): Request =>
  new Request('http://localhost/mcp', { headers });

describe('bearerAuth', () => {
  it('accepts valid bearer token', async () => {
    const auth = bearerAuth('secret-token');
    const result = await auth.verify(makeRequest({ authorization: 'Bearer secret-token' }));
    expect(result).toEqual({ ok: true });
  });

  it('rejects invalid bearer token', async () => {
    const auth = bearerAuth('secret-token');
    const result = await auth.verify(makeRequest({ authorization: 'Bearer wrong-token' }));
    expect(result.ok).toBe(false);
  });

  it('rejects missing authorization header', async () => {
    const auth = bearerAuth('secret-token');
    const result = await auth.verify(makeRequest());
    expect(result.ok).toBe(false);
  });

  it('handles case-insensitive Bearer prefix', async () => {
    const auth = bearerAuth('my-secret');
    const result = await auth.verify(makeRequest({ authorization: 'bearer my-secret' }));
    expect(result).toEqual({ ok: true });
  });

  it('rejects tokens supplied without the Bearer scheme', async () => {
    const auth = bearerAuth('secret-token');
    const result = await auth.verify(makeRequest({ authorization: 'secret-token' }));
    expect(result.ok).toBe(false);
  });

  it('rejects an empty token after the Bearer scheme', async () => {
    const auth = bearerAuth('secret-token');
    const result = await auth.verify(makeRequest({ authorization: 'Bearer ' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a token of different length without throwing', async () => {
    const auth = bearerAuth('short');
    const result = await auth.verify(
      makeRequest({ authorization: 'Bearer much-longer-wrong-token' }),
    );
    expect(result.ok).toBe(false);
  });
});
