import { defineChannel, slot } from '@betternotify/core';
import { z } from 'zod';
import type { RenderedZapier } from './types.js';

/** Static event name or resolver. Constrained to `TEvent` when the channel is generic. */
export type EventResolver<TInput, TEvent extends string = string> =
  | TEvent
  | ((args: { input: TInput; ctx: unknown }) => TEvent);

/** Static object or resolver returning the webhook data payload. */
export type DataResolver<TInput> =
  | Record<string, unknown>
  | ((args: { input: TInput; ctx: unknown }) => Record<string, unknown>);

/** Static object or resolver returning envelope metadata for filtering. */
export type MetaResolver<TInput> =
  | Record<string, string>
  | ((args: { input: TInput; ctx: unknown }) => Record<string, string>);

const zapierArgsSchema = z.object({
  input: z.unknown(),
});

const validateZapierArgs = (args: unknown) => zapierArgsSchema.parse(args);

/**
 * Zapier notification channel with event, data, meta, and webhookUrl slots.
 *
 * Pass a string union generic to constrain allowed event names:
 * ```ts
 * const zapier = zapierChannel<'order.created' | 'payment.failed'>();
 * ```
 */
export const zapierChannel = <TEvent extends string = string>() =>
  defineChannel({
    name: 'zapier' as const,
    slots: {
      event: slot.resolver<TEvent>(),
      data: slot.resolver<Record<string, unknown>>(),
      meta: slot.resolver<Record<string, string>>().optional(),
      webhookUrl: slot.resolver<string>().optional(),
    },
    validateArgs: validateZapierArgs,
    render: ({ runtime, args: _args }): RenderedZapier => {
      const result: RenderedZapier = { event: runtime.event, data: runtime.data };
      if (runtime.meta !== undefined) result.meta = runtime.meta;
      if (runtime.webhookUrl !== undefined) result.webhookUrl = runtime.webhookUrl;
      return result;
    },
  });
