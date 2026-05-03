import type { LoggerLike } from '@betternotify/core';

export type SlackTransportOptions = {
  token: string;
  defaultChannel?: string;
  baseUrl?: string;
  timeoutMs?: number;
  logger?: LoggerLike;
};
