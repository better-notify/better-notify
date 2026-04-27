import type { Channel, ChannelBuilderCtx, ChannelDefinition } from '@emailrpc/core';
import { createSmsBuilder, type SmsBuilder, type BodyResolver } from './builder.js';
import type { RenderedSms, SmsSendArgs } from './types.js';
import type { Transport } from './transports/types.js';

type SmsRuntime = {
  body: BodyResolver<unknown>;
};

export const smsChannel = () => {
  const channel: Channel<
    'sms',
    SmsBuilder<unknown>,
    SmsSendArgs<unknown>,
    RenderedSms,
    Transport
  > = {
    name: 'sms',
    createBuilder: (ctx: ChannelBuilderCtx) => {
      const b = createSmsBuilder<unknown>({});
      if (ctx.rootMiddleware.length > 0) {
        const seeded = b as unknown as { _state: { middleware: ReadonlyArray<unknown> } };
        seeded._state = { ...seeded._state, middleware: [...ctx.rootMiddleware] };
      }
      return b;
    },
    finalize: (state, id) =>
      (
        state as { _finalize: (id: string) => ChannelDefinition<SmsSendArgs<unknown>, RenderedSms> }
      )._finalize(id),
    validateArgs: (args) => {
      if (!args || typeof args !== 'object') throw new Error('sms args must be an object');
      const a = args as Record<string, unknown>;
      if (typeof a.to !== 'string' || a.to.length === 0) {
        throw new Error('sms args.to must be a non-empty string');
      }
      return { to: a.to, input: a.input } as SmsSendArgs<unknown>;
    },
    render: async (def, args) => {
      const runtime = (
        def as ChannelDefinition<SmsSendArgs<unknown>, RenderedSms> & { runtime: SmsRuntime }
      ).runtime;
      const text = typeof runtime.body === 'function' ? runtime.body({ input: args.input }) : runtime.body;
      return { body: text, to: args.to };
    },
    _transport: undefined as never,
  };
  return channel;
};
