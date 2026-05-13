import { describe, expect, it } from 'vitest';
import { mockWebPushTransport } from './mock.js';
import { multiTransport } from './multi.js';

const sub = (id = '1') => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
  keys: { p256dh: `BNcRdreALRFXTkOOUH-${id}`, auth: `tBHItJI5svbpC7-${id}` },
});

describe('mockWebPushTransport', () => {
  it('has name "mock-webpush"', () => {
    expect(mockWebPushTransport().name).toBe('mock-webpush');
  });

  it('records sent messages', async () => {
    const transport = mockWebPushTransport();
    const s = sub();
    const result = await transport.send(
      { title: 'Hi', body: 'Hello', to: s },
      { route: 'test', messageId: '1', attempt: 1 },
    );
    expect(result.ok).toBe(true);
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]).toMatchObject({ title: 'Hi', body: 'Hello', to: s });
    expect(typeof transport.messages[0]!.id).toBe('string');
  });

  it('returns per-subscription results', async () => {
    const transport = mockWebPushTransport();
    const subs = [sub('a'), sub('b')];
    const result = await transport.send(
      { title: 'Hi', body: 'Hello', to: subs },
      { route: 'test', messageId: '1', attempt: 1 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.results).toHaveLength(2);
      expect(result.data.results[0]!.endpoint).toBe('https://fcm.googleapis.com/fcm/send/a');
      expect(result.data.results[1]!.endpoint).toBe('https://fcm.googleapis.com/fcm/send/b');
    }
  });

  it('increments message ids', async () => {
    const transport = mockWebPushTransport();
    const ctx = { route: 'test', messageId: '1', attempt: 1 };
    await transport.send({ title: 'A', body: 'a', to: sub('1') }, ctx);
    await transport.send({ title: 'B', body: 'b', to: sub('2') }, ctx);
    expect(transport.messages[0]!.id).toBe('webpush-mock-1');
    expect(transport.messages[1]!.id).toBe('webpush-mock-2');
  });

  it('exposes sent array from core mock', async () => {
    const transport = mockWebPushTransport();
    await transport.send(
      { title: 'Hi', body: 'Hello', to: sub() },
      { route: 'test', messageId: '1', attempt: 1 },
    );
    expect(transport.sent).toHaveLength(1);
  });

  it('handles missing to field', async () => {
    const transport = mockWebPushTransport();
    const result = await transport.send(
      { title: 'Hi', body: 'Hello' },
      { route: 'test', messageId: '1', attempt: 1 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.results).toHaveLength(0);
    }
  });
});

describe('multiTransport', () => {
  it('wraps multiple transports with failover', async () => {
    const a = mockWebPushTransport();
    const transport = multiTransport({ strategy: 'failover', transports: [{ transport: a }] });
    const s = sub();
    const result = await transport.send(
      { title: 'Hi', body: 'Hello', to: s },
      { route: 'test', messageId: '1', attempt: 1 },
    );
    expect(result.ok).toBe(true);
    expect(a.sent).toHaveLength(1);
  });
});
