import type { Channel, ChannelBuilderCtx, ChannelDefinition } from '@emailrpc/core';
import { createPushBuilder, type PushBuilder, type TitleResolver, type BodyResolver, type DataResolver, type BadgeResolver } from './builder.js';
import type { RenderedPush, PushSendArgs, PushDeviceToken } from './types.js';
import type { Transport } from './transports/types.js';

type PushRuntime = {
  title: TitleResolver<unknown>;
  body: BodyResolver<unknown>;
  data?: DataResolver<unknown>;
  badge?: BadgeResolver<unknown>;
};

export const pushChannel = () => {
  const channel: Channel<
    'push',
    PushBuilder<unknown>,
    PushSendArgs<unknown>,
    RenderedPush,
    Transport
  > = {
    name: 'push',
    createBuilder: (ctx: ChannelBuilderCtx) => {
      const b = createPushBuilder<unknown>({});
      if (ctx.rootMiddleware.length > 0) {
        const seeded = b as unknown as { _state: { middleware: ReadonlyArray<unknown> } };
        seeded._state = { ...seeded._state, middleware: [...ctx.rootMiddleware] };
      }
      return b;
    },
    finalize: (state, id) =>
      (
        state as { _finalize: (id: string) => ChannelDefinition<PushSendArgs<unknown>, RenderedPush> }
      )._finalize(id),
    validateArgs: (args) => {
      if (!args || typeof args !== 'object') throw new Error('push args must be an object');
      const a = args as Record<string, unknown>;
      if (typeof a.to === 'string') {
        if (a.to.length === 0) throw new Error('push args.to must be a non-empty string or non-empty array');
        return { to: a.to, input: a.input } as PushSendArgs<unknown>;
      }
      if (Array.isArray(a.to)) {
        if (a.to.length === 0) throw new Error('push args.to must be a non-empty string or non-empty array');
        return { to: a.to as ReadonlyArray<PushDeviceToken>, input: a.input } as PushSendArgs<unknown>;
      }
      throw new Error('push args.to must be a non-empty string or non-empty array');
    },
    render: async (def, args) => {
      const runtime = (
        def as ChannelDefinition<PushSendArgs<unknown>, RenderedPush> & { runtime: PushRuntime }
      ).runtime;
      const title = typeof runtime.title === 'function' ? runtime.title({ input: args.input }) : runtime.title;
      const body = typeof runtime.body === 'function' ? runtime.body({ input: args.input }) : runtime.body;
      const result: RenderedPush = { title, body, to: args.to };
      if (runtime.data !== undefined) {
        result.data = typeof runtime.data === 'function' ? runtime.data({ input: args.input }) : runtime.data;
      }
      if (runtime.badge !== undefined) {
        result.badge = typeof runtime.badge === 'function' ? runtime.badge({ input: args.input }) : runtime.badge;
      }
      return result;
    },
    _transport: undefined as never,
  };
  return channel;
};
