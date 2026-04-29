import { defineChannel, slot } from '@betternotify/core';
import type { Priority, Tags } from '@betternotify/core';
import type { Address, Attachment, FromInput, RenderedMessage } from './types.js';
import type { RenderedOutput, TemplateAdapter } from './template.js';
import { resolveFrom } from './lib/resolve-from.js';

export type EmailSendArgs<TInput = unknown> = {
  to: Address | ReadonlyArray<Address>;
  cc?: Address | ReadonlyArray<Address>;
  bcc?: Address | ReadonlyArray<Address>;
  replyTo?: Address;
  from?: FromInput;
  headers?: Record<string, string>;
  attachments?: Attachment[];
  input: TInput;
};

export type SubjectResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);
export type FromResolver<TInput> =
  | FromInput
  | ((args: { input: TInput; ctx: unknown }) => FromInput);

export type TemplateInput<TInput = any, TCtx = any> =
  | TemplateAdapter<TInput, TCtx>
  | ((args: { input: TInput; ctx: TCtx }) => RenderedOutput | Promise<RenderedOutput>);

export type EmailChannelOptions = {
  defaults?: {
    from?: FromInput;
    replyTo?: Address;
    headers?: Record<string, string>;
  };
};

const toAddressArray = (value: Address | ReadonlyArray<Address>): Address[] =>
  Array.isArray(value) ? [...value] : [value as Address];

const toAdapter = (template: TemplateInput): TemplateAdapter<unknown, unknown> =>
  typeof template === 'function'
    ? { render: async (args) => template(args) }
    : (template as TemplateAdapter<unknown, unknown>);

const validateEmailArgs = (args: unknown): EmailSendArgs => {
  if (!args || typeof args !== 'object') throw new Error('email args must be an object');
  const a = args as Record<string, unknown>;
  if (!a.to) throw new Error('email args.to is required');
  return a as EmailSendArgs;
};

export const emailChannel = (options: EmailChannelOptions = {}) =>
  defineChannel({
    name: 'email' as const,
    slots: {
      subject: slot.resolver<string>(),
      template: slot.value<TemplateInput>(),
      from: slot.resolver<FromInput>().optional(),
      replyTo: slot.value<Address>().optional(),
      tags: slot.value<Tags>().optional(),
      priority: slot.value<Priority>().optional(),
    },
    validateArgs: validateEmailArgs,
    render: async ({ runtime, args, ctx }): Promise<RenderedMessage> => {
      const adapter = toAdapter(runtime.template);
      const rendered = await adapter.render({ input: args.input, ctx });
      const from = resolveFrom(args.from ?? runtime.from, options.defaults?.from);
      const replyTo = args.replyTo ?? runtime.replyTo ?? options.defaults?.replyTo;
      const mergedHeaders = {
        ...options.defaults?.headers,
        ...args.headers,
      };

      const message: RenderedMessage = {
        to: toAddressArray(args.to),
        subject: rendered.subject ?? runtime.subject,
        html: rendered.html,
        text: rendered.text,
        tags: runtime.tags,
        priority: runtime.priority,
      };

      if (from) message.from = from;
      if (args.cc) message.cc = toAddressArray(args.cc);
      if (args.bcc) message.bcc = toAddressArray(args.bcc);
      if (replyTo) message.replyTo = replyTo;
      if (Object.keys(mergedHeaders).length > 0) message.headers = mergedHeaders;
      if (args.attachments && args.attachments.length > 0) message.attachments = args.attachments;

      return message;
    },
    previewRender: async ({ runtime, input, ctx }) => {
      const adapter = toAdapter(runtime.template);
      return adapter.render({ input, ctx });
    },
  });
