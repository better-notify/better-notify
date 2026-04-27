import { describe, expect, it } from 'vitest';
import { multiTransport, createTransport } from './multi.js';
import { mockSmsTransport } from './mock.js';

describe('sms multiTransport / createTransport wrappers', () => {
  it('multiTransport composes inner sms transports', async () => {
    const a = mockSmsTransport();
    const b = mockSmsTransport();
    const m = multiTransport({
      strategy: 'failover',
      transports: [{ transport: a }, { transport: b }],
    });
    const r = await m.send({ to: '+1', body: 'hi' }, { route: 'x', messageId: 'm', attempt: 1 });
    expect(r.ok).toBe(true);
  });

  it('createTransport produces a typed sms Transport', async () => {
    const t = createTransport({
      name: 'custom',
      send: async () => ({ ok: true, data: { messageId: 'abc' } }),
    });
    expect(t.name).toBe('custom');
    const r = await t.send({ to: '+1', body: 'hi' }, { route: 'x', messageId: 'm', attempt: 1 });
    if (!r.ok) throw new Error('expected ok');
    expect(r.data.messageId).toBe('abc');
  });

  it('provider transport packages stamp identity in their send closure', async () => {
    // Convention: provider authors close over their sender info inside `send`.
    // No framework-level option needed.
    const sender = '+15555550100';
    let captured: { from?: string } | undefined;
    const twilioStyle = createTransport({
      name: 'twilio',
      send: async (rendered) => {
        captured = { ...rendered, from: sender };
        return { ok: true, data: { messageId: 'abc' } };
      },
    });
    await twilioStyle.send({ to: '+1', body: 'hi' }, { route: 'x', messageId: 'm', attempt: 1 });
    expect(captured?.from).toBe(sender);
  });
});
