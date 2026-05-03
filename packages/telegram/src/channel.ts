import { defineChannel, slot } from '@betternotify/core';
import { z } from 'zod';
import type { RenderedTelegram, TelegramAttachment, TelegramParseMode } from './types.js';

export type BodyResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);
export type AttachmentResolver<TInput> =
  | TelegramAttachment
  | ((args: { input: TInput; ctx: unknown }) => TelegramAttachment);

const telegramArgsSchema = z.object({
  to: z.union([z.string().min(1), z.number().refine((n) => n !== 0)]),
  input: z.unknown(),
});

const validateTelegramArgs = (args: unknown) => telegramArgsSchema.parse(args);

export const telegramChannel = () =>
  defineChannel({
    name: 'telegram' as const,
    slots: {
      body: slot.resolver<string>(),
      parseMode: slot.value<TelegramParseMode>().optional(),
      attachment: slot.resolver<TelegramAttachment>().optional(),
    },
    validateArgs: validateTelegramArgs,
    render: ({ runtime, args }): RenderedTelegram => {
      const result: RenderedTelegram = { body: runtime.body, to: args.to };
      if (runtime.parseMode !== undefined) result.parseMode = runtime.parseMode;
      if (runtime.attachment !== undefined) result.attachment = runtime.attachment;
      return result;
    },
  });
