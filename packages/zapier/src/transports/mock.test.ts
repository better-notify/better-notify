import { describe, expect, it } from 'vitest';
import type { RenderedZapier } from '../types.js';
import type { SendContext } from '@betternotify/core';
import { mockZapierTransport } from './mock.js';

const baseRendered: RenderedZapier = {
  event: 'order.created',
  data: { orderId: '123' },
};

const ctx: SendContext = { route: 'orders.created', messageId: 'msg-1', attempt: 1 };

describe('mockZapierTransport', () => {
  it('has name "mock-zapier"', () => {
    const t = mockZapierTransport();
    expect(t.name).toBe('mock-zapier');
  });

  it('returns ok with status 200 on send', async () => {
    const t = mockZapierTransport();
    const result = await t.send(baseRendered, ctx);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.status).toBe(200);
    expect(result.data.raw).toEqual({});
  });

  it('records sent payloads', async () => {
    const t = mockZapierTransport();
    await t.send(baseRendered, ctx);
    await t.send({ event: 'user.signup', data: { userId: '456' } }, ctx);

    expect(t.sent).toHaveLength(2);
    expect(t.sent[0]!.rendered).toEqual(baseRendered);
  });

  it('tracks payloads with auto-incrementing IDs', async () => {
    const t = mockZapierTransport();
    await t.send(baseRendered, ctx);
    await t.send({ event: 'second', data: {} }, ctx);

    expect(t.payloads).toHaveLength(2);
    expect(t.payloads[0]!.id).toBe('zapier-mock-1');
    expect(t.payloads[0]!.event).toBe('order.created');
    expect(t.payloads[1]!.id).toBe('zapier-mock-2');
    expect(t.payloads[1]!.event).toBe('second');
  });

  it('reset clears sent records, payloads, and resets counter', async () => {
    const t = mockZapierTransport();
    await t.send(baseRendered, ctx);
    await t.send({ event: 'second', data: {} }, ctx);
    expect(t.sent).toHaveLength(2);
    expect(t.payloads).toHaveLength(2);

    t.reset();
    expect(t.sent).toHaveLength(0);
    expect(t.payloads).toHaveLength(0);

    await t.send(baseRendered, ctx);
    expect(t.payloads[0]!.id).toBe('zapier-mock-1');
  });
});
