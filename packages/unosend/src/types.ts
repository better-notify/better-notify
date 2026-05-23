import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type UnosendTransportOptions = {
  apiKey: string;
  baseUrl?: string;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};

export type UnosendPerSendData = {
  priority?: 'high' | 'normal' | 'low';
  scheduled_for?: string;
  tracking?: {
    open?: boolean;
    click?: boolean;
  };
};

export type UnosendAttachment = {
  filename: string;
  content: string;
  content_type?: string;
};

export type UnosendTag = {
  name: string;
  value: string;
};

export type UnosendRequest = {
  from: string;
  to: string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
  headers?: Record<string, string>;
  attachments?: UnosendAttachment[];
  tags?: UnosendTag[];
  priority?: 'high' | 'normal' | 'low';
  scheduled_for?: string;
  tracking?: { open?: boolean; click?: boolean };
};

export type UnosendSuccessResponse = {
  success: true;
  data: {
    id: string;
    from: string;
    to: string[];
    status: string;
    created_at: string;
  };
};

export type UnosendErrorResponse = {
  success: false;
  error: {
    message: string;
    code?: string;
  };
};
