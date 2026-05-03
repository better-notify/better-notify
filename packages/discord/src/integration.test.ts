import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createNotify, createClient } from '@betternotify/core';
import { discordChannel, mockDiscordTransport } from './index.js';

describe('discord channel end-to-end', () => {
  it('sends a message through createNotify + createClient + mockDiscordTransport', async () => {
    const rpc = createNotify({ channels: { discord: discordChannel() } });

    const catalog = rpc.catalog({
      deploy: rpc
        .discord()
        .input(z.object({ service: z.string(), version: z.string() }))
        .body(({ input }) => `Deployed ${input.service} v${input.version}`),
    });

    const transport = mockDiscordTransport();
    const notify = createClient({
      catalog,
      channels: { discord: discordChannel() },
      transportsByChannel: { discord: transport },
    });

    const result = await notify.deploy.send({
      input: { service: 'api', version: '2.0' },
    });
    expect(typeof result.messageId).toBe('string');
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]).toMatchObject({ body: 'Deployed api v2.0' });
  });

  it('.batch sends multiple discord entries', async () => {
    const rpc = createNotify({ channels: { discord: discordChannel() } });
    const catalog = rpc.catalog({
      alert: rpc
        .discord()
        .input(z.object({ msg: z.string() }))
        .body(({ input }) => input.msg),
    });

    const transport = mockDiscordTransport();
    const notify = createClient({
      catalog,
      channels: { discord: discordChannel() },
      transportsByChannel: { discord: transport },
    });

    const result = await notify.alert.batch([
      { input: { msg: 'A' } },
      { input: { msg: 'B' } },
    ]);
    expect(result.okCount).toBe(2);
    expect(transport.messages.map((m) => m.body)).toEqual(['A', 'B']);
  });

  it('renders embeds through the full pipeline', async () => {
    const rpc = createNotify({ channels: { discord: discordChannel() } });
    const catalog = rpc.catalog({
      deploy: rpc
        .discord()
        .input(z.object({ service: z.string() }))
        .body(({ input }) => `Deployed ${input.service}`)
        .embeds(({ input }) => [
          { title: 'Deployment', description: input.service, color: 0x00ff00 },
        ]),
    });

    const transport = mockDiscordTransport();
    const notify = createClient({
      catalog,
      channels: { discord: discordChannel() },
      transportsByChannel: { discord: transport },
    });

    await notify.deploy.send({ input: { service: 'api' } });
    expect(transport.messages[0]).toMatchObject({
      body: 'Deployed api',
      embeds: [{ title: 'Deployment', description: 'api', color: 0x00ff00 }],
    });
  });

  it('.queue throws CHANNEL_NOT_QUEUEABLE for discord routes', async () => {
    const rpc = createNotify({ channels: { discord: discordChannel() } });
    const catalog = rpc.catalog({
      alert: rpc
        .discord()
        .input(z.object({ msg: z.string() }))
        .body(({ input }) => input.msg),
    });

    const transport = mockDiscordTransport();
    const notify = createClient({
      catalog,
      channels: { discord: discordChannel() },
      transportsByChannel: { discord: transport },
    });

    let err: { code?: string } | undefined;
    try {
      await notify.alert.queue({ input: { msg: 'A' } });
    } catch (e) {
      err = e as { code?: string };
    }
    expect(err?.code).toBe('CHANNEL_NOT_QUEUEABLE');
  });
});
