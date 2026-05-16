import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type WhatsappMetaTransportOptions = {
  accessToken: string;
  phoneNumberId: string;
  baseUrl?: string;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};
