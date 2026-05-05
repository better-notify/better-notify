import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type MailchimpTransportOptions = {
  apiKey: string;
  baseUrl?: string;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};

export type MandrillRecipient = {
  email: string;
  name?: string;
  type: 'to' | 'cc' | 'bcc';
};

export type MandrillAttachment = {
  type: string;
  name: string;
  content: string;
};

export type MandrillMessage = {
  from_email: string;
  from_name?: string;
  to: MandrillRecipient[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: MandrillAttachment[];
  images?: MandrillAttachment[];
  tags?: string[];
  metadata?: Record<string, string>;
};

export type MandrillRequest = {
  key: string;
  message: MandrillMessage;
};

export type MandrillRecipientStatus = {
  email: string;
  status: 'sent' | 'queued' | 'rejected' | 'invalid' | 'bounced';
  reject_reason?: string;
  _id: string;
};

export type MandrillSuccessResponse = MandrillRecipientStatus[];

export type MandrillErrorResponse = {
  status: 'error';
  code: number;
  name: string;
  message: string;
};
