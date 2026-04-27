export type SendArgsLike = { input: unknown; [k: string]: unknown };

export type MiddlewareParams<TInput, TCtxIn, TCtxOut = TCtxIn, TResult = unknown> = {
  input: TInput;
  ctx: TCtxIn;
  route: string;
  messageId: string;
  args: SendArgsLike;
  next: (newCtx?: Partial<TCtxOut>) => Promise<TResult>;
};

export type Middleware<TInput = unknown, TCtxIn = unknown, TCtxOut = TCtxIn, TResult = unknown> = (
  params: MiddlewareParams<TInput, TCtxIn, TCtxOut, TResult>,
) => Promise<TResult>;

export type AnyMiddleware = Middleware<any, any, any, any>;
