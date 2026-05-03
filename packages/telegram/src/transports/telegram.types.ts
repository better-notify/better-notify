import type { LoggerLike } from '@betternotify/core';

export type TelegramTransportOptions = {
  token: string;
  apiUrl?: string;
  logger?: LoggerLike;
};
