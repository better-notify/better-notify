import { describe, it, expect } from 'vitest';
import { inMemoryEventSink } from './in-memory-event-sink.js';

const event = {
  route: 'welcome',
  messageId: 'm1',
  status: 'success' as const,
  durationMs: 12,
  startedAt: new Date('2026-01-01T00:00:00Z'),
  endedAt: new Date('2026-01-01T00:00:00Z'),
};

describe('inMemoryEventSink', () => {
  it('collects events in order', async () => {
    const sink = inMemoryEventSink();
    await sink.write(event);
    await sink.write({ ...event, messageId: 'm2' });
    expect(sink.events).toHaveLength(2);
    expect(sink.events[0]?.messageId).toBe('m1');
    expect(sink.events[1]?.messageId).toBe('m2');
  });

  it('clears events on clear()', async () => {
    const sink = inMemoryEventSink();
    await sink.write(event);
    sink.clear();
    expect(sink.events).toHaveLength(0);
  });
});
