import { describe, expect, it } from 'vitest';
import type { JobEnvelope, JobResult, QueueProducer } from './types.js';

describe('queue contract types', () => {
  it('JobEnvelope and JobResult shapes are usable at runtime', () => {
    const env: JobEnvelope = {
      id: '1',
      route: 'a.b',
      args: { input: {} },
      attempt: 0,
      enqueuedAt: 'now',
    };
    const ok: JobResult = { status: 'sent', messageId: 'm1' };
    const dead: JobResult = {
      status: 'dlq',
      reason: 'unknown_route',
      error: { name: 'E', code: 'CONFIG', message: 'x' },
    };
    expect(env.route).toBe('a.b');
    expect(ok.status).toBe('sent');
    expect(dead.status).toBe('dlq');
  });

  it('QueueProducer is implementable', async () => {
    const producer: QueueProducer = { enqueue: async (e) => ({ id: e.id }) };
    const res = await producer.enqueue({
      id: 'z',
      route: 'r',
      args: {},
      attempt: 0,
      enqueuedAt: 't',
    });
    expect(res.id).toBe('z');
  });
});
