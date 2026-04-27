import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createNotify, createClient } from '@emailrpc/core';
import { pushChannel, mockPushTransport } from './index.js';

describe('push channel end-to-end', () => {
  it('sends a push notification through createNotify + createClient + mockPushTransport', async () => {
    const rpc = createNotify({ channels: { push: pushChannel() } });

    const catalog = rpc.catalog({
      greet: rpc
        .push()
        .input(z.object({ name: z.string() }))
        .title(({ input }) => `Hello ${input.name}`)
        .body(({ input }) => `Welcome ${input.name}`),
    });

    const transport = mockPushTransport();
    const notify = createClient({
      catalog,
      channels: { push: pushChannel() },
      transportsByChannel: { push: transport },
    });

    const result = await notify.greet.send({
      to: 'device-token-abc',
      input: { name: 'Lucas' },
    });
    expect(typeof result.messageId).toBe('string');
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]).toMatchObject({
      title: 'Hello Lucas',
      body: 'Welcome Lucas',
      to: 'device-token-abc',
    });
  });

  it('.batch sends multiple push entries across device tokens', async () => {
    const rpc = createNotify({ channels: { push: pushChannel() } });
    const catalog = rpc.catalog({
      greet: rpc
        .push()
        .input(z.object({ name: z.string() }))
        .title(({ input }) => `Hi ${input.name}`)
        .body(({ input }) => `Hello ${input.name}`),
    });

    const transport = mockPushTransport();
    const notify = createClient({
      catalog,
      channels: { push: pushChannel() },
      transportsByChannel: { push: transport },
    });

    const result = await notify.greet.batch([
      { to: 'token-1', input: { name: 'A' } },
      { to: 'token-2', input: { name: 'B' } },
    ]);
    expect(result.okCount).toBe(2);
    expect(transport.messages.map((m) => m.title)).toEqual(['Hi A', 'Hi B']);
  });

  it('.queue throws CHANNEL_NOT_QUEUEABLE for push routes', async () => {
    const rpc = createNotify({ channels: { push: pushChannel() } });
    const catalog = rpc.catalog({
      greet: rpc
        .push()
        .input(z.object({ name: z.string() }))
        .title(({ input }) => `Hi ${input.name}`)
        .body(({ input }) => `Hello ${input.name}`),
    });

    const transport = mockPushTransport();
    const notify = createClient({
      catalog,
      channels: { push: pushChannel() },
      transportsByChannel: { push: transport },
    });

    let err: { code?: string } | undefined;
    try {
      await notify.greet.queue({ to: 'token-1', input: { name: 'A' } });
    } catch (e) {
      err = e as { code?: string };
    }
    expect(err?.code).toBe('CHANNEL_NOT_QUEUEABLE');
  });
});
