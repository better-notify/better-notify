import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type DiscordTransportOptions = HttpClientBehaviorOptions & {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
  wait?: boolean;
  logger?: LoggerLike;
};
