import { describe, expect, it, vi, afterEach, beforeEach, type Mock } from 'vitest';
import { NotifyRpcError } from '@betternotify/core';
import type { RenderedZapier } from '../types.js';
import type { SendContext } from '@betternotify/core';

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/123/abc';

const baseRendered: RenderedZapier = {
  event: 'order.created',
  data: { orderId: '123', amount: 99 },
};

const ctx: SendContext = { route: 'orders.created', messageId: 'msg-1', attempt: 1 };

describe('zapierChannelTransport', () => {
  it('POSTs envelope with event, route, messageId, timestamp, data', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'success' }), { status: 200 }),
    );
    const t = zapierChannelTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(baseRendered, ctx);

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.event).toBe('order.created');
    expect(body.route).toBe('orders.created');
    expect(body.messageId).toBe('msg-1');
    expect(body.timestamp).toBeDefined();
    expect(body.data).toEqual({ orderId: '123', amount: 99 });
  });

  it('includes meta in payload when provided', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierChannelTransport({ webhookUrl: WEBHOOK_URL });
    await t.send({ ...baseRendered, meta: { priority: 'high' } }, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.meta).toEqual({ priority: 'high' });
  });

  it('omits meta when not provided', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierChannelTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(baseRendered, ctx);

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.meta).toBeUndefined();
  });

  it('uses rendered.webhookUrl override when present', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const override = 'https://hooks.zapier.com/hooks/catch/999/xyz';
    const t = zapierChannelTransport({ webhookUrl: WEBHOOK_URL });
    await t.send({ ...baseRendered, webhookUrl: override }, ctx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(override);
  });

  it('falls back to opts.webhookUrl when no override', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierChannelTransport({ webhookUrl: WEBHOOK_URL });
    await t.send(baseRendered, ctx);

    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(WEBHOOK_URL);
  });

  it('returns ok with status and raw data on success', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'z1' }), { status: 200 }));
    const t = zapierChannelTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseRendered, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.status).toBe(200);
    expect(result.data.raw).toEqual({ id: 'z1' });
  });

  it('returns VALIDATION error when event is empty', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    const t = zapierChannelTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send({ ...baseRendered, event: '' }, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
  });

  it('throws CONFIG at construction for invalid URL', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    expect(() => zapierChannelTransport({ webhookUrl: 'http://insecure.com' })).toThrow(
      NotifyRpcError,
    );
  });

  it('returns CONFIG error when webhookUrl override is empty string', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    const t = zapierChannelTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send({ ...baseRendered, webhookUrl: '' }, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('CONFIG');
    expect(result.error.message).toContain('no webhook URL');
  });

  it('returns PROVIDER error on network failure', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const t = zapierChannelTransport({ webhookUrl: WEBHOOK_URL });
    const result = await t.send(baseRendered, ctx);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected not ok');
    expect((result.error as NotifyRpcError).code).toBe('PROVIDER');
  });

  it('throws CONFIG when per-route webhookUrl override is HTTP', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const t = zapierChannelTransport({ webhookUrl: WEBHOOK_URL });

    await expect(
      t.send({ ...baseRendered, webhookUrl: 'http://insecure.com/hook' }, ctx),
    ).rejects.toThrow(NotifyRpcError);
  });

  it('has name "zapier-channel"', async () => {
    const { zapierChannelTransport } = await import('./channel-transport.js');
    const t = zapierChannelTransport({ webhookUrl: WEBHOOK_URL });
    expect(t.name).toBe('zapier-channel');
  });
});
