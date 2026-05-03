import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import type { RenderedMessage } from '@betternotify/email';
import type { SendContext } from '@betternotify/email/transports';

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
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/acc123/email/sending/send',
    );
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe('Bearer tok456');
    expect(init.headers['Content-Type']).toBe('application/json');
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
    expect(body.from).toEqual({ email: 'noreply@example.com', name: 'App' });
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
    expect(url).toBe('https://mock.local/client/v4/accounts/acc123/email/sending/send');
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
    expect(body.from).toEqual({ email: 'plain@example.com' });
  });
});
