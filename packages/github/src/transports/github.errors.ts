import { NotifyRpcProviderError } from '@betternotify/core';
import { mapHttpStatus } from '@betternotify/core/transports';
import type { HttpNetworkError, HttpStatusError } from '@betternotify/core/transports';
import type { GithubClientCtx } from './github.types.js';

export type GithubErrorResponse = {
  message: string;
  errors?: { resource?: string; code?: string; field?: string; message?: string }[];
  documentation_url?: string;
};

export const buildNetworkError = (
  method: string,
  result: HttpNetworkError,
  ctx: { route: string; messageId: string },
): NotifyRpcProviderError => {
  const detail = result.timedOut ? 'request timed out' : `network error: ${result.cause.message}`;

  return new NotifyRpcProviderError({
    message: `GitHub ${method}: ${detail}`,
    code: result.timedOut ? 'TIMEOUT' : 'PROVIDER',
    provider: 'github',
    retriable: true,
    cause: result.cause,
    route: ctx.route,
    messageId: ctx.messageId,
  });
};

export const buildHttpError = (
  log: GithubClientCtx['log'],
  method: string,
  result: HttpStatusError<GithubErrorResponse | null>,
  ctx: { route: string; messageId: string },
): NotifyRpcProviderError => {
  const { code, retriable } = mapHttpStatus(result.status);

  const detail = result.body?.message ?? `${result.status} ${result.statusText}`;

  log.error('GitHub API error', {
    err: new Error(detail),
    route: ctx.route,
    status: result.status,
  });

  return new NotifyRpcProviderError({
    message: `GitHub ${method}: ${detail}`,
    code,
    provider: 'github',
    httpStatus: result.status,
    retriable,
    route: ctx.route,
    messageId: ctx.messageId,
  });
};

export const buildError = (
  log: GithubClientCtx['log'],
  method: string,
  result: HttpNetworkError | HttpStatusError<GithubErrorResponse | null>,
  ctx: { route: string; messageId: string },
): NotifyRpcProviderError => {
  if (result.kind === 'network') return buildNetworkError(method, result, ctx);
  return buildHttpError(log, method, result, ctx);
};
