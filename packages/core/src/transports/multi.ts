import { handlePromise } from '../lib/handle-promise.js';
import { waitFor } from '../lib/wait-for.js';
import { EmailRpcError } from '../errors.js';
import { consoleLogger, type LoggerLike } from '../logger.js';
import type { SendContext, Transport, TransportResult } from '../transport.js';
import type {
  MultiTransportBackoff,
  MultiTransportEntry,
  MultiTransportOptions,
  MultiTransportStrategy,
} from './multi.types.js';

export type {
  MultiTransportBackoff,
  MultiTransportEntry,
  MultiTransportOptions,
  MultiTransportStrategy,
} from './multi.types.js';

const validateOptions = (opts: MultiTransportOptions): void => {
  if (opts.transports.length === 0) {
    throw new EmailRpcError({
      code: 'CONFIG',
      message: 'multiTransport requires at least one transport',
    });
  }

  const max = opts.maxAttemptsPerTransport ?? 1;

  if (max < 1 || !Number.isInteger(max)) {
    throw new EmailRpcError({
      code: 'CONFIG',
      message: 'maxAttemptsPerTransport must be an integer >= 1',
    });
  }

  if (opts.backoff) {
    const { initialMs, factor, maxMs } = opts.backoff;

    if (initialMs <= 0 || factor < 1 || maxMs < initialMs) {
      throw new EmailRpcError({
        code: 'CONFIG',
        message: 'invalid backoff config',
      });
    }
  }
};

const computeBackoff = (attempt: number, cfg: MultiTransportBackoff): number => {
  const raw = cfg.initialMs * cfg.factor ** (attempt - 1);
  return Math.min(cfg.maxMs, raw);
};

const buildOrder = (
  strategy: MultiTransportStrategy,
  n: number,
  startRef: { value: number },
): number[] => {
  if (strategy === 'failover') {
    return Array.from({ length: n }, (_, i) => i);
  }

  let start: number;
  if (strategy === 'random') {
    start = Math.floor(Math.random() * n);
  } else {
    start = startRef.value % n;
    startRef.value = (startRef.value + 1) % n;
  }

  return Array.from({ length: n }, (_, i) => (start + i) % n);
};

const runVerify = async (
  inner: Transport<any, any>,
): Promise<{ name: string; ok: boolean; details?: unknown }> => {
  if (!inner.verify) return { name: inner.name, ok: true };

  const [err, res] = await handlePromise(inner.verify());

  if (err) return { name: inner.name, ok: false, details: err };

  return res.details === undefined
    ? { name: inner.name, ok: res.ok }
    : { name: inner.name, ok: res.ok, details: res.details };
};

const runClose = async (inner: Transport<any, any>, log: LoggerLike): Promise<void> => {
  if (!inner.close) return;
  const [err] = await handlePromise(inner.close());
  if (err) {
    log.error('multi close failed', { err, transportName: inner.name });
  }
};

/**
 * Compose multiple `Transport`s into a single composite transport with
 * configurable failover or round-robin orchestration.
 *
 * The returned object is itself a plain `Transport` — registered alongside any
 * other transport in `createClient`. From the client's perspective it is one
 * transport with `name` (default `'multi'`); per-attempt visibility lives in
 * the orchestration logger (see {@link MultiTransportOptions.logger}).
 *
 * Behavior summary:
 *
 * 1. Each `send()` builds an iteration order based on `strategy`. `'failover'`
 *    always starts at index 0; `'round-robin'` advances an in-process counter
 *    per call so successive sends start at different indices. In both cases,
 *    on failure the order walks forward through the remaining transports.
 * 2. For each transport in the order, up to `maxAttemptsPerTransport` calls
 *    are made. Between attempts on the *same* transport, `backoff` (if set)
 *    determines the delay. Advancing to the *next* transport never sleeps.
 * 3. After every failure, `isRetriable(err)` decides whether to keep retrying
 *    the same transport (retriable) or advance immediately (non-retriable).
 *    Either way, the composite continues until every transport has been tried;
 *    only then does it throw the most recent error.
 *
 * `verify()` runs every inner's `verify?.()` in parallel and reports
 * `{ ok: anyInnerOk, details: { results: [...] } }`. Inner verify throws are
 * captured in the per-inner slot — the composite never throws from `verify`.
 *
 * `close()` runs every inner's `close?.()` in parallel; individual errors are
 * logged at `error` level via the orchestration logger and swallowed so one
 * bad inner doesn't strand the others.
 *
 * Errors thrown by `send()` are the raw inner-transport error (the most recent
 * one) — not wrapped — so existing `onError` hooks see the same shape they
 * would from a single transport.
 *
 * @param opts See {@link MultiTransportOptions}. Validated synchronously;
 *   invalid configs throw `EmailRpcError({ code: 'CONFIG' })` from the call
 *   site, not from the first `send()`.
 */
export const multiTransport = <TRendered = unknown, TData = unknown>(
  opts: MultiTransportOptions<TRendered, TData>,
): Transport<TRendered, TData> => {
  validateOptions(opts);

  const name = opts.name ?? 'multi';
  const strategy = opts.strategy;
  const entries = opts.transports;
  const maxAttempts = opts.maxAttemptsPerTransport ?? 1;
  const isRetriable = opts.isRetriable ?? (() => true);
  const log = (opts.logger ?? consoleLogger()).child({
    component: 'multi-transport',
    name,
  });
  const counter = { value: 0 };

  const send = async (message: TRendered, ctx: SendContext): Promise<TransportResult<TData>> => {
    const order = buildOrder(strategy, entries.length, counter);
    let lastErr: unknown;
    let attempts = 0;

    for (const idx of order) {
      const entry = entries[idx];
      if (!entry) continue;
      const transport = entry.transport;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        attempts += 1;
        const [err, result] = await handlePromise(transport.send(message, ctx));
        const failure: unknown = err ? err : result && result.ok === false ? result.error : null;
        if (!failure) {
          log.debug('multi attempt ok', {
            transportName: transport.name,
            attempt,
            strategy,
          });
          return result as TransportResult<TData>;
        }
        lastErr = failure;
        const retriable = isRetriable(failure);
        log.warn('multi attempt failed', {
          err,
          transportName: transport.name,
          attempt,
          retriable,
        });
        if (!retriable) break;
        if (attempt < maxAttempts) {
          if (opts.backoff) {
            await waitFor(computeBackoff(attempt, opts.backoff));
          }
        }
      }
    }

    log.error('multi exhausted', { attempts, lastErr });
    throw lastErr;
  };

  const verify = async (): Promise<{ ok: boolean; details?: unknown }> => {
    const results = await Promise.all(entries.map((e) => runVerify(e.transport)));
    const ok = results.some((r) => r.ok);
    return { ok, details: { results } };
  };

  const close = async (): Promise<void> => {
    await Promise.all(entries.map((e) => runClose(e.transport, log)));
  };

  return { name, send, verify, close };
};
