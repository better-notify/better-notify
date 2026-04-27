import type {
  Channel,
  ChannelBuilderCtx,
  ChannelDefinition,
} from '@emailrpc/core';
import { createEmailBuilder, type EmailBuilder } from './builder.js';
import type { EmailSendArgs } from './builder.js';
import type { Transport } from './transports/types.js';
import type { RenderedMessage, Address, FromInput, Priority, Tags } from './types.js';
import type { TemplateAdapter } from './template.js';
import { resolveFrom } from './lib/resolve-from.js';

export type { EmailSendArgs };

export type EmailChannelOptions = {
  defaults?: {
    from?: FromInput;
    replyTo?: Address;
    headers?: Record<string, string>;
  };
};

type EmailRuntime = {
  subject: string | ((args: { input: unknown }) => string);
  template: TemplateAdapter<unknown, unknown>;
  from?: FromInput;
  replyTo?: Address;
  tags?: Tags;
  priority?: Priority;
};

const toAddressArray = (value: Address | ReadonlyArray<Address>): Address[] =>
  Array.isArray(value) ? [...value] : [value as Address];

export const emailChannel = (options: EmailChannelOptions = {}) => {
  const channel: Channel<
    'email',
    EmailBuilder<unknown>,
    EmailSendArgs<unknown>,
    RenderedMessage,
    Transport
  > = {
    name: 'email',
    createBuilder: (ctx: ChannelBuilderCtx) => {
      const builder = createEmailBuilder<unknown>({});
      if (ctx.rootMiddleware.length > 0) {
        const seeded = builder as unknown as { _state: { middleware: ReadonlyArray<unknown> } };
        seeded._state = { ...seeded._state, middleware: [...ctx.rootMiddleware] };
      }
      return builder;
    },
    finalize: (state, id) => {
      const builder = state as { _finalize: (id: string) => ChannelDefinition<EmailSendArgs<unknown>, RenderedMessage> };
      return builder._finalize(id);
    },
    validateArgs: (args) => {
      if (!args || typeof args !== 'object') {
        throw new Error('email args must be an object');
      }
      const a = args as Record<string, unknown>;
      if (!a.to) throw new Error('email args.to is required');
      return a as EmailSendArgs<unknown>;
    },
    render: async (def, args, ctx) => {
      const runtime = (def as ChannelDefinition<EmailSendArgs<unknown>, RenderedMessage> & { runtime: EmailRuntime }).runtime;
      const rendered = await runtime.template.render({ input: args.input, ctx });
      const subj = typeof runtime.subject === 'function'
        ? runtime.subject({ input: args.input })
        : runtime.subject;

      const from = resolveFrom(
        args.from ?? runtime.from,
        options.defaults?.from,
      );

      const replyTo = args.replyTo ?? runtime.replyTo ?? options.defaults?.replyTo;

      const mergedHeaders = {
        ...(options.defaults?.headers ?? {}),
        ...(args.headers ?? {}),
      };

      const message: RenderedMessage = {
        from,
        to: toAddressArray(args.to),
        subject: rendered.subject ?? subj,
        html: rendered.html,
        text: rendered.text,
        tags: runtime.tags,
        priority: runtime.priority,
      };

      if (args.cc) message.cc = toAddressArray(args.cc);
      if (args.bcc) message.bcc = toAddressArray(args.bcc);
      if (replyTo) message.replyTo = replyTo;
      if (Object.keys(mergedHeaders).length > 0) message.headers = mergedHeaders;
      if (args.attachments && args.attachments.length > 0) message.attachments = args.attachments;

      return message;
    },
    _transport: undefined as never,
  };
  return channel;
};
