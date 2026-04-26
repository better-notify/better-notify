import type { RawSendArgs } from '../types.js';
import type { IdempotencyStore } from '../stores/types.js';

export type IdempotencyKeyParams<TInput = unknown> = {
  input: TInput;
  ctx: unknown;
  route: string;
  args: RawSendArgs;
};

export type IdempotencyKey<TInput = unknown> =
  | string
  | ((params: IdempotencyKeyParams<TInput>) => string);

export type WithIdempotencyOptions<TInput = unknown> = {
  store: IdempotencyStore;
  key: IdempotencyKey<TInput>;
  ttl: number;
};
