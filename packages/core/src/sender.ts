import { EmailRpcNotImplementedError } from './errors.js';
import type { AnyEmailCatalog } from './catalog.js';
import type { QueueResult, SendResult } from './types.js';

export type CreateSenderOptions<R extends AnyEmailCatalog, Ctx> = {
  catalog: R;
  transport: unknown;
  defaults?: {
    from?: string;
    replyTo?: string;
    headers?: Record<string, string>;
  };
  queue?: unknown;
  context?: (params: { requestId?: string }) => Ctx;
  plainTextFallback?: boolean;
};

export type QueueSendOptions = {
  delay?: number | string;
  attempts?: number;
  backoff?: { type: 'exponential' | 'fixed'; delay: number };
  priority?: number;
  jobId?: string;
  removeOnComplete?: { age: number };
};

export type Sender<R extends AnyEmailCatalog> = {
  [K in keyof R['emails']]: ((input: unknown) => Promise<SendResult>) & {
    queue: (input: unknown, opts?: QueueSendOptions) => Promise<QueueResult>;
    render: (input: unknown, opts?: { format?: 'html' | 'text' | 'mime' }) => Promise<unknown>;
  };
} & {
  $send: (route: keyof R['emails'] & string, input: unknown) => Promise<SendResult>;
};

/** @deprecated Use createClient from @emailrpc/core instead. */
export const createSender = <R extends AnyEmailCatalog, Ctx = {}>(
  _opts: CreateSenderOptions<R, Ctx>,
): Sender<R> => {
  throw new EmailRpcNotImplementedError('createSender is deprecated, use createClient instead');
};
