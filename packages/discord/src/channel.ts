import { defineChannel, slot } from '@betternotify/core';
import { z } from 'zod';
import type { DiscordEmbed, RenderedDiscord } from './types.js';

export type BodyResolver<TInput> = string | ((args: { input: TInput; ctx: unknown }) => string);
export type EmbedsResolver<TInput> =
  | DiscordEmbed[]
  | ((args: { input: TInput; ctx: unknown }) => DiscordEmbed[]);

const discordArgsSchema = z.object({
  input: z.unknown(),
});

const validateDiscordArgs = (args: unknown) => discordArgsSchema.parse(args);

export const discordChannel = () =>
  defineChannel({
    name: 'discord' as const,
    slots: {
      body: slot.resolver<string>(),
      embeds: slot.resolver<DiscordEmbed[]>().optional(),
      username: slot.resolver<string>().optional(),
      avatarUrl: slot.resolver<string>().optional(),
    },
    validateArgs: validateDiscordArgs,
    render: ({ runtime, args: _args }): RenderedDiscord => {
      const result: RenderedDiscord = { body: runtime.body };
      if (runtime.embeds !== undefined) result.embeds = runtime.embeds;
      if (runtime.username !== undefined) result.username = runtime.username;
      if (runtime.avatarUrl !== undefined) result.avatarUrl = runtime.avatarUrl;
      return result;
    },
  });
