export type SpanStatusCode = 'ok' | 'error';

export type SpanStatus = {
  code: SpanStatusCode;
  message?: string;
};

export type SpanLike = {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: SpanStatus): void;
  recordException(exception: unknown): void;
  end(): void;
};

export type TracerLike = {
  startActiveSpan<T>(name: string, fn: (span: SpanLike) => Promise<T>): Promise<T>;
};
