import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type TelegramTransportOptions = {
  token: string;
  apiUrl?: string;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};
