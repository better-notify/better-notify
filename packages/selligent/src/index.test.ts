import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { RenderedMessage } from '@betternotify/email';
import type { SendContext } from '@betternotify/core';
import { NotifyRpcProviderError } from '@betternotify/core';

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const baseMessage: RenderedMessage = {
  from: { name: 'App', email: 'noreply@example.com' },
  to: [{ email: 'user@example.com' }],
  subject: 'Hello',
  html: '<p>hi</p>',
  text: 'hi',
};

const baseCtx: SendContext = { route: 'welcome', messageId: 'm1', attempt: 1 };

const tokenResponse = {
  access_token: 'jwt_token_123',
  token_type: 'Bearer',
  refresh_token: 'refresh_456',
  scope: 'send:email',
  expires_in: 86400,
};

const oauthOpts = {
  clientId: 12345,
  clientSecret: 'secret123',
  accountId: 'ACCT_ABC',
};

const mockTokenThenSend = () => {
  fetchMock
    .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }))
    .mockResolvedValueOnce(new Response('', { status: 202 }));
};

describe('selligentTransport — OAuth token management', () => {
  it('fetches an OAuth token before the first send', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(baseMessage, baseCtx);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!;
    expect(String(tokenUrl)).toBe('https://auth.slgnt.eu/oauth/token');
    expect(tokenInit.method).toBe('POST');
    const tokenBody = JSON.parse(tokenInit.body);
    expect(tokenBody.client_id).toBe(12345);
    expect(tokenBody.client_secret).toBe('secret123');
    expect(tokenBody.account_id).toBe('ACCT_ABC');
    expect(tokenBody.grant_type).toBe('client_credentials');
    expect(tokenBody.audience).toBe('https://sdc.slgnt.eu');
  });

  it('caches the token for subsequent sends', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 202 }))
      .mockResolvedValueOnce(new Response('', { status: 202 }));

    const t = selligentTransport(oauthOpts);
    await t.send(baseMessage, baseCtx);
    await t.send(baseMessage, baseCtx);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const calls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calls[0]).toContain('oauth/token');
    expect(calls[1]).toContain('/email/v1/messages/send');
    expect(calls[2]).toContain('/email/v1/messages/send');
  });

  it('refreshes the token when it is about to expire', async () => {
    const { selligentTransport } = await import('./index.js');
    const shortToken = { ...tokenResponse, expires_in: 30 };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(shortToken), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 202 }));

    const t = selligentTransport(oauthOpts);
    await t.send(baseMessage, baseCtx);
    await t.send(baseMessage, baseCtx);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const calls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calls[0]).toContain('oauth/token');
    expect(calls[2]).toContain('oauth/token');
  });

  it('returns CONFIG error when token request fails with 4xx', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock.mockResolvedValueOnce(new Response('Invalid credentials', { status: 401 }));

    const t = selligentTransport(oauthOpts);
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.provider).toBe('selligent');
    expect(err.httpStatus).toBe(401);
    expect(err.retriable).toBe(false);
  });

  it('returns retriable CONFIG error when token request fails with 5xx', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock.mockResolvedValueOnce(new Response('Server error', { status: 500 }));

    const t = selligentTransport(oauthOpts);
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.provider).toBe('selligent');
    expect(err.retriable).toBe(true);
  });

  it('returns CONFIG error when token fetch throws a network error', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

    const t = selligentTransport(oauthOpts);
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.provider).toBe('selligent');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('fetch failed');
  });

  it('uses custom authUrl and audience', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport({
      ...oauthOpts,
      authUrl: 'https://auth.custom.com/oauth/token',
      audience: 'https://sdc.custom.com',
    });
    await t.send(baseMessage, baseCtx);

    const [tokenUrl] = fetchMock.mock.calls[0]!;
    expect(String(tokenUrl)).toBe('https://auth.custom.com/oauth/token');
    const tokenBody = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(tokenBody.audience).toBe('https://sdc.custom.com');
  });

  it('uses getAccessToken when provided instead of OAuth flow', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock.mockResolvedValueOnce(new Response('', { status: 202 }));

    const getAccessToken = vi.fn().mockResolvedValue('custom_token');
    const t = selligentTransport({ getAccessToken });
    await t.send(baseMessage, baseCtx);

    expect(getAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init.headers as Record<string, string>);
    expect(headers.get('Authorization')).toBe('Bearer custom_token');
  });
});

