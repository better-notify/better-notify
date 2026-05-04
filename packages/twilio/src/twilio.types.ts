import type { LoggerLike } from '@betternotify/core';

export type TwilioSmsTransportOptions = {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  messagingServiceSid?: string;
  baseUrl?: string;
  timeoutMs?: number;
  logger?: LoggerLike;
};
