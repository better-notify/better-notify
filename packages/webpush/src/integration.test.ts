import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createNotify, createClient } from '@betternotify/core';
import { webPushChannel } from './index.js';
import { mockWebPushTransport } from './transports/index.js';

const sub = (id = '1') => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  keys: { p256dh: `BNcRdreALRFXTkOOUH-${id}`, auth: `tBHItJI5svbpC7-${id}` },
});

describe('webpush channel end-to-end', () => {
  it('sends a web push notification through createNotify + createClient + mockWebPushTransport', async () => {
    const rpc = createNotify({ channels: { webpush: webPushChannel() } });

    const catalog = rpc.catalog({
      alert: rpc
        .webpush()
        .input(z.object({ message: z.string() }))
        .title(() => `Alert`)
        .body(({ input }) => input.message),
    });

    const transport = mockWebPushTransport();
    const notify = createClient({
      catalog,
      channels: { webpush: webPushChannel() },
      transportsByChannel: { webpush: transport },
    });

    const s = sub();
    const result = await notify.alert.send({
      to: s,
      input: { message: 'Server is down' },
    });
    expect(typeof result.messageId).toBe('string');
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]).toMatchObject({
      title: 'Alert',
      body: 'Server is down',
      to: s,
    });
  });

  it('.batch sends multiple web push entries', async () => {
    const rpc = createNotify({ channels: { webpush: webPushChannel() } });
    const catalog = rpc.catalog({
      alert: rpc
        .webpush()
        .input(z.object({ message: z.string() }))
        .title('Alert')
        .body(({ input }) => input.message),
    });

    const transport = mockWebPushTransport();
    const notify = createClient({
      catalog,
      channels: { webpush: webPushChannel() },
      transportsByChannel: { webpush: transport },
    });

    const result = await notify.alert.batch([
      { to: sub('a'), input: { message: 'Msg A' } },
      { to: sub('b'), input: { message: 'Msg B' } },
    ]);
    expect(result.okCount).toBe(2);
    expect(transport.messages.map((m) => m.body)).toEqual(['Msg A', 'Msg B']);
  });

  it('.queue throws CHANNEL_NOT_QUEUEABLE for webpush routes', async () => {
    const rpc = createNotify({ channels: { webpush: webPushChannel() } });
    const catalog = rpc.catalog({
      alert: rpc
        .webpush()
        .input(z.object({ message: z.string() }))
        .title('Alert')
        .body(({ input }) => input.message),
    });

    const transport = mockWebPushTransport();
    const notify = createClient({
      catalog,
      channels: { webpush: webPushChannel() },
      transportsByChannel: { webpush: transport },
    });

    let err: { code?: string } | undefined;
    try {
      await notify.alert.queue({ to: sub(), input: { message: 'A' } });
    } catch (e) {
      err = e as { code?: string };
    }
    expect(err?.code).toBe('CHANNEL_NOT_QUEUEABLE');
  });

  it('renders optional fields (icon, tag, data)', async () => {
    const rpc = createNotify({ channels: { webpush: webPushChannel() } });
    const catalog = rpc.catalog({
      promo: rpc
        .webpush()
        .input(z.object({ product: z.string() }))
        .title('Sale!')
        .body(({ input }) => `${input.product} is on sale`)
        .icon('/sale-icon.png')
        .tag('promo')
        .data(({ input }) => ({ product: input.product })),
    });

    const transport = mockWebPushTransport();
    const notify = createClient({
      catalog,
      channels: { webpush: webPushChannel() },
      transportsByChannel: { webpush: transport },
    });

    await notify.promo.send({ to: sub(), input: { product: 'Widget' } });
    expect(transport.messages[0]).toMatchObject({
      title: 'Sale!',
      body: 'Widget is on sale',
      icon: '/sale-icon.png',
      tag: 'promo',
      data: { product: 'Widget' },
    });
  });
});