describe('selligentTransport — send', () => {
  it('sends a POST to the SDC email send endpoint', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(baseMessage, baseCtx);

    const [sendUrl, sendInit] = fetchMock.mock.calls[1]!;
    expect(String(sendUrl)).toBe('https://sdc.slgnt.eu/email/v1/messages/send');
    expect(sendInit.method).toBe('POST');
    const headers = new Headers(sendInit.headers as Record<string, string>);
    expect(headers.get('Authorization')).toBe('Bearer jwt_token_123');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('maps RenderedMessage to SDC message items array', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(baseMessage, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].reference).toBe('m1-0');
    expect(body[0].content.html).toBe('<p>hi</p>');
    expect(body[0].content.text).toBe('hi');
    expect(body[0].headers.subject).toBe('Hello');
    expect(body[0].headers.to).toEqual({ alias: '', address: 'user@example.com' });
    expect(body[0].headers.from).toEqual({ alias: 'App', address: 'noreply@example.com' });
    expect(body[0].context.profile).toBe('user@example.com');
  });

  it('maps string from address', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send({ ...baseMessage, from: 'plain@example.com' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body[0].headers.from).toEqual({ alias: '', address: 'plain@example.com' });
  });

  it('maps replyTo to the reply header', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(
      { ...baseMessage, replyTo: { name: 'Support', email: 'support@example.com' } },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body[0].headers.reply).toEqual({ alias: 'Support', address: 'support@example.com' });
  });

  it('creates one message item per recipient', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(
      {
        ...baseMessage,
        to: [{ email: 'a@x.com' }, { name: 'Bee', email: 'b@x.com' }, 'c@x.com'],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body).toHaveLength(3);
    expect(body[0].headers.to).toEqual({ alias: '', address: 'a@x.com' });
    expect(body[0].reference).toBe('m1-0');
    expect(body[0].context.profile).toBe('a@x.com');
    expect(body[1].headers.to).toEqual({ alias: 'Bee', address: 'b@x.com' });
    expect(body[1].reference).toBe('m1-1');
    expect(body[2].headers.to).toEqual({ alias: '', address: 'c@x.com' });
    expect(body[2].reference).toBe('m1-2');
  });

  it('returns accepted addresses on success', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    const result = await t.send(baseMessage, baseCtx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.accepted).toEqual(['user@example.com']);
    expect(result.data.rejected).toEqual([]);
  });

  it('uses custom baseUrl', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport({ ...oauthOpts, baseUrl: 'https://sdc.custom.com' });
    await t.send(baseMessage, baseCtx);

    const [sendUrl] = fetchMock.mock.calls[1]!;
    expect(String(sendUrl)).toBe('https://sdc.custom.com/email/v1/messages/send');
  });

  it('strips trailing slashes from baseUrl', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport({ ...oauthOpts, baseUrl: 'https://sdc.custom.com///' });
    await t.send(baseMessage, baseCtx);

    const [sendUrl] = fetchMock.mock.calls[1]!;
    expect(String(sendUrl)).toBe('https://sdc.custom.com/email/v1/messages/send');
  });

  it('has name "selligent"', async () => {
    const { selligentTransport } = await import('./index.js');
    const t = selligentTransport(oauthOpts);
    expect(t.name).toBe('selligent');
  });

  it('omits text when not present', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send({ from: 'a@x.com', to: ['b@x.com'], subject: 's', html: '<p>h</p>' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body[0].content.text).toBeUndefined();
  });

  it('omits reply when replyTo is not present', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(baseMessage, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body[0].headers.reply).toBeUndefined();
  });

  it('omits attachments when not present', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(baseMessage, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body[0].content.attachments).toBeUndefined();
  });

  it('drops unsupported fields (cc, bcc, headers, tags, priority, inlineAssets)', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    const result = await t.send(
      {
        ...baseMessage,
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        headers: { 'X-Campaign': 'launch' },
        tags: { campaign: 'launch' },
        priority: 'high',
        inlineAssets: { logo: { path: '/logo.png' } },
      },
      baseCtx,
    );

    expect(result.ok).toBe(true);
  });
});

describe('selligentTransport — attachments', () => {
  it('base64-encodes Buffer attachment content', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(
      {
        ...baseMessage,
        attachments: [
          {
            filename: 'invoice.pdf',
            content: Buffer.from('pdf-bytes'),
            contentType: 'application/pdf',
          },
        ],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body[0].content.attachments).toEqual([
      {
        file_name: 'invoice.pdf',
        data: Buffer.from('pdf-bytes').toString('base64'),
        mime_type: 'application/pdf',
      },
    ]);
  });

  it('base64-encodes string attachment content', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(
      {
        ...baseMessage,
        attachments: [
          {
            filename: 'note.txt',
            content: 'hello world',
            contentType: 'text/plain',
          },
        ],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body[0].content.attachments[0].data).toBe(Buffer.from('hello world').toString('base64'));
  });

  it('defaults mime_type to application/octet-stream when contentType is missing', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(
      {
        ...baseMessage,
        attachments: [{ filename: 'data.bin', content: Buffer.from('bytes') }],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body[0].content.attachments[0].mime_type).toBe('application/octet-stream');
  });
});

