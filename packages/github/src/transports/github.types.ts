import type { LoggerLike } from '@betternotify/core';
import type { HttpClientBehaviorOptions, createHttpClient } from '@betternotify/core/transports';

export type GithubTransportOptions = {
  token: string;
  baseUrl?: string;
  logger?: LoggerLike;
  http?: HttpClientBehaviorOptions;
};

export type GithubClientCtx = {
  baseUrl: string;
  http: ReturnType<typeof createHttpClient>;
  headers: Record<string, string>;
  log: LoggerLike;
};
