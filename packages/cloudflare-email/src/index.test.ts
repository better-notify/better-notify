import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import type { RenderedMessage } from '@betternotify/email';
import type { SendContext } from '@betternotify/core';
import { NotifyRpcError } from '@betternotify/core';

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

const baseMessage: RenderedMessage = {
  from: { name: 'App', email: 'noreply@example.com' },
  to: [{ email: 'user@example.com' }],
  subject: 'Hello',
  html: '<p>hi</p>',
  text: 'hi',
};

const baseCtx: SendContext = { route: 'welcome', messageId: 'm1', attempt: 1 };

const okResponse = {
  success: true,
  errors: [],
  messages: [],
  result: {
    delivered: ['user@example.com'],
    permanent_bounces: [],
    queued: [],
  },
};

const mockFetchOk = () =>
  fetchMock.mockResolvedValue(new Response(JSON.stringify(okResponse), { status: 200 }));

describe('cloudflareEmailTransport', () => {
  it('sends a POST to the Cloudflare API with correct URL and auth header', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    mockFetchOk();
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    await t.send(baseMessage, baseCtx);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://api.cloudflare.com/client/v4/accounts/acc123/email/sending/send');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers as Record<string, string>).get('Authorization')).toBe('Bearer tok456');
    expect(new Headers(init.headers as Record<string, string>).get('Content-Type')).toBe('application/json');
  });

  it('maps RenderedMessage fields to the CF request body', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    mockFetchOk();
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    await t.send(
      {
        ...baseMessage,
        cc: [{ name: 'CC User', email: 'cc@example.com' }],
        bcc: ['bcc@example.com'],
        replyTo: { name: 'Reply', email: 'reply@example.com' },
        headers: { 'X-Campaign': 'launch' },
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toEqual({ address: 'noreply@example.com', name: 'App' });
    expect(body.to).toEqual(['user@example.com']);
    expect(body.cc).toEqual(['cc@example.com']);
    expect(body.bcc).toEqual(['bcc@example.com']);
    expect(body.reply_to).toBe('reply@example.com');
    expect(body.subject).toBe('Hello');
    expect(body.html).toBe('<p>hi</p>');
    expect(body.text).toBe('hi');
    expect(body.headers).toEqual({ 'X-Campaign': 'launch' });
  });

  it('returns EmailTransportData with accepted/rejected from CF response', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          errors: [],
          messages: [],
          result: {
            delivered: ['a@x.com'],
            permanent_bounces: ['b@x.com'],
            queued: ['c@x.com'],
          },
        }),
        { status: 200 },
      ),
    );
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.accepted).toEqual(['a@x.com', 'c@x.com']);
    expect(result.data.rejected).toEqual(['b@x.com']);
    expect(result.data.transportMessageId).toBeUndefined();
    expect(result.data.raw).toMatchObject({ success: true });
  });

  it('uses custom baseUrl when provided', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    mockFetchOk();
    const t = cloudflareEmailTransport({
      accountId: 'acc123',
      apiToken: 'tok456',
      baseUrl: 'https://mock.local',
    });
    await t.send(baseMessage, baseCtx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://mock.local/client/v4/accounts/acc123/email/sending/send');
  });

  it('omits optional fields from request body when not in RenderedMessage', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    mockFetchOk();
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    await t.send({ from: 'a@x.com', to: ['b@x.com'], subject: 's', html: '<p>h</p>' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.cc).toBeUndefined();
    expect(body.bcc).toBeUndefined();
    expect(body.reply_to).toBeUndefined();
    expect(body.text).toBeUndefined();
    expect(body.attachments).toBeUndefined();
    expect(body.headers).toBeUndefined();
  });

  it('has name "cloudflare-email"', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    expect(t.name).toBe('cloudflare-email');
  });

  it('drops unsupported fields (tags, priority, inlineAssets) without error', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    mockFetchOk();
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(
      {
        ...baseMessage,
        tags: { campaign: 'launch' },
        priority: 'high',
        inlineAssets: { logo: { path: '/logo.png' } },
      },
      baseCtx,
    );

    expect(result.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.tags).toBeUndefined();
    expect(body.priority).toBeUndefined();
    expect(body.inlineAssets).toBeUndefined();
  });

  it('maps string from address to { email } object', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    mockFetchOk();
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    await t.send({ ...baseMessage, from: 'plain@example.com' }, baseCtx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.from).toEqual({ address: 'plain@example.com' });
  });
});