describe('selligentTransport — per-send overrides via TransportDataMap', () => {
  it('applies profile, tags, metadata, and reference from per-send data', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(baseMessage, {
      ...baseCtx,
      transport: {
        selligent: {
          profile: 'crm-123',
          tags: ['campaign-spring'],
          metadata: '{"ref":123}',
          reference: 'custom-ref',
        },
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body[0].context.profile).toBe('crm-123');
    expect(body[0].context.tags).toEqual(['campaign-spring']);
    expect(body[0].context.metadata).toBe('{"ref":123}');
    expect(body[0].reference).toBe('custom-ref');
  });

  it('applies list_unsubscribe, custom_send_time, and time_to_live from per-send data', async () => {
    const { selligentTransport } = await import('./index.js');
    mockTokenThenSend();
    const t = selligentTransport(oauthOpts);
    await t.send(baseMessage, {
      ...baseCtx,
      transport: {
        selligent: {
          list_unsubscribe: '<https://example.com/unsub>',
          custom_send_time: '2025-09-02T12:00:00',
          time_to_live: 'P2D',
        },
      },
    });

    const body = JSON.parse(fetchMock.mock.calls[1]![1].body);
    expect(body[0].headers.list_unsubscribe).toBe('<https://example.com/unsub>');
    expect(body[0].custom_send_time).toBe('2025-09-02T12:00:00');
    expect(body[0].time_to_live).toBe('P2D');
  });
});

describe('selligentTransport — from validation', () => {
  it('throws CONFIG error when from is missing', async () => {
    const { selligentTransport } = await import('./index.js');
    const t = selligentTransport(oauthOpts);
    const msg = { ...baseMessage } as Record<string, unknown>;
    delete msg.from;
    await expect(t.send(msg as never, baseCtx)).rejects.toThrow(/no "from"/);
  });
});

describe('selligentTransport — SDC API errors', () => {
  it('returns VALIDATION for 422 status', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error_message: 'Invalid property description' }), {
          status: 422,
        }),
      );
    const t = selligentTransport(oauthOpts);
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('VALIDATION');
    expect(err.provider).toBe('selligent');
    expect(err.httpStatus).toBe(422);
    expect(err.retriable).toBe(false);
    expect(err.message).toContain('Invalid property description');
  });

  it('returns CONFIG for 401 status', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error_message: 'Unauthorized' }), { status: 401 }),
      );
    const t = selligentTransport(oauthOpts);
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('CONFIG');
    expect(err.httpStatus).toBe(401);
    expect(err.retriable).toBe(false);
  });

  it('returns RATE_LIMITED for 429 status', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error_message: 'Too many requests' }), { status: 429 }),
      );
    const t = selligentTransport(oauthOpts);
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.httpStatus).toBe(429);
    expect(err.retriable).toBe(true);
  });

  it('returns PROVIDER (retriable) for 500 server error', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500 }));
    const t = selligentTransport(oauthOpts);
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.httpStatus).toBe(500);
    expect(err.retriable).toBe(true);
  });

  it('falls back to "request failed" when error_message is absent', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 422 }));
    const t = selligentTransport(oauthOpts);
    const result = await t.send(baseMessage, baseCtx);

    if (result.ok) throw new Error('expected not ok');
    expect(result.error.message).toContain('request failed');
  });
});

describe('selligentTransport — network errors', () => {
  it('returns PROVIDER when send fetch throws (network failure)', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }))
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    const t = selligentTransport(oauthOpts);
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('PROVIDER');
    expect(err.provider).toBe('selligent');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('network error');
  });

  it('returns TIMEOUT when send fetch throws AbortError', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }))
      .mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
    const t = selligentTransport(oauthOpts);
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    const err = result.error as NotifyRpcProviderError;
    expect(err.code).toBe('TIMEOUT');
    expect(err.provider).toBe('selligent');
    expect(err.retriable).toBe(true);
    expect(err.message).toContain('request timed out');
  });
});

describe('selligentTransport — verify', () => {
  it('returns ok:true when token fetch succeeds', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(tokenResponse), { status: 200 }));
    const t = selligentTransport(oauthOpts);
    const result = await t.verify!();

    expect(result.ok).toBe(true);
    expect(result.details).toEqual({ tokenLength: tokenResponse.access_token.length });
  });

  it('returns ok:false when token fetch fails', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock.mockResolvedValueOnce(new Response('Invalid credentials', { status: 401 }));
    const t = selligentTransport(oauthOpts);
    const result = await t.verify!();

    expect(result.ok).toBe(false);
    expect(result.details).toContain('OAuth token request failed');
  });

  it('returns ok:false when token fetch throws network error', async () => {
    const { selligentTransport } = await import('./index.js');
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    const t = selligentTransport(oauthOpts);
    const result = await t.verify!();

    expect(result.ok).toBe(false);
    expect(result.details).toContain('fetch failed');
  });

  it('delegates to getAccessToken when provided', async () => {
    const { selligentTransport } = await import('./index.js');
    const getAccessToken = vi.fn().mockResolvedValue('custom_token');
    const t = selligentTransport({ getAccessToken });
    const result = await t.verify!();

    expect(result.ok).toBe(true);
    expect(getAccessToken).toHaveBeenCalledTimes(1);
  });
});
