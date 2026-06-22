import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createClient } from './client.js';
import { createNotify } from './notify.js';
import { defineChannel, slot } from './channel/define-channel.js';

type InboxRendered = { type: string; input: unknown };

const inboxChannel = () =>
  defineChannel({
    name: 'inbox' as const,
    slots: { type: slot.value<string>() },
    validateArgs: z.object({}),
    render: ({ runtime, args }): InboxRendered => ({ type: runtime.type, input: args.input }),
  });

const buildClient = () => {
  const rpc = createNotify({ channels: { inbox: inboxChannel() } });
  const catalog = rpc.catalog({
    created: rpc.inbox().type('order.created'),
  });
  const sent: Array<{ rendered: InboxRendered }> = [];
  const transport = {
    name: 'mem',
    send: async (rendered: InboxRendered, ctx: { messageId: string }) => {
      sent.push({ rendered });
      return { ok: true as const, data: { id: ctx.messageId } };
    },
  };
  const mail = createClient({ catalog, transportsByChannel: { inbox: transport } });
  return { mail, sent };
};

describe('createClient with a route that omits .input()', () => {
  it('sends with no arguments at all', async () => {
    const { mail, sent } = buildClient();
    await mail.created.send();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.rendered).toEqual({ type: 'order.created', input: undefined });
  });

  it('sends with an empty args object', async () => {
    const { mail, sent } = buildClient();
    await mail.created.send({});
    expect(sent).toHaveLength(1);
    expect(sent[0]?.rendered).toEqual({ type: 'order.created', input: undefined });
  });
});
