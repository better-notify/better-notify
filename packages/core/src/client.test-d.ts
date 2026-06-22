import { describe, it } from 'vitest';
import { z } from 'zod';
import { createNotify } from './notify.js';
import { createClient } from './client.js';
import { defineChannel, slot } from './channel/define-channel.js';

const inboxChannel = defineChannel({
  name: 'inbox' as const,
  slots: { type: slot.value<string>() },
  validateArgs: (args: unknown): { input: unknown } => args as { input: unknown },
  render: ({ args }) => ({ body: 'inbox', input: args.input }),
});

const rpc = createNotify({ channels: { inbox: inboxChannel } });
const catalog = rpc.catalog({
  noInput: rpc.inbox().type('order.created'),
  withInput: rpc
    .inbox()
    .input(z.object({ orderId: z.string() }))
    .type('order.shipped'),
});

const mail = createClient({ catalog, transportsByChannel: {} });

describe('createClient send args with optional input', () => {
  it('a route without .input() is sendable with no arguments', () => {
    void mail.noInput.send();
    void mail.noInput.send({});
    void mail.noInput.send({ transport: {} });
  });

  it('a route without .input() rejects an input payload', () => {
    // @ts-expect-error — this route declared no input slot
    void mail.noInput.send({ input: { orderId: 'x' } });
  });

  it('a route with .input() still requires the typed input', () => {
    void mail.withInput.send({ input: { orderId: 'x' } });
    // @ts-expect-error — input is required for this route
    void mail.withInput.send();
    // @ts-expect-error — input must match the declared schema
    void mail.withInput.send({ input: { orderId: 123 } });
  });
});
