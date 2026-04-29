import type { StandardSchemaV1 } from '@standard-schema/spec';

/**
 * Discriminant for every error thrown by BetterNotify.
 *
 * | Code                    | Thrown when                                                                      |
 * | ----------------------- | -------------------------------------------------------------------------------- |
 * | `VALIDATION`            | Input fails the schema declared with `.input()`                                  |
 * | `PROVIDER`              | Transport throws or returns `{ ok: false }`                                      |
 * | `CONFIG`                | No channel or transport is registered for the requested channel                  |
 * | `TIMEOUT`               | Send exceeds the configured timeout (reserved, not yet thrown)                   |
 * | `RENDER`                | Template adapter throws during `render()`                                        |
 * | `SUPPRESSED`            | Recipient is on a suppression list                                               |
 * | `RATE_LIMITED`          | `withRateLimit` middleware detects the threshold has been exceeded                |
 * | `NOT_IMPLEMENTED`       | Feature is declared but not yet shipped                                          |
 * | `CHANNEL_NOT_QUEUEABLE` | `.queue()` is called on a channel that has no queue adapter configured           |
 * | `BATCH_EMPTY`           | `.batch()` is called with an empty array                                         |
 * | `UNKNOWN`               | A middleware or hook threw a non-`NotifyRpcError`; re-wrapped at the boundary    |
 */
export type ErrorCode =
  | 'VALIDATION'
  | 'PROVIDER'
  | 'CONFIG'
  | 'TIMEOUT'
  | 'RENDER'
  | 'SUPPRESSED'
  | 'RATE_LIMITED'
  | 'NOT_IMPLEMENTED'
  | 'CHANNEL_NOT_QUEUEABLE'
  | 'BATCH_EMPTY'
  | 'UNKNOWN';

/** Constructor options for {@link NotifyRpcError}. */
export type NotifyRpcErrorOptions = {
  message: string;
  code?: ErrorCode;
  /** Dot-path route ID (e.g. `"transactional.welcome"`). */
  route?: string;
  /** UUID assigned to the individual send attempt. */
  messageId?: string;
  /** Original error that caused this error, available as `error.cause`. */
  cause?: unknown;
};

/**
 * Base class for all errors thrown by BetterNotify.
 *
 * Every error carries a {@link ErrorCode | `code`} discriminant so callers
 * can branch without fragile string matching on `message`. The class is
 * JSON-serializable via {@link toJSON} for queue persistence and structured
 * logging.
 *
 * ```ts
 * import { NotifyRpcError } from '@betternotify/core';
 *
 * try {
 *   await mail.welcome.send({ to, input });
 * } catch (err) {
 *   if (err instanceof NotifyRpcError) {
 *     console.error(err.code, err.route, err.messageId);
 *   }
 * }
 * ```
 */
export class NotifyRpcError extends Error {
  /** Machine-readable discriminant — see {@link ErrorCode} for the full table. */
  readonly code: ErrorCode;
  /** Dot-path route ID, present whenever the error is tied to a specific route. */
  readonly route: string | undefined;
  /** UUID of the send attempt that produced this error. */
  readonly messageId: string | undefined;

  constructor(opts: NotifyRpcErrorOptions) {
    super(opts.message, { cause: opts.cause });
    this.name = 'NotifyRpcError';
    this.code = opts.code ?? 'UNKNOWN';
    this.route = opts.route;
    this.messageId = opts.messageId;
  }

  /** Returns a plain object safe for `JSON.stringify` and queue persistence. */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      route: this.route,
      messageId: this.messageId,
    };
  }
}

/** Constructor options for {@link NotifyRpcValidationError}. */
export type NotifyRpcValidationErrorOptions = NotifyRpcErrorOptions & {
  /** Structured validation issues from the Standard Schema validator. */
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
};

/**
 * Thrown when the input supplied to a route fails schema validation.
 *
 * Inspect `issues` for the structured list of validation failures as returned
 * by the Standard Schema validator (Zod, Valibot, ArkType, etc.).
 *
 * ```ts
 * import { NotifyRpcValidationError } from '@betternotify/core';
 *
 * try {
 *   await mail.welcome.send({ to, input: { name: 42 } });
 * } catch (err) {
 *   if (err instanceof NotifyRpcValidationError) {
 *     console.error(err.issues);
 *   }
 * }
 * ```
 */
export class NotifyRpcValidationError extends NotifyRpcError {
  /** Structured validation issues returned by the schema validator. */
  readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;

  constructor(opts: NotifyRpcValidationErrorOptions) {
    super({ ...opts, code: 'VALIDATION' });
    this.name = 'NotifyRpcValidationError';
    this.issues = opts.issues;
  }

  override toJSON() {
    return { ...super.toJSON(), issues: this.issues };
  }
}

/** Constructor options for {@link NotifyRpcRateLimitedError}. */
export type NotifyRpcRateLimitedErrorOptions = Omit<NotifyRpcErrorOptions, 'code'> & {
  /** The rate-limit key that was exceeded (as resolved by the `key` option). */
  key: string;
  /** Milliseconds until the window resets. Pass to `setTimeout` before retrying. */
  retryAfterMs: number;
};

/**
 * Thrown by {@link withRateLimit} when the send threshold for a key has been
 * exceeded within the configured window.
 *
 * Use `retryAfterMs` to schedule the retry precisely:
 *
 * ```ts
 * import { NotifyRpcRateLimitedError } from '@betternotify/core';
 *
 * try {
 *   await mail.newsletter.send({ to, input });
 * } catch (err) {
 *   if (err instanceof NotifyRpcRateLimitedError) {
 *     console.log(`retry after ${err.retryAfterMs}ms (key: ${err.key})`);
 *   }
 * }
 * ```
 */
export class NotifyRpcRateLimitedError extends NotifyRpcError {
  /** The rate-limit key that was exceeded. */
  readonly key: string;
  /** Milliseconds until the current window resets. */
  readonly retryAfterMs: number;

  constructor(opts: NotifyRpcRateLimitedErrorOptions) {
    super({ ...opts, code: 'RATE_LIMITED' });
    this.name = 'NotifyRpcRateLimitedError';
    this.key = opts.key;
    this.retryAfterMs = opts.retryAfterMs;
  }

  override toJSON() {
    return { ...super.toJSON(), key: this.key, retryAfterMs: this.retryAfterMs };
  }
}

/**
 * Thrown when a caller invokes a feature that is declared in the API but not
 * yet shipped in the current release.
 */
export class NotifyRpcNotImplementedError extends NotifyRpcError {
  constructor(feature: string) {
    super({
      message: `${feature} is not implemented in v0.1.0; ships in a later release.`,
      code: 'NOT_IMPLEMENTED',
    });
    this.name = 'NotifyRpcNotImplementedError';
  }
}
