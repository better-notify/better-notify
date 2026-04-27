import { describe, expect, it } from 'vitest';
import { createTransport } from './create-transport.js';
import type { RenderedMessage, SendContext } from '../types.js';

const baseMessage: RenderedMessage = {
  to: [{ email: 'rcpt@example.com' }],
  from: { email: 'sender@example.com' },
  subject: 'hi',
  html: '<p>hi</p>',
  text: 'hi',
  headers: {},
  attachments: [],
  inlineAssets: {},
};

const baseCtx: SendContext = {
  route: 'welcome',
  messageId: 'msg-1',
  attempt: 1,
};

describe('createTransport', () => {
  it('returns a Transport with the given name and send', async () => {
    const t = createTransport({
      name: 'my-api',
      send: async () => ({ ok: true, data: { accepted: ['a@b.com'], rejected: [] } }),
    });
    expect(t.name).toBe('my-api');
    const result = await t.send(baseMessage, baseCtx);
    if (!result.ok) throw new Error('expected ok');
    expect(result.data.accepted).toEqual(['a@b.com']);
  });

  it('passes message and ctx through to the user-supplied send', async () => {
    let captured: { message?: RenderedMessage; ctx?: SendContext } = {};
    const t = createTransport({
      name: 'capture',
      send: async (message, ctx) => {
        captured = { message, ctx };
        return { ok: true, data: { accepted: [], rejected: [] } };
      },
    });
    await t.send(baseMessage, baseCtx);
    expect(captured.message).toBe(baseMessage);
    expect(captured.ctx).toBe(baseCtx);
  });

  it('default verify resolves to { ok: true }', async () => {
    const t = createTransport({
      name: 'my-api',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
    });
    const res = await t.verify!();
    expect(res).toEqual({ ok: true });
  });

  it('default close resolves to undefined', async () => {
    const t = createTransport({
      name: 'my-api',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
    });
    await expect(t.close!()).resolves.toBeUndefined();
  });

  it('honors a custom verify', async () => {
    const t = createTransport({
      name: 'my-api',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      verify: async () => ({ ok: false, details: 'down' }),
    });
    const res = await t.verify!();
    expect(res).toEqual({ ok: false, details: 'down' });
  });

  it('honors a custom close', async () => {
    let closed = false;
    const t = createTransport({
      name: 'my-api',
      send: async () => ({ ok: true, data: { accepted: [], rejected: [] } }),
      close: async () => {
        closed = true;
      },
    });
    await t.close!();
    expect(closed).toBe(true);
  });

});
