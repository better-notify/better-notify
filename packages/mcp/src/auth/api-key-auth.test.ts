import { describe, it, expect } from 'vitest';
import { apiKeyAuth } from './api-key-auth.js';

const makeRequest = (headers: Record<string, string> = {}): Request =>
  new Request('http://localhost/mcp', { headers });

describe('apiKeyAuth', () => {
  it('throws when keys array is empty', () => {
    expect(() => apiKeyAuth({ keys: [] })).toThrow('apiKeyAuth requires at least one key');
  });

  it('accepts valid api key with default header', async () => {
    const auth = apiKeyAuth({ keys: ['key-1', 'key-2'] });
    const result = await auth.verify(makeRequest({ 'x-api-key': 'key-1' }));
    expect(result).toEqual({ ok: true });
  });

  it('accepts valid api key with custom header', async () => {
    const auth = apiKeyAuth({ header: 'x-custom-key', keys: ['abc'] });
    const result = await auth.verify(makeRequest({ 'x-custom-key': 'abc' }));
    expect(result).toEqual({ ok: true });
  });

  it('rejects invalid api key', async () => {
    const auth = apiKeyAuth({ keys: ['key-1'] });
    const result = await auth.verify(makeRequest({ 'x-api-key': 'wrong' }));
    expect(result.ok).toBe(false);
  });

  it('rejects missing header', async () => {
    const auth = apiKeyAuth({ keys: ['key-1'] });
    const result = await auth.verify(makeRequest());
    expect(result.ok).toBe(false);
  });
});
