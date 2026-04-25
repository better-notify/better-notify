import { EmailRpcNotImplementedError } from './errors.js';
import type { SendResult } from './types.js';

export interface MiddlewareParams<TInput, TCtx> {
  input: TInput;
  ctx: TCtx;
  route: string;
  next: (newCtx?: Partial<TCtx>) => Promise<SendResult>;
}

export type Middleware<TInput = unknown, TCtx = unknown> = (
  params: MiddlewareParams<TInput, TCtx>,
) => Promise<SendResult>;

export function loggerMw(): Middleware {
  throw new EmailRpcNotImplementedError('loggerMw()');
}

export function eventLoggerMw(_opts: { storage: unknown }): Middleware {
  throw new EmailRpcNotImplementedError('eventLoggerMw()');
}

export function suppressionListMw(_opts: { list: unknown }): Middleware {
  throw new EmailRpcNotImplementedError('suppressionListMw()');
}

export function rateLimitMw(_opts: { key: string; max: number; window: string }): Middleware {
  throw new EmailRpcNotImplementedError('rateLimitMw()');
}

export function idempotencyMw(_opts: { store: unknown }): Middleware {
  throw new EmailRpcNotImplementedError('idempotencyMw()');
}

export function dryRunMw(): Middleware {
  throw new EmailRpcNotImplementedError('dryRunMw()');
}

export function tracingMw(): Middleware {
  throw new EmailRpcNotImplementedError('tracingMw()');
}

export function tagInjectMw(_opts: { tags: Record<string, string> }): Middleware {
  throw new EmailRpcNotImplementedError('tagInjectMw()');
}
