import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';
import type { LoggerLike } from '@betternotify/core';

export type VapidTransportOptions = {
  publicKey: string;
  privateKey: string;
  subject: string;
  ttl?: number;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};
