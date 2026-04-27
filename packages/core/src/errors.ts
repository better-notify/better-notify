import type { StandardSchemaV1 } from '@standard-schema/spec';

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

export type NotifyRpcErrorOptions = {
  message: string;
  code?: ErrorCode;
  route?: string;
  messageId?: string;
  cause?: unknown;
};

export class NotifyRpcError extends Error {
  readonly code: ErrorCode;
  readonly route: string | undefined;
  readonly messageId: string | undefined;

  constructor(opts: NotifyRpcErrorOptions) {
    super(opts.message, { cause: opts.cause });
    this.name = 'NotifyRpcError';
    this.code = opts.code ?? 'UNKNOWN';
    this.route = opts.route;
    this.messageId = opts.messageId;
  }

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

export type NotifyRpcValidationErrorOptions = NotifyRpcErrorOptions & {
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
};

export class NotifyRpcValidationError extends NotifyRpcError {
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

export type NotifyRpcRateLimitedErrorOptions = Omit<NotifyRpcErrorOptions, 'code'> & {
  key: string;
  retryAfterMs: number;
};

export class NotifyRpcRateLimitedError extends NotifyRpcError {
  readonly key: string;
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

export class NotifyRpcNotImplementedError extends NotifyRpcError {
  constructor(feature: string) {
    super({
      message: `${feature} is not implemented in v0.1.0; ships in a later release.`,
      code: 'NOT_IMPLEMENTED',
    });
    this.name = 'NotifyRpcNotImplementedError';
  }
}
