import { NotifyRpcNotImplementedError } from './errors.js';
import type { AnyCatalog } from './catalog.js';
import type { QueueResult, SendResult } from './types.js';

export type CreateSenderOptions<R extends AnyCatalog, Ctx> = {
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

export type Sender<R extends AnyCatalog> = {
  [K in keyof R['definitions']]: ((input: unknown) => Promise<SendResult>) & {
    queue: (input: unknown, opts?: QueueSendOptions) => Promise<QueueResult>;
    render: (input: unknown, opts?: { format?: 'html' | 'text' | 'mime' }) => Promise<unknown>;
  };
} & {
  $send: (route: keyof R['definitions'] & string, input: unknown) => Promise<SendResult>;
};

/** @deprecated Use createClient from @emailrpc/core instead. */
export const createSender = <R extends AnyCatalog, Ctx = {}>(
  _opts: CreateSenderOptions<R, Ctx>,
): Sender<R> => {
  throw new NotifyRpcNotImplementedError('createSender is deprecated, use createClient instead');
};
