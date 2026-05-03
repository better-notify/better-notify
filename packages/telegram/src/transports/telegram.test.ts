import { describe, expect, it, vi, afterEach } from 'vitest';
import { NotifyRpcError } from '@betternotify/core';
import { telegramTransport } from './telegram.js';
import { mockTelegramTransport } from './mock.js';

const mockFetch = (response: { ok: boolean; result?: unknown; description?: string }) =>
  vi.fn().mockResolvedValue({
    ok: response.ok,
    json: async () => response,
  });

const ctx = { route: 'test.route', messageId: 'msg-1', attempt: 1 };

describe('telegramTransport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends text message via sendMessage', async () => {
    const fetchMock = mockFetch({ ok: true, result: { message_id: 42, chat: { id: 123 } } });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'BOT_TOKEN' });
    const result = await t.send({ body: 'Hello!', to: 123 }, ctx);

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe('https://api.telegram.org/botBOT_TOKEN/sendMessage');
    expect(JSON.parse(call[1].body as string)).toEqual({ chat_id: 123, text: 'Hello!' });
    expect(result).toEqual({ ok: true, data: { messageId: 42, chatId: 123 } });
  });

  it('sends parse_mode when set', async () => {
    const fetchMock = mockFetch({ ok: true, result: { message_id: 1, chat: { id: 1 } } });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });
    await t.send({ body: '<b>hi</b>', to: 1, parseMode: 'HTML' }, ctx);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.parse_mode).toBe('HTML');
  });

  it('sends photo via sendPhoto', async () => {
    const fetchMock = mockFetch({ ok: true, result: { message_id: 5, chat: { id: 99 } } });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });
    await t.send(
      {
        body: 'fallback',
        to: 99,
        attachment: { type: 'photo', url: 'https://img.png', caption: 'Look!' },
      },
      ctx,
    );

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/sendPhoto');
    const body = JSON.parse(call[1].body as string);
    expect(body.photo).toBe('https://img.png');
    expect(body.caption).toBe('Look!');
  });

  it('uses attachment.caption over body for media when provided', async () => {
    const fetchMock = mockFetch({ ok: true, result: { message_id: 1, chat: { id: 1 } } });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });
    await t.send(
      {
        body: 'body text',
        to: 1,
        attachment: { type: 'document', url: 'https://f.pdf', caption: 'My doc' },
      },
      ctx,
    );

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.caption).toBe('My doc');
  });

  it('falls back to body when attachment has no caption', async () => {
    const fetchMock = mockFetch({ ok: true, result: { message_id: 1, chat: { id: 1 } } });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });
    await t.send(
      { body: 'body text', to: 1, attachment: { type: 'document', url: 'https://f.pdf' } },
      ctx,
    );

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(call[1].body as string);
    expect(body.caption).toBe('body text');
  });

  it('sends video via sendVideo', async () => {
    const fetchMock = mockFetch({ ok: true, result: { message_id: 1, chat: { id: 1 } } });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });
    await t.send({ body: 'x', to: 1, attachment: { type: 'video', url: 'https://v.mp4' } }, ctx);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/sendVideo');
    expect(JSON.parse(call[1].body as string).video).toBe('https://v.mp4');
  });

  it('sends audio via sendAudio', async () => {
    const fetchMock = mockFetch({ ok: true, result: { message_id: 1, chat: { id: 1 } } });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });
    await t.send({ body: 'x', to: 1, attachment: { type: 'audio', url: 'https://a.mp3' } }, ctx);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/sendAudio');
    expect(JSON.parse(call[1].body as string).audio).toBe('https://a.mp3');
  });

  it('throws NotifyRpcError with code PROVIDER on non-ok response', async () => {
    const fetchMock = mockFetch({ ok: false, description: 'Chat not found' });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });

    await expect(t.send({ body: 'hi', to: 999 }, ctx)).rejects.toThrow(NotifyRpcError);
    await expect(t.send({ body: 'hi', to: 999 }, ctx)).rejects.toMatchObject({
      code: 'PROVIDER',
      message: expect.stringContaining('Chat not found'),
    });
  });

  it('verify() calls getMe and returns ok with details', async () => {
    const fetchMock = mockFetch({ ok: true, result: { id: 1, is_bot: true, first_name: 'Bot' } });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });
    const result = await t.verify?.();

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/getMe');
    expect(result).toEqual({ ok: true, details: { id: 1, is_bot: true, first_name: 'Bot' } });
  });

  it('verify() returns not ok on failure', async () => {
    const fetchMock = mockFetch({ ok: false, description: 'Unauthorized' });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'BAD' });
    const result = await t.verify?.();

    expect(result).toEqual({ ok: false, details: 'Unauthorized' });
  });

  it('uses custom apiUrl when provided', async () => {
    const fetchMock = mockFetch({ ok: true, result: { message_id: 1, chat: { id: 1 } } });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T', apiUrl: 'https://custom.api' });
    await t.send({ body: 'hi', to: 1 }, ctx);

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe('https://custom.api/botT/sendMessage');
  });

  it('falls back to sendDocument for unknown attachment type', async () => {
    const fetchMock = mockFetch({ ok: true, result: { message_id: 1, chat: { id: 1 } } });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });
    await t.send(
      { body: 'x', to: 1, attachment: { type: 'sticker' as never, url: 'https://s.webp' } },
      ctx,
    );

    const call = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(call[0]).toContain('/sendDocument');
  });

  it('handles error response without description field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });
    await expect(t.send({ body: 'hi', to: 1 }, ctx)).rejects.toMatchObject({
      code: 'PROVIDER',
      message: expect.stringContaining('Unknown Telegram API error'),
    });
  });

  it('handles success response with missing result fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });
    const result = await t.send({ body: 'hi', to: 1 }, ctx);

    expect(result).toEqual({ ok: true, data: { messageId: 0, chatId: 0 } });
  });

  it('verify() handles failure without description', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const t = telegramTransport({ token: 'T' });
    const result = await t.verify?.();

    expect(result).toEqual({ ok: false, details: 'Unknown error' });
  });
});

describe('mockTelegramTransport', () => {
  it('falls back chatId to empty string when rendered.to is undefined', async () => {
    const transport = mockTelegramTransport();
    const result = await transport.send({ body: 'hi' }, ctx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.chatId).toBe('');
    expect(transport.messages[0]).toMatchObject({ body: 'hi' });
  });
});
