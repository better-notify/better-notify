import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type AutosendTransportOptions = {
  apiKey: string;
  baseUrl?: string;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};

export type AutosendAddress = {
  email: string;
  name?: string;
};

export type AutosendRequest = {
  from: AutosendAddress;
  to: AutosendAddress;
  subject: string;
  html?: string;
  text?: string;
};

export type AutosendSuccessResponse = {
  success: true;
  data: {
    emailId: string;
    message: string;
    totalRecipients: number;
  };
};

export type AutosendErrorResponse = {
  success?: false;
  message?: string;
  error?: string;
};
