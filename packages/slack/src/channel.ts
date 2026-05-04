import { defineChannel, slot } from '@betternotify/core';
import { z } from 'zod';
import type { RenderedSlack, SlackBlock, SlackFile } from './types.js';

export type TextResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);

export type BlocksResolver<TInput> =
  | SlackBlock[]
  | ((args: { input: TInput; ctx: unknown }) => SlackBlock[]);

export type FileResolver<TInput> =
  | SlackFile
  | ((args: { input: TInput; ctx: unknown }) => SlackFile);

const slackArgsSchema = z.object({
  to: z.string().min(1).optional(),
  threadTs: z.string().optional(),
  input: z.unknown(),
});

const validateSlackArgs = (args: unknown) => slackArgsSchema.parse(args);

/**
 * Slack notification channel.
 *
 * Slots:
 * - `.text()` — Required fallback string. Shown in push notifications,
 *   desktop alerts, and screen readers. Always sent even when blocks are present.
 * - `.blocks()` — Optional rich layout (sections, headers, images, actions).
 *   This is what renders in the Slack client UI. Falls back to `text` if blocks
 *   cannot render.
 * - `.file()` — Optional file attachment uploaded alongside the message.
 */
export const slackChannel = () =>
  defineChannel({
    name: 'slack' as const,
    slots: {
      /** Required fallback text for notifications, alerts, and accessibility. */
      text: slot.resolver<string>(),
      /** Rich Block Kit layout rendered in the Slack client; falls back to `text`. */
      blocks: slot.resolver<SlackBlock[]>().optional(),
      /** File attachment uploaded with the message. */
      file: slot.resolver<SlackFile>().optional(),
    },
    validateArgs: validateSlackArgs,
    render: ({ runtime, args }): RenderedSlack => {
      const result: RenderedSlack = { text: runtime.text, to: args.to };
      if (args.threadTs !== undefined) result.threadTs = args.threadTs;
      if (runtime.blocks !== undefined) result.blocks = runtime.blocks;
      if (runtime.file !== undefined) result.file = runtime.file;
      return result;
    },
  });
