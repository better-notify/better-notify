import { defineChannel, slot } from '@betternotify/core';
import { z } from 'zod';
import type { RenderedZapier } from './types.js';

export type EventResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);

export type DataResolver<TInput> =
  | Record<string, unknown>
  | ((args: { input: TInput; ctx: unknown }) => Record<string, unknown>);

export type MetaResolver<TInput> =
  | Record<string, string>
  | ((args: { input: TInput; ctx: unknown }) => Record<string, string>);

const zapierArgsSchema = z.object({
  input: z.unknown(),
});

const validateZapierArgs = (args: unknown) => zapierArgsSchema.parse(args);

export const zapierChannel = () =>
  defineChannel({
    name: 'zapier' as const,
    slots: {
      event: slot.resolver<string>(),
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
