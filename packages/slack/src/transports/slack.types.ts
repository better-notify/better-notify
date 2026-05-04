import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type SlackTransportOptions = {
  token: string;
  defaultChannel?: string;
  baseUrl?: string;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};
