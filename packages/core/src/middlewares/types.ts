export type SendArgsLike = { input: unknown; [k: string]: unknown };

/**
 * Parameters passed to every middleware function.
 *
 * @typeParam TInput   - Validated input type for the route (matches the `.input()` schema).
 * @typeParam TCtxIn   - Shape of the context object entering this middleware.
 * @typeParam TCtxOut  - Shape of the context object after this middleware runs (defaults to `TCtxIn`).
 * @typeParam TResult  - Return type of the send pipeline (defaults to `unknown`).
 */
export type MiddlewareParams<TInput, TCtxIn, TCtxOut = TCtxIn, TResult = unknown> = {
  /** Validated, schema-coerced input for this route. */
  input: TInput;
  /** Context object flowing through the middleware chain. */
  ctx: TCtxIn;
  /** Dot-path route identifier (e.g. `"transactional.welcome"`). */
  route: string;
  /** UUID assigned to this individual send attempt. */
  messageId: string;
  /** Full send arguments including `input` plus any channel-specific fields. */
  args: SendArgsLike;
  /**
   * Advance to the next middleware (or the core send pipeline if this is the
   * last middleware).
   *
   * Pass `newCtx` to shallow-merge additional fields into the context before
   * handing off. Omit it to forward the current context unchanged.
   *
   * Do not call `next` to short-circuit the pipeline (e.g. dry run, cache
   * hit). Throw to signal a failure instead of returning a partial result.
   */
  next: (newCtx?: Partial<TCtxOut>) => Promise<TResult>;
};

/**
 * A middleware function in the BetterNotify send pipeline.
 *
 * Middleware wraps the downstream pipeline — it runs before and/or after the
 * render+send core. The composition order is **first-registered wraps
 * outermost**: plugin middleware added via `plugins` wraps outer; route-level
 * middleware added via `.use()` wraps inner.
 *
 * ```ts
 * const logTiming = (): Middleware => async ({ route, next }) => {
 *   const t = performance.now();
 *   const result = await next();
 *   console.log(route, performance.now() - t, 'ms');
 *   return result;
 * };
 * ```
 *
 * Rules:
 * - Call `next()` exactly once to continue; call it zero times to short-circuit.
 * - Throw a `NotifyRpcError` (or any `Error`) to fail the send.
 * - Pass context mutations via `next({ ...additions })` — never mutate `ctx` in place.
 * - If removing this middleware would change whether an email goes out, it must
 *   be middleware (not a hook).
 *
 * @typeParam TInput   - Validated input type; narrows `params.input`.
 * @typeParam TCtxIn   - Context shape on entry.
 * @typeParam TCtxOut  - Context shape passed to `next` (defaults to `TCtxIn`).
 * @typeParam TResult  - Result type returned by `next` and by the middleware itself.
 */
export type Middleware<TInput = unknown, TCtxIn = unknown, TCtxOut = TCtxIn, TResult = unknown> = (
  params: MiddlewareParams<TInput, TCtxIn, TCtxOut, TResult>,
) => Promise<TResult>;

/**
 * Escape hatch for storing heterogeneously-typed middleware in a single
 * collection. Prefer the typed {@link Middleware} overload wherever possible.
 */
export type AnyMiddleware = Middleware<any, any, any, any>;
