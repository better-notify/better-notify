import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type SelligentOAuthCredentials = {
  clientId: number;
  clientSecret: string;
  accountId: string;
};

export type SelligentTransportOptions = {
  baseUrl?: string;
  authUrl?: string;
  audience?: string;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
} & (SelligentOAuthCredentials | { getAccessToken: () => Promise<string> });

export type SelligentAddress = {
  alias: string;
  address: string;
};

export type SelligentAttachment = {
  file_name: string;
  data: string;
  mime_type: string;
};

export type SelligentMessageContext = {
  profile: string;
  tags?: string[];
  metadata?: string;
};

export type SelligentMessageItem = {
  reference: string;
  content: {
    html: string;
    text?: string;
    attachments?: SelligentAttachment[];
  };
  headers: {
    subject: string;
    to: SelligentAddress;
    from: SelligentAddress;
    reply?: SelligentAddress;
    list_unsubscribe?: string;
  };
  context: SelligentMessageContext;
  custom_send_time?: string;
  time_to_live?: string;
};

export type SelligentTokenResponse = {
  access_token: string;
  token_type: string;
  refresh_token: string;
  scope: string;
  expires_in: number;
};

export type SelligentErrorResponse = {
  error_message?: string;
};

export type SelligentPerSendData = {
  profile?: string;
  tags?: string[];
  metadata?: string;
  reference?: string;
  list_unsubscribe?: string;
  custom_send_time?: string;
  time_to_live?: string;
};
