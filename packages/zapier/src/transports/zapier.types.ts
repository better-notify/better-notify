import type { LoggerLike } from '@betternotify/core';

export type ZapierTransportOptions = {
  webhookUrl: string;
  timeoutMs?: number;
  logger?: LoggerLike;
};
