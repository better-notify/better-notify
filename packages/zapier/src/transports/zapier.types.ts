import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type ZapierTransportOptions = {
  webhookUrl: string;
  timeoutMs?: number;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};
