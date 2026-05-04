import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type ZapierChannelTransportOptions = HttpClientBehaviorOptions & {
  webhookUrl: string;
  logger?: LoggerLike;
};
