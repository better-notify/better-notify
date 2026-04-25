import { EmailRpcNotImplementedError } from './errors.js';
import type { SendResult } from './types.js';

export type MiddlewareParams<TInput, TCtx> = {
  input: TInput;
  ctx: TCtx;
  route: string;
  next: (newCtx?: Partial<TCtx>) => Promise<SendResult>;
};

export type Middleware<TInput = unknown, TCtx = unknown> = (
  params: MiddlewareParams<TInput, TCtx>,
) => Promise<SendResult>;

export const loggerMw = (): Middleware => {
  throw new EmailRpcNotImplementedError('loggerMw()');
};

export const eventLoggerMw = (_opts: { storage: unknown }): Middleware => {
  throw new EmailRpcNotImplementedError('eventLoggerMw()');
};

export const suppressionListMw = (_opts: { list: unknown }): Middleware => {
  throw new EmailRpcNotImplementedError('suppressionListMw()');
};

export const rateLimitMw = (_opts: { key: string; max: number; window: string }): Middleware => {
  throw new EmailRpcNotImplementedError('rateLimitMw()');
};

export const idempotencyMw = (_opts: { store: unknown }): Middleware => {
  throw new EmailRpcNotImplementedError('idempotencyMw()');
};

export const dryRunMw = (): Middleware => {
  throw new EmailRpcNotImplementedError('dryRunMw()');
};

export const tracingMw = (): Middleware => {
  throw new EmailRpcNotImplementedError('tracingMw()');
};

export const tagInjectMw = (_opts: { tags: Record<string, string> }): Middleware => {
  throw new EmailRpcNotImplementedError('tagInjectMw()');
};
