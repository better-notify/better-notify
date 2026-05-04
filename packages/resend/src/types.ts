import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type ResendTransportOptions = {
  apiKey: string;
  baseUrl?: string;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};

export type ResendAttachment = {
  filename: string;
  content: string;
  content_type?: string;
  content_id?: string;
};

export type ResendTag = {
  name: string;
  value: string;
};

export type ResendRequest = {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  reply_to?: string[];
  headers?: Record<string, string>;
  attachments?: ResendAttachment[];
  tags?: ResendTag[];
};

export type ResendSuccessResponse = {
  id: string;
};

export type ResendErrorResponse = {
  statusCode: number;
  message: string;
  name: string;
};