describe('cloudflareEmailTransport — from validation', () => {
  it('throws CONFIG error when from is missing', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const msg = { ...baseMessage } as Record<string, unknown>;
    delete msg.from;
    await expect(t.send(msg as never, baseCtx)).rejects.toThrow(/no "from"/);
  });
});

describe('cloudflareEmailTransport — CF API errors', () => {
  it('returns VALIDATION for CF error code 10001', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 10001, message: 'email.sending.error.invalid_request_schema' }],
          messages: [],
          result: null,
        }),
        { status: 400 },
      ),
    );
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect(result.error).toBeInstanceOf(NotifyRpcError);
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('returns VALIDATION for CF error code 10200', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 10200, message: 'email.sending.error.email.invalid' }],
          messages: [],
          result: null,
        }),
        { status: 400 },
      ),
    );
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('returns VALIDATION for CF error code 10201 (no content length)', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 10201, message: 'email.sending.error.email.no_content_length' }],
          messages: [],
          result: null,
        }),
        { status: 400 },
      ),
    );
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('returns VALIDATION for CF error code 10202 (too big)', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 10202, message: 'email.sending.error.email.too_big' }],
          messages: [],
          result: null,
        }),
        { status: 400 },
      ),
    );
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('returns CONFIG for CF error code 10203 (sending disabled)', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 10203, message: 'email.sending.error.email.sending_disabled' }],
          messages: [],
          result: null,
        }),
        { status: 403 },
      ),
    );
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('CONFIG');
  });

  it('returns PROVIDER for CF error code 10004 (rate limited)', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 10004, message: 'email.sending.error.throttled' }],
          messages: [],
          result: null,
        }),
        { status: 429 },
      ),
    );
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });

  it('returns PROVIDER for CF error code 10002 (internal server error)', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 10002, message: 'email.sending.error.internal_server' }],
          messages: [],
          result: null,
        }),
        { status: 500 },
      ),
    );
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });

  it('returns PROVIDER for unknown CF error codes', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          errors: [{ code: 99999, message: 'something unexpected' }],
          messages: [],
          result: null,
        }),
        { status: 500 },
      ),
    );
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });
});

describe('cloudflareEmailTransport — network errors', () => {
  it('returns PROVIDER when fetch throws (network failure)', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
    expect(result.error.message).toContain('network error');
  });

  it('returns PROVIDER when response body is not valid JSON', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });

  it('returns PROVIDER when response is valid JSON but missing errors/result fields', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false }), { status: 400 }));
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    const result = await t.send(baseMessage, baseCtx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
    expect(result.error.message).toContain('unknown error');
  });
});

describe('cloudflareEmailTransport — attachments', () => {
  it('base64-encodes Buffer attachment content', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    mockFetchOk();
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
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

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.attachments).toEqual([
      {
        content: Buffer.from('pdf-bytes').toString('base64'),
        filename: 'invoice.pdf',
        type: 'application/pdf',
        disposition: 'attachment',
      },
    ]);
  });

  it('base64-encodes string attachment content', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    mockFetchOk();
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
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

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.attachments[0].content).toBe(Buffer.from('hello world').toString('base64'));
  });

  it('sets disposition to "inline" and maps cid to contentId when cid is present', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    mockFetchOk();
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    await t.send(
      {
        ...baseMessage,
        attachments: [
          {
            filename: 'logo.png',
            content: Buffer.from('png-bytes'),
            contentType: 'image/png',
            cid: 'logo@inline',
          },
        ],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.attachments[0].disposition).toBe('inline');
    expect(body.attachments[0].contentId).toBe('logo@inline');
  });

  it('defaults contentType to application/octet-stream when not provided', async () => {
    const { cloudflareEmailTransport } = await import('./index.js');
    mockFetchOk();
    const t = cloudflareEmailTransport({ accountId: 'acc123', apiToken: 'tok456' });
    await t.send(
      {
        ...baseMessage,
        attachments: [{ filename: 'data.bin', content: Buffer.from('bytes') }],
      },
      baseCtx,
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.attachments[0].type).toBe('application/octet-stream');
  });
});
