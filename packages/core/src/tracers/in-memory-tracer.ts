import type { SpanLike, SpanStatus, TracerLike } from './types.js';

export type RecordedSpan = {
  name: string;
  attributes: Record<string, string | number | boolean>;
  status: SpanStatus | null;
  exceptions: unknown[];
  ended: boolean;
};

export type InMemoryTracer = TracerLike & {
  readonly spans: ReadonlyArray<RecordedSpan>;
  clear(): void;
};

/**
 * Build an in-memory `TracerLike` that records each span for inspection.
 *
 * Useful for unit-testing tracing behavior without a real OpenTelemetry
 * pipeline. The recorded `spans` array preserves insertion order and stays
 * mutable until `clear()` is called.
 */
export const inMemoryTracer = (): InMemoryTracer => {
  const spans: RecordedSpan[] = [];
  return {
    spans,
    clear() {
      spans.length = 0;
    },
    async startActiveSpan(name, fn) {
      const record: RecordedSpan = {
        name,
        attributes: {},
        status: null,
        exceptions: [],
        ended: false,
      };
      spans.push(record);
      const span: SpanLike = {
        setAttribute(key, value) {
          record.attributes[key] = value;
        },
        setStatus(status) {
          record.status = status;
        },
        recordException(exception) {
          record.exceptions.push(exception);
        },
        end() {
          record.ended = true;
        },
      };
      return fn(span);
    },
  };
};
