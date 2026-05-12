import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions } from '@betternotify/core/transports';

export type GithubTransportOptions = {
  token: string;
  baseUrl?: string;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};
