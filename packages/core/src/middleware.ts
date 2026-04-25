import { EmailRpcNotImplementedError } from './errors.js';
import type { SendResult } from './types.js';

export type MiddlewareParams<TInput, TCtxIn, TCtxOut = TCtxIn> = {
  input: TInput;
  ctx: TCtxIn;
  route: string;
  next: (newCtx?: Partial<TCtxOut>) => Promise<SendResult>;
};

export type Middleware<TInput = unknown, TCtxIn = unknown, TCtxOut = TCtxIn> = (
  params: MiddlewareParams<TInput, TCtxIn, TCtxOut>,
) => Promise<SendResult>;

export type AnyMiddleware = Middleware<any, any, any>;

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
  return async () => ({
    messageId: 'dry-run',
    accepted: [],
    rejected: [],
    envelope: { from: '', to: [] },
    timing: { renderMs: 0, sendMs: 0 },
  });
};

export const tracingMw = (): Middleware => {
  throw new EmailRpcNotImplementedError('tracingMw()');
};

export type TagInjectMwOptions = {
  tags: Record<string, string>;
};

export const tagInjectMw = (opts: TagInjectMwOptions): Middleware => {
  return async ({ next }) => next({ tagsToInject: opts.tags } as never);
};
