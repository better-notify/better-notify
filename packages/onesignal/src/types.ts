import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type OneSignalTransportOptions = {
  appId: string;
  apiKey: string;
  baseUrl?: string;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};

export type OneSignalSmsTransportOptions = OneSignalTransportOptions & {
  from?: string;
};

export type OneSignalSuccessResponse = {
  id: string;
  external_id?: string;
  errors?: {
    invalid_player_ids?: string[];
    invalid_aliases?: Record<string, string[]>;
    invalid_email_tokens?: string[];
    invalid_phone_numbers?: string[];
    [key: string]: unknown;
  };
};

export type OneSignalErrorResponse = {
  errors: string[];
};
