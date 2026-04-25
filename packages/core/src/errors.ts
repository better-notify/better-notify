import type { StandardSchemaV1 } from '@standard-schema/spec';

export type ErrorCode =
  | 'VALIDATION'
  | 'PROVIDER'
  | 'TIMEOUT'
  | 'RENDER'
  | 'SUPPRESSED'
  | 'NOT_IMPLEMENTED'
  | 'UNKNOWN';

export type EmailRpcErrorOptions = {
  message: string;
  code?: ErrorCode;
  route?: string;
  messageId?: string;
  cause?: unknown;
};

export class EmailRpcError extends Error {
  readonly code: ErrorCode;
  readonly route: string | undefined;
  readonly messageId: string | undefined;

  constructor(opts: EmailRpcErrorOptions) {
    super(opts.message, { cause: opts.cause });
    this.name = 'EmailRpcError';
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

export type EmailRpcValidationErrorOptions = EmailRpcErrorOptions & {
  issues: ReadonlyArray<StandardSchemaV1.Issue>;
};

export class EmailRpcValidationError extends EmailRpcError {
  readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;

  constructor(opts: EmailRpcValidationErrorOptions) {
    super({ ...opts, code: 'VALIDATION' });
    this.name = 'EmailRpcValidationError';
    this.issues = opts.issues;
  }

  override toJSON() {
    return { ...super.toJSON(), issues: this.issues };
  }
}

export class EmailRpcNotImplementedError extends EmailRpcError {
  constructor(feature: string) {
    super({
      message: `${feature} is not implemented in v0.1.0; ships in a later release.`,
      code: 'NOT_IMPLEMENTED',
    });
    this.name = 'EmailRpcNotImplementedError';
  }
}
