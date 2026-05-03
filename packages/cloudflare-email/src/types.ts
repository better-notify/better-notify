import type { LoggerLike } from '@betternotify/core';

export type CloudflareEmailTransportOptions = {
  accountId: string;
  apiToken: string;
  baseUrl?: string;
  logger?: LoggerLike;
};

export type CloudflareEmailFrom = {
  email: string;
  name?: string;
};

export type CloudflareEmailAttachment = {
  content: string;
  filename: string;
  type: string;
  disposition: 'attachment' | 'inline';
  contentId?: string;
};

export type CloudflareEmailRequest = {
  from: CloudflareEmailFrom;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
  attachments?: CloudflareEmailAttachment[];
  headers?: Record<string, string>;
};

export type CloudflareEmailResult = {
  delivered: string[];
  permanent_bounces: string[];
  queued: string[];
};

export type CloudflareApiError = {
  code: number;
  message: string;
};

export type CloudflareApiResponse = {
  success: boolean;
  errors: CloudflareApiError[];
  messages: string[];
  result: CloudflareEmailResult | null;
};
