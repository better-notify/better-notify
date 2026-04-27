import type { LoggerLike } from '../logger.js';
import type { Transport } from '../transport.js';

/**
 * Strategy controlling which inner transport is tried first on each `send()`.
 *
 * - `'failover'`: every send starts at `transports[0]` and walks forward through
 *   the list. Use when you have a clear primary + backup ordering (e.g. cheaper
 *   provider first, paid fallback second).
 * - `'round-robin'`: each `send()` advances an in-process counter, so successive
 *   sends start at different indices. Within a single send, on failure it still
 *   walks forward (modulo n) through the remaining transports. Use to spread
 *   load evenly across equivalent providers.
 * - `'random'`: each `send()` picks a uniformly-random start index. On failure
 *   it walks forward (modulo n) through the rest. Use when you want load
 *   spreading without per-process counter coordination — multiple processes
 *   distribute on average without sharing state.
 *
 * Weighted distribution is deferred to v0.3 — the union expands without a
 * breaking change when it lands.
 */
export type MultiTransportStrategy = 'failover' | 'round-robin' | 'random';

/**
 * One inner transport in the composite list. Currently a thin wrapper so
 * weighted entries can grow into it without breaking the call site.
 */
export type MultiTransportEntry<TRendered = unknown, TData = unknown> = {
  /** The transport to delegate to. Receives the fully-resolved message and context unchanged. */
  transport: Transport<TRendered, TData>;
};

/**
 * Per-transport retry backoff. Only consulted when `maxAttemptsPerTransport > 1`.
 * Delay between attempts on the same transport: `min(maxMs, initialMs * factor^(attempt-1))`.
 * No jitter applied. Backoff resets when advancing to the next transport.
 */
export type MultiTransportBackoff = {
  /** Delay before the second attempt, in milliseconds. Must be > 0. */
  initialMs: number;
  /** Exponential growth factor (e.g. `2` doubles each attempt). Must be >= 1. Use `1` for a fixed delay. */
  factor: number;
  /** Upper cap on the delay. Must be >= `initialMs`. Once reached, every subsequent attempt waits exactly `maxMs`. */
  maxMs: number;
};

/**
 * Options for {@link multiTransport}. Validated synchronously at construction;
 * invalid configs throw `EmailRpcError({ code: 'CONFIG' })`.
 */
export type MultiTransportOptions<TRendered = unknown, TData = unknown> = {
  /**
   * Identifier surfaced as the composite's `Transport.name` and on every
   * orchestration log line. Defaults to `'multi'`. Override when registering
   * more than one composite in the same client (e.g. `'failover-primary'`,
   * `'round-robin-bulk'`) so logs and `SendOptions.transport` selection stay
   * unambiguous.
   */
  name?: string;

  /**
   * Which inner transport to try first on each `send()`.
   *
   * - `'failover'`: every send starts at `transports[0]` and walks forward.
   *   Use when you have a clear primary + backup ordering (e.g. cheaper
   *   provider first, paid fallback second).
   * - `'round-robin'`: each `send()` advances an in-process counter, so
   *   successive sends start at different indices. Within a single send,
   *   on failure it still walks forward (modulo n) through the remaining
   *   transports. Use to spread load evenly across equivalent providers.
   * - `'random'`: each `send()` picks a uniformly-random start index, then
   *   walks forward (modulo n) on failure. Use when you want load spreading
   *   without per-process counter coordination.
   *
   * Weighted distribution is deferred to v0.3 — the union expands without
   * a breaking change when it lands.
   */
  strategy: MultiTransportStrategy;

  /**
   * Inner transports, in order. Must be non-empty. Order is significant for
   * `'failover'` (first = primary) and defines the rotation cycle for
   * `'round-robin'`. The same `Transport` instance can appear more than once
   * (e.g. wrapped under different names) — the composite never deduplicates.
   */
  transports: MultiTransportEntry<TRendered, TData>[];

  /**
   * Number of times to call a single inner transport before advancing to the
   * next on a retriable error. Defaults to `1` (immediate failover, no
   * per-transport retry). Must be an integer >= 1.
   *
   * A non-retriable error advances immediately regardless of this value —
   * retrying the same transport on a non-retriable error is pointless. The
   * `attempts` counter in the `multi exhausted` log payload counts every call,
   * across transports.
   */
  maxAttemptsPerTransport?: number;

  /**
   * Backoff policy for retries on the *same* transport. Only consulted when
   * `maxAttemptsPerTransport > 1`. Unset → retries fire back-to-back with no
   * delay; advancing between transports never sleeps regardless of this value.
   *
   * Delay between attempts: `min(maxMs, initialMs * factor^(attempt-1))`.
   * No jitter. Backoff resets when advancing to the next transport.
   *
   * - `initialMs`: delay before the second attempt (must be > 0)
   * - `factor`: exponential growth (e.g. `2` doubles each attempt; use `1` for fixed delay; must be >= 1)
   * - `maxMs`: upper cap; once reached, every subsequent attempt waits exactly `maxMs` (must be >= `initialMs`)
   */
  backoff?: MultiTransportBackoff;

  /**
   * Predicate called with each thrown error to decide whether to keep trying.
   * Returning `true` means "try again" (retry the same transport up to
   * `maxAttemptsPerTransport`, then advance). Returning `false` means "advance
   * immediately to the next transport" — note this still attempts other
   * transports; it does not abort the whole send. To truly abort on certain
   * errors, wrap multiTransport in middleware or a custom transport upstream.
   *
   * Defaults to `() => true` (treat every error as retriable). Provider
   * packages may export a tailored helper (e.g. `isResendRetriable`) that you
   * can compose here.
   */
  isRetriable?: (err: unknown) => boolean;

  /**
   * Logger for orchestration events. The composite child-binds
   * `{ component: 'multi-transport', name }` and emits:
   *
   * - `debug` `multi attempt ok` `{ transportName, attempt, strategy }`
   * - `warn` `multi attempt failed` `{ err, transportName, attempt, retriable }`
   * - `error` `multi exhausted` `{ attempts, lastErr }`
   * - `error` `multi close failed` `{ err, transportName }` (during `close()`)
   *
   * These are independent of `createClient`'s per-send logger, which still sees
   * the composite as a single transport with `name`. Defaults to
   * `consoleLogger()` (silent at warn-default unless reconfigured).
   */
  logger?: LoggerLike;
};
