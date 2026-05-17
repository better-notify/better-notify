import { describe, it, expect } from 'vitest';
import { createRingBuffer } from './ring-buffer.js';
import type { SendEventRecord } from './types.js';

const makeEvent = (overrides: Partial<SendEventRecord> = {}): SendEventRecord => ({
  route: 'transactional.welcome',
  messageId: crypto.randomUUID(),
  status: 'success',
  durationMs: 100,
  startedAt: new Date(),
  endedAt: new Date(),
  ...overrides,
});

describe('createRingBuffer', () => {
  it('throws when maxSize is not a positive integer', () => {
    expect(() => createRingBuffer(0)).toThrow('maxSize must be a positive integer');
    expect(() => createRingBuffer(-1)).toThrow('maxSize must be a positive integer');
    expect(() => createRingBuffer(1.5)).toThrow('maxSize must be a positive integer');
    expect(() => createRingBuffer(NaN)).toThrow('maxSize must be a positive integer');
  });

  it('returns a snapshot from getAll so mutations do not affect internal state', () => {
    const buffer = createRingBuffer(10);
    buffer.push(makeEvent());
    const snapshot = buffer.getAll();
    (snapshot as SendEventRecord[]).length = 0;
    expect(buffer.getAll()).toHaveLength(1);
  });

  it('stores and retrieves events', () => {
    const buffer = createRingBuffer(10);
    const event = makeEvent();
    buffer.push(event);
    expect(buffer.getAll()).toEqual([event]);
  });

  it('evicts oldest events when maxSize is exceeded', () => {
    const buffer = createRingBuffer(3);
    const events = Array.from({ length: 5 }, (_, i) => makeEvent({ durationMs: i }));
    for (const e of events) buffer.push(e);
    const all = buffer.getAll();
    expect(all).toHaveLength(3);
    expect(all[0]?.durationMs).toBe(2);
    expect(all[1]?.durationMs).toBe(3);
    expect(all[2]?.durationMs).toBe(4);
  });

  it('filters by route', () => {
    const buffer = createRingBuffer(10);
    buffer.push(makeEvent({ route: 'transactional.welcome' }));
    buffer.push(makeEvent({ route: 'transactional.reset' }));
    buffer.push(makeEvent({ route: 'transactional.welcome' }));
    expect(buffer.getByRoute('transactional.welcome')).toHaveLength(2);
    expect(buffer.getByRoute('transactional.reset')).toHaveLength(1);
    expect(buffer.getByRoute('marketing.promo')).toHaveLength(0);
  });

  it('computes stats correctly', () => {
    const buffer = createRingBuffer(10);
    buffer.push(makeEvent({ route: 'a', status: 'success', durationMs: 100 }));
    buffer.push(makeEvent({ route: 'a', status: 'success', durationMs: 200 }));
    buffer.push(makeEvent({ route: 'a', status: 'error', durationMs: 50 }));
    buffer.push(makeEvent({ route: 'b', status: 'success', durationMs: 300 }));

    const stats = buffer.getStats();
    expect(stats.total).toBe(4);
    expect(stats.success).toBe(3);
    expect(stats.error).toBe(1);
    expect(stats.routes['a']?.total).toBe(3);
    expect(stats.routes['a']?.success).toBe(2);
    expect(stats.routes['a']?.error).toBe(1);
    expect(stats.routes['a']?.avgDurationMs).toBe(117);
    expect(stats.routes['b']?.total).toBe(1);
    expect(stats.routes['b']?.avgDurationMs).toBe(300);
  });

  it('clears all events', () => {
    const buffer = createRingBuffer(10);
    buffer.push(makeEvent());
    buffer.push(makeEvent());
    buffer.clear();
    expect(buffer.getAll()).toHaveLength(0);
  });

  it('returns empty stats when buffer is empty', () => {
    const buffer = createRingBuffer(10);
    const stats = buffer.getStats();
    expect(stats.total).toBe(0);
    expect(stats.success).toBe(0);
    expect(stats.error).toBe(0);
    expect(stats.routes).toEqual({});
  });
});
