import type { RawSendArgs, SendResult } from '../types.js';

export type MiddlewareParams<TInput, TCtxIn, TCtxOut = TCtxIn> = {
  input: TInput;
  ctx: TCtxIn;
  route: string;
  messageId: string;
  args: RawSendArgs;
  next: (newCtx?: Partial<TCtxOut>) => Promise<SendResult>;
};

export type Middleware<TInput = unknown, TCtxIn = unknown, TCtxOut = TCtxIn> = (
  params: MiddlewareParams<TInput, TCtxIn, TCtxOut>,
) => Promise<SendResult>;

export type AnyMiddleware = Middleware<any, any, any>;
