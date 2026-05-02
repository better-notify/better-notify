import type { Middleware } from './types.js';

export const createMiddleware = <
  TInput = unknown,
  TCtxIn = unknown,
  TCtxOut = TCtxIn,
  TResult = unknown,
>(
  fn: Middleware<TInput, TCtxIn, TCtxOut, TResult>,
): Middleware<TInput, TCtxIn, TCtxOut, TResult> => fn;
