import { handlePromise } from '../lib/handle-promise.js';
import type { Middleware } from './types.js';
import type { WithIdempotencyOptions } from './with-idempotency.types.js';

/**
 * Replay a previously-cached `SendResult` for matching keys instead of
 * re-sending. Best-effort idempotency at the middleware level.
 *
 * On the first send for a given key the chain runs normally and the
 * resulting `SendResult` is stored under `key` with a `ttl` (ms). On a
 * subsequent send for the same key while the entry is still alive, the
 * cached result is returned immediately and the downstream pipeline never
 * runs. Failures are NOT cached — a thrown error leaves the slot empty so
 * the next attempt is treated as fresh.
 *
 * Limitations (v1):
 * - Best-effort: two concurrent first-time sends with the same key both
 *   miss `get` and both call the downstream chain. A future `setIfAbsent`
 *   addition can close this gap; deferred to keep v1 minimal.
 *
 * ```ts
 * t.use(withIdempotency<{ orderId: string }>({
 *   store: inMemoryIdempotencyStore(),
 *   key: ({ input }) => `order:${input.orderId}`,
 *   ttl: 24 * 60 * 60_000,
 * }))
 * ```
 *
 * The `key` is required and accepts either a string (single shared slot)
 * or a function of `{ input, ctx, route, args }`. There is no automatic
 * payload-hash key — silently de-duping payload-equal sends is rarely the
 * intended behavior.
 */
export const withIdempotency = <TInput = unknown>(
  opts: WithIdempotencyOptions<TInput>,
): Middleware<TInput> => {
  return async ({ input, ctx, route, args, next }) => {
    const key = typeof opts.key === 'function' ? opts.key({ input, ctx, route, args }) : opts.key;
    const cached = await opts.store.get(key);
    if (cached) return cached;
    const [err, result] = await handlePromise(next());
    if (err) throw err;
    await opts.store.set(key, result, opts.ttl);
    return result;
  };
};
