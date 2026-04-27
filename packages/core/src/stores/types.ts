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

export type IdempotencyStore<TResult = unknown> = {
  get(key: string): Promise<TResult | null>;
  set(key: string, result: TResult, ttlMs: number): Promise<void>;
};
