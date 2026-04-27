import { describe, expect, it } from 'vitest';
import { multiTransport, createTransport } from './multi.js';
import { mockPushTransport } from './mock.js';

describe('push multiTransport / createTransport wrappers', () => {
  it('multiTransport composes inner push transports', async () => {
    const a = mockPushTransport();
    const b = mockPushTransport();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    const r = await m.send(
      { to: 'token', title: 't', body: 'b' },
      { route: 'x', messageId: 'm', attempt: 1 },
    );
    expect(r.ok).toBe(true);
  });

  it('createTransport produces a typed push Transport', async () => {
    const t = createTransport({
      name: 'custom',
      send: async () => ({ ok: true, data: { messageId: 'abc' } }),
    });
    expect(t.name).toBe('custom');
    const r = await t.send(
      { to: 'token', title: 't', body: 'b' },
      { route: 'x', messageId: 'm', attempt: 1 },
    );
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.messageId).toBe('abc');
  });
});
