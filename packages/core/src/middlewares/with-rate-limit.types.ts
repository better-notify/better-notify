import type { SendArgsLike } from './types.js';
import type { RateLimitAlgorithm, RateLimitStore } from '../stores/types.js';

export type RateLimitKeyParams<TInput = unknown> = {
  input: TInput;
  ctx: unknown;
  route: string;
  args: SendArgsLike;
};

export type RateLimitKey<TInput = unknown> =
  | string
  | ((params: RateLimitKeyParams<TInput>) => string);

export type WithRateLimitOptions<TInput = unknown> = {
  store: RateLimitStore;
  key: RateLimitKey<TInput>;
  max: number;
  window: number;
  algorithm?: RateLimitAlgorithm;
};
