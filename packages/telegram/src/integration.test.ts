import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createNotify, createClient } from '@betternotify/core';
import { telegramChannel, mockTelegramTransport } from './index.js';

describe('telegram channel end-to-end', () => {
  it('sends a message through createNotify + createClient + mockTelegramTransport', async () => {
    const rpc = createNotify({ channels: { telegram: telegramChannel() } });

    const catalog = rpc.catalog({
      greet: rpc
        .telegram()
        .input(z.object({ name: z.string() }))
        .body(({ input }) => `Hi ${input.name}`),
    });

    const transport = mockTelegramTransport();
    const notify = createClient({
      catalog,
      channels: { telegram: telegramChannel() },
      transportsByChannel: { telegram: transport },
    });

    const result = await notify.greet.send({
      to: 123456,
      input: { name: 'Lucas' },
    });
    expect(typeof result.messageId).toBe('string');
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]).toMatchObject({ body: 'Hi Lucas', to: 123456 });
  });

  it('.batch sends multiple telegram entries', async () => {
    const rpc = createNotify({ channels: { telegram: telegramChannel() } });
    const catalog = rpc.catalog({
      greet: rpc
        .telegram()
        .input(z.object({ name: z.string() }))
        .body(({ input }) => `Hi ${input.name}`),
    });

    const transport = mockTelegramTransport();
    const notify = createClient({
      catalog,
      channels: { telegram: telegramChannel() },
      transportsByChannel: { telegram: transport },
    });

    const result = await notify.greet.batch([
      { to: 111, input: { name: 'A' } },
      { to: 222, input: { name: 'B' } },
    ]);
    expect(result.okCount).toBe(2);
    expect(transport.messages.map((m) => m.body)).toEqual(['Hi A', 'Hi B']);
  });

  it('.queue throws CHANNEL_NOT_QUEUEABLE for telegram routes', async () => {
    const rpc = createNotify({ channels: { telegram: telegramChannel() } });
    const catalog = rpc.catalog({
      greet: rpc
        .telegram()
        .input(z.object({ name: z.string() }))
        .body(({ input }) => `Hi ${input.name}`),
    });

    const transport = mockTelegramTransport();
    const notify = createClient({
      catalog,
      channels: { telegram: telegramChannel() },
      transportsByChannel: { telegram: transport },
    });

    let err: { code?: string } | undefined;
    try {
      await notify.greet.queue({ to: 111, input: { name: 'A' } });
    } catch (e) {
      err = e as { code?: string };
    }
    expect(err?.code).toBe('CHANNEL_NOT_QUEUEABLE');
  });

  it('sends a message with parseMode and attachment', async () => {
    const rpc = createNotify({ channels: { telegram: telegramChannel() } });

    const catalog = rpc.catalog({
      alert: rpc
        .telegram()
        .input(z.object({ url: z.string(), caption: z.string() }))
        .body(({ input }) => input.caption)
        .parseMode('HTML')
        .attachment(({ input }) => ({ type: 'photo' as const, url: input.url })),
    });

    const transport = mockTelegramTransport();
    const notify = createClient({
      catalog,
      channels: { telegram: telegramChannel() },
      transportsByChannel: { telegram: transport },
    });

    await notify.alert.send({
      to: 123,
      input: { url: 'https://example.com/img.png', caption: '<b>Alert!</b>' },
    });
    expect(transport.messages[0]).toMatchObject({
      body: '<b>Alert!</b>',
      to: 123,
      parseMode: 'HTML',
      attachment: { type: 'photo', url: 'https://example.com/img.png' },
    });
  });
});
