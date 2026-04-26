import { EmailRpcRateLimitedError } from '../errors.js';
import type { Middleware } from './types.js';
import type { WithRateLimitOptions } from './with-rate-limit.types.js';

/**
 * Throttle sends per derived `key` against the supplied `RateLimitStore`.
 *
 * On every send the key is resolved (string or function of
 * `{ input, ctx, route, args }`) and recorded in the store; if the post-
 * record count exceeds `max`, an `EmailRpcRateLimitedError` is thrown
 * carrying `key` and `retryAfterMs` so a queue worker (or retry layer) can
 * back off precisely. Otherwise the chain continues.
 *
 * Two algorithms supported via `algorithm`:
 * - `'fixed'` (default) — counter per fixed window, cheapest, mildly bursty
 *   at boundaries.
 * - `'sliding'` — sliding window log, more accurate but slightly more
 *   expensive on the store side.
 *
 * Windows are specified in milliseconds (e.g. `60_000`, `5 * 60_000`).
 *
 * ```ts
 * t.use(withRateLimit({
 *   store: inMemoryRateLimitStore(),
 *   key: ({ args }) => Array.isArray(args.to) ? 'multi' : String(args.to),
 *   max: 3,
 *   window: 60_000,
 * }))
 * ```
 *
 * Pair with `inMemoryRateLimitStore()` for a single process or BYO a Redis
 * implementation of `RateLimitStore` for cross-worker coordination.
 */
export const withRateLimit = <TInput = unknown>(
  opts: WithRateLimitOptions<TInput>,
): Middleware<TInput> => {
  const algorithm = opts.algorithm ?? 'fixed';
  return async ({ input, ctx, route, args, next }) => {
    const key =
      typeof opts.key === 'function' ? opts.key({ input, ctx, route, args }) : opts.key;
    const { count, resetAtMs } = await opts.store.record(key, opts.window, algorithm);
    if (count > opts.max) {
      throw new EmailRpcRateLimitedError({
        message: `Rate limit exceeded for key "${key}" on route "${route}".`,
        route,
        key,
        retryAfterMs: Math.max(0, resetAtMs - Date.now()),
      });
    }
    return next();
  };
};
