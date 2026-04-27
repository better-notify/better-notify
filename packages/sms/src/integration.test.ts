import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createNotify, createClient } from '@emailrpc/core';
import { smsChannel, mockSmsTransport } from './index.js';

describe('sms channel end-to-end', () => {
  it('sends an SMS through createNotify + createClient + mockSmsTransport', async () => {
    const rpc = createNotify({ channels: { sms: smsChannel() } });

    const catalog = rpc.catalog({
      greet: rpc
        .sms()
        .input(z.object({ name: z.string() }))
        .body(({ input }) => `Hi ${input.name}`),
    });

    const transport = mockSmsTransport();
    const notify = createClient({
      catalog,
      channels: { sms: smsChannel() },
      transportsByChannel: { sms: transport },
    });

    const result = await notify.greet.send({
      to: '+15555555555',
      input: { name: 'Lucas' },
    });
    expect(typeof result.messageId).toBe('string');
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]).toMatchObject({ body: 'Hi Lucas', to: '+15555555555' });
  });

  it('.batch sends multiple sms entries', async () => {
    const rpc = createNotify({ channels: { sms: smsChannel() } });
    const catalog = rpc.catalog({
      greet: rpc
        .sms()
        .input(z.object({ name: z.string() }))
        .body(({ input }) => `Hi ${input.name}`),
    });

    const transport = mockSmsTransport();
    const notify = createClient({
      catalog,
      channels: { sms: smsChannel() },
      transportsByChannel: { sms: transport },
    });

    const result = await notify.greet.batch([
      { to: '+1', input: { name: 'A' } },
      { to: '+2', input: { name: 'B' } },
    ]);
    expect(result.okCount).toBe(2);
    expect(transport.messages.map((m) => m.body)).toEqual(['Hi A', 'Hi B']);
  });

  it('.queue throws CHANNEL_NOT_QUEUEABLE for sms routes', async () => {
    const rpc = createNotify({ channels: { sms: smsChannel() } });
    const catalog = rpc.catalog({
      greet: rpc
        .sms()
        .input(z.object({ name: z.string() }))
        .body(({ input }) => `Hi ${input.name}`),
    });

    const transport = mockSmsTransport();
    const notify = createClient({
      catalog,
      channels: { sms: smsChannel() },
      transportsByChannel: { sms: transport },
    });

    let err: { code?: string } | undefined;
    try {
      await notify.greet.queue({ to: '+1', input: { name: 'A' } });
    } catch (e) {
      err = e as { code?: string };
    }
    expect(err?.code).toBe('CHANNEL_NOT_QUEUEABLE');
  });
});
