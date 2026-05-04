import type { LoggerLike } from '@betternotify/core';

/**
 * Configuration options for the Twilio SMS transport.
 */
export type TwilioSmsTransportOptions = {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  messagingServiceSid?: string;
  baseUrl?: string;
  timeoutMs?: number;
  logger?: LoggerLike;
};
