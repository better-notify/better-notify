import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

/**
 * Configuration options for the Twilio SMS transport.
 */
export type TwilioSmsTransportOptions = HttpClientBehaviorOptions & {
  accountSid: string;
  authToken: string;
  fromNumber?: string;
  messagingServiceSid?: string;
  baseUrl?: string;
  logger?: LoggerLike;
};
