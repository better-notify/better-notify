import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createNotify, createClient } from '@betternotify/core';
import { slackChannel, mockSlackTransport } from './index.js';

describe('slack channel end-to-end', () => {
  it('sends a message through createNotify + createClient + mockSlackTransport', async () => {
    const rpc = createNotify({ channels: { slack: slackChannel() } });

    const catalog = rpc.catalog({
      greet: rpc
        .slack()
        .input(z.object({ name: z.string() }))
        .text(({ input }) => `Hi ${input.name}`),
    });

    const transport = mockSlackTransport();
    const notify = createClient({
      catalog,
      channels: { slack: slackChannel() },
      transportsByChannel: { slack: transport },
    });

    const result = await notify.greet.send({
      to: '#general',
      input: { name: 'Lucas' },
    });
    expect(typeof result.messageId).toBe('string');
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]).toMatchObject({ text: 'Hi Lucas', to: '#general' });
  });

  it('.batch sends multiple slack entries', async () => {
    const rpc = createNotify({ channels: { slack: slackChannel() } });
    const catalog = rpc.catalog({
      greet: rpc
        .slack()
        .input(z.object({ name: z.string() }))
        .text(({ input }) => `Hi ${input.name}`),
    });

    const transport = mockSlackTransport();
    const notify = createClient({
      catalog,
      channels: { slack: slackChannel() },
      transportsByChannel: { slack: transport },
    });

    const result = await notify.greet.batch([
      { to: '#a', input: { name: 'A' } },
      { to: '#b', input: { name: 'B' } },
    ]);
    expect(result.okCount).toBe(2);
    expect(transport.messages.map((m) => m.text)).toEqual(['Hi A', 'Hi B']);
  });

  it('sends a message with blocks', async () => {
    const rpc = createNotify({ channels: { slack: slackChannel() } });

    const catalog = rpc.catalog({
      alert: rpc
        .slack()
        .input(z.object({ title: z.string(), body: z.string() }))
        .text(({ input }) => input.title)
        .blocks(({ input }) => [
          { type: 'header', text: { type: 'plain_text', text: input.title } },
          { type: 'section', text: { type: 'mrkdwn', text: input.body } },
        ]),
    });

    const transport = mockSlackTransport();
    const notify = createClient({
      catalog,
      channels: { slack: slackChannel() },
      transportsByChannel: { slack: transport },
    });

    await notify.alert.send({
      to: '#alerts',
      input: { title: 'Deploy', body: 'v2.0 is live' },
    });
    expect(transport.messages[0]).toMatchObject({
      text: 'Deploy',
      to: '#alerts',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Deploy' } },
        { type: 'section', text: { type: 'mrkdwn', text: 'v2.0 is live' } },
      ],
    });
  });

  it('sends a threaded reply', async () => {
    const rpc = createNotify({ channels: { slack: slackChannel() } });

    const catalog = rpc.catalog({
      reply: rpc
        .slack()
        .input(z.object({ msg: z.string() }))
        .text(({ input }) => input.msg),
    });

    const transport = mockSlackTransport();
    const notify = createClient({
      catalog,
      channels: { slack: slackChannel() },
      transportsByChannel: { slack: transport },
    });

    await notify.reply.send({
      to: '#general',
      threadTs: '1111.2222',
      input: { msg: 'threaded' },
    });
    expect(transport.messages[0]).toMatchObject({
      text: 'threaded',
      to: '#general',
      threadTs: '1111.2222',
    });
  });
});
