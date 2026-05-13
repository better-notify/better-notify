import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { generateVapidKeys } from '../crypto.js';
import { vapidTransport } from './vapid.js';

const toBase64Url = (buf: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i]!);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let subKeys: { p256dh: string; auth: string };

beforeAll(async () => {
  const ecdhKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const rawPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ecdhKeys.publicKey));
  const authBytes = crypto.getRandomValues(new Uint8Array(16));
  subKeys = {
    p256dh: toBase64Url(rawPublic),
    auth: toBase64Url(authBytes),
  };
});

const sub = (endpoint = 'https://fcm.googleapis.com/fcm/send/abc') => ({
  endpoint,
  keys: subKeys,
});

const invalidSub = (endpoint = 'https://fcm.googleapis.com/fcm/send/abc') => ({
  endpoint,
  keys: { p256dh: 'invalid-key', auth: 'invalid-auth' },
});

const hrefOf = (url: unknown): string => (url instanceof URL ? url.href : String(url));

const ctx = { route: 'test', messageId: '1', attempt: 1 };

describe('vapidTransport', () => {
  let keys: { publicKey: string; privateKey: string };

  beforeEach(async () => {
    keys = await generateVapidKeys();
  });

  it('has name "webpush-vapid"', () => {
    const transport = vapidTransport({
      publicKey: 'pub',
      privateKey: 'priv',
      subject: 'mailto:test@example.com',
    });
    expect(transport.name).toBe('webpush-vapid');
  });

  it('returns error when no subscriptions are provided', async () => {
    const transport = vapidTransport({
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject: 'mailto:test@example.com',
    });

    const result = await transport.send({ title: 'Hi', body: 'Hello' }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('no subscriptions');
    }
  });

  it('sends to a subscription endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);

    const transport = vapidTransport({
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject: 'mailto:test@example.com',
    });

    const s = sub();
    const result = await transport.send({ title: 'Hi', body: 'Hello', to: s }, ctx);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.results).toHaveLength(1);
      expect(result.data.results[0]!.ok).toBe(true);
    }
    expect(fetchSpy).toHaveBeenCalledOnce();

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(hrefOf(url)).toBe(s.endpoint);
    expect(init.method).toBe('POST');
    const headers =
      init.headers instanceof Headers ? init.headers : new Headers(init.headers as HeadersInit);
    expect(headers.get('Content-Encoding')).toBe('aes128gcm');
    expect(headers.get('Authorization')).toMatch(/^vapid t=.+,k=.+$/);

    vi.unstubAllGlobals();
  });

  it('reports gone subscriptions', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 410 }));
    vi.stubGlobal('fetch', fetchSpy);

    const transport = vapidTransport({
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject: 'mailto:test@example.com',
    });

    const result = await transport.send({ title: 'Hi', body: 'Hello', to: sub() }, ctx);

    expect(result.ok).toBe(false);
    vi.unstubAllGlobals();
  });

  it('handles multiple subscriptions with mixed results', async () => {
    const fetchSpy = vi.fn().mockImplementation((url: unknown) => {
      const href = hrefOf(url);
      if (href === 'https://a.com/1') {
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      return Promise.resolve(new Response(null, { status: 410 }));
    });
    vi.stubGlobal('fetch', fetchSpy);

    const transport = vapidTransport({
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject: 'mailto:test@example.com',
    });

    const result = await transport.send(
      { title: 'Hi', body: 'Hello', to: [sub('https://a.com/1'), sub('https://b.com/2')] },
      ctx,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.results).toHaveLength(2);
      const aResult = result.data.results.find((r) => r.endpoint === 'https://a.com/1');
      const bResult = result.data.results.find((r) => r.endpoint === 'https://b.com/2');
      expect(aResult!.ok).toBe(true);
      expect(bResult!.ok).toBe(false);
      expect(bResult!.gone).toBe(true);
    }

    vi.unstubAllGlobals();
  });

  it('returns failure when VAPID JWT generation fails', async () => {
    const transport = vapidTransport({
      publicKey: 'invalid',
      privateKey: 'invalid',
      subject: 'mailto:test@example.com',
    });

    const result = await transport.send({ title: 'Hi', body: 'Hello', to: sub() }, ctx);

    expect(result.ok).toBe(false);
  });

  it('returns failure when payload encryption fails', async () => {
    const transport = vapidTransport({
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject: 'mailto:test@example.com',
    });

    const result = await transport.send({ title: 'Hi', body: 'Hello', to: invalidSub() }, ctx);

    expect(result.ok).toBe(false);
  });

  it('handles network errors', async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    vi.stubGlobal('fetch', fetchSpy);

    const transport = vapidTransport({
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject: 'mailto:test@example.com',
    });

    const result = await transport.send({ title: 'Hi', body: 'Hello', to: sub() }, ctx);

    expect(result.ok).toBe(false);
    vi.unstubAllGlobals();
  });

  it('handles non-gone HTTP errors (e.g. 500)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 500 }));
    vi.stubGlobal('fetch', fetchSpy);

    const transport = vapidTransport({
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject: 'mailto:test@example.com',
    });

    const result = await transport.send({ title: 'Hi', body: 'Hello', to: sub() }, ctx);

    expect(result.ok).toBe(false);
    vi.unstubAllGlobals();
  });

  it('accepts custom http options', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);

    const transport = vapidTransport({
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject: 'mailto:test@example.com',
      http: { timeoutMs: 5_000 },
    });

    const result = await transport.send({ title: 'Hi', body: 'Hello', to: sub() }, ctx);
    expect(result.ok).toBe(true);

    vi.unstubAllGlobals();
  });
});
