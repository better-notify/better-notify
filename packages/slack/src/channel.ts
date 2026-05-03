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

export const slackChannel = () =>
  defineChannel({
    name: 'slack' as const,
    slots: {
      text: slot.resolver<string>(),
      blocks: slot.resolver<SlackBlock[]>().optional(),
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
