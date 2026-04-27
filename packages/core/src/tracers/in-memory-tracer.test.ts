import { describe, it, expect } from 'vitest';
import { inMemoryTracer } from './in-memory-tracer.js';

describe('inMemoryTracer', () => {
  it('records the span and returns the inner result', async () => {
    const tracer = inMemoryTracer();
    const result = await tracer.startActiveSpan('span-a', async (span) => {
      span.setAttribute('key', 'value');
      span.setStatus({ code: 'ok' });
      span.end();
      return 42;
    });
    expect(result).toBe(42);
    expect(tracer.spans).toHaveLength(1);
    expect(tracer.spans[0]).toMatchObject({
      name: 'span-a',
      attributes: { key: 'value' },
      status: { code: 'ok' },
      ended: true,
    });
  });

  it('captures exceptions recorded on the span', async () => {
    const tracer = inMemoryTracer();
    const err = new Error('boom');
    await expect(
      tracer.startActiveSpan('span-b', async (span) => {
        span.recordException(err);
        span.setStatus({ code: 'error', message: 'boom' });
        span.end();
        throw err;
      }),
    ).rejects.toThrow('boom');
    expect(tracer.spans[0]?.exceptions).toEqual([err]);
    expect(tracer.spans[0]?.status).toEqual({ code: 'error', message: 'boom' });
  });

  it('clears recorded spans on clear()', async () => {
    const tracer = inMemoryTracer();
    await tracer.startActiveSpan('s', async (span) => {
      span.end();
    });
    tracer.clear();
    expect(tracer.spans).toHaveLength(0);
  });
});
