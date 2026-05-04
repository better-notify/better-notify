import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type DiscordTransportOptions = {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
  wait?: boolean;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};
