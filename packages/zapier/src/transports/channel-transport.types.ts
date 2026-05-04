import type { LoggerLike } from '@betternotify/core';

export type ZapierChannelTransportOptions = {
  webhookUrl: string;
  timeoutMs?: number;
  logger?: LoggerLike;
};
