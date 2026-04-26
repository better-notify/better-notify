import type { SendResult } from '../types.js';

export type SuppressionEntry = {
  reason: string;
  createdAt: Date;
};

export type SuppressionList = {
  get(email: string): Promise<SuppressionEntry | null>;
  set(email: string, entry: SuppressionEntry): Promise<void>;
  del(email: string): Promise<void>;
};

export type RateLimitAlgorithm = 'fixed' | 'sliding';

export type RateLimitRecord = {
  count: number;
  resetAtMs: number;
};

export type RateLimitStore = {
  record(key: string, windowMs: number, algorithm: RateLimitAlgorithm): Promise<RateLimitRecord>;
};

export type IdempotencyStore = {
  get(key: string): Promise<SendResult | null>;
  set(key: string, result: SendResult, ttlMs: number): Promise<void>;
};
