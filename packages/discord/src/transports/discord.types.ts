import type { LoggerLike } from '@betternotify/core';

export type DiscordTransportOptions = {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
  wait?: boolean;
  timeoutMs?: number;
  logger?: LoggerLike;
};
