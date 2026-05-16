import { describe, expect, it, vi, afterEach } from 'vitest';
import { NotifyRpcProviderError, NotifyRpcError } from '@betternotify/core';
import { whatsappMetaTransport } from './whatsapp-meta.js';
import { mockWhatsappTransport } from '../mock.js';
import type { RenderedWhatsApp } from '../../types.js';

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const successResponse = (messageId = 'wamid.abc123') => ({
  messaging_product: 'whatsapp',
  contacts: [{ input: '+5511999999999', wa_id: '5511999999999' }],
  messages: [{ id: messageId, message_status: 'accepted' }],
});

const opts = {
  accessToken: 'test-token',
  phoneNumberId: '123456789',
};

const ctx = { route: 'test.route', messageId: 'msg-1', attempt: 1 };

const expectUrl = (call: [string, RequestInit]) =>
  expect(String(call[0])).toBe(`https://graph.facebook.com/v25.0/${opts.phoneNumberId}/messages`);

const expectAuth = (call: [string, RequestInit]) => {
  const headers = new Headers(call[1].headers as Record<string, string>);
  expect(headers.get('Authorization')).toBe('Bearer test-token');
  expect(headers.get('Content-Type')).toBe('application/json');
};

const parseBody = (call: [string, RequestInit]) => JSON.parse(call[1].body as string);

describe('whatsappMetaTransport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('text', () => {
    it('sends text message', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const rendered: RenderedWhatsApp = { action: 'text', to: '+5511999999999', body: 'Hello!' };
      const result = await t.send(rendered, ctx);

      expect(fetchMock).toHaveBeenCalledOnce();
      const call = fetchMock.mock.calls[0] as [string, RequestInit];
      expectUrl(call);
      expectAuth(call);
      const body = parseBody(call);
      expect(body).toEqual({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '+5511999999999',
        type: 'text',
        text: { body: 'Hello!', preview_url: false },
      });
      expect(result).toEqual({
        ok: true,
        data: { messageId: 'wamid.abc123', waId: '5511999999999' },
      });
    });
  });

  describe('image', () => {
    it('sends image message with caption', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const rendered: RenderedWhatsApp = {
        action: 'image',
        to: '+5511999999999',
        url: 'https://example.com/img.jpg',
        caption: 'A photo',
      };
      const result = await t.send(rendered, ctx);

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.type).toBe('image');
      expect(body.image).toEqual({ link: 'https://example.com/img.jpg', caption: 'A photo' });
      expect(result.ok).toBe(true);
    });

    it('sends image message without caption', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const rendered: RenderedWhatsApp = {
        action: 'image',
        to: '+5511999999999',
        url: 'https://example.com/img.jpg',
      };
      await t.send(rendered, ctx);

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.image).toEqual({ link: 'https://example.com/img.jpg' });
    });
  });

  describe('video', () => {
    it('sends video message', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const rendered: RenderedWhatsApp = {
        action: 'video',
        to: '+5511999999999',
        url: 'https://example.com/vid.mp4',
        caption: 'Watch this',
      };
      await t.send(rendered, ctx);

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.type).toBe('video');
      expect(body.video).toEqual({ link: 'https://example.com/vid.mp4', caption: 'Watch this' });
    });

    it('sends video without caption', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        { action: 'video', to: '+5511999999999', url: 'https://example.com/vid.mp4' },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.video).toEqual({ link: 'https://example.com/vid.mp4' });
    });
  });

  describe('document', () => {
    it('sends document with caption and filename', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'document',
          to: '+5511999999999',
          url: 'https://example.com/doc.pdf',
          caption: 'Invoice',
          filename: 'invoice.pdf',
        },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.type).toBe('document');
      expect(body.document).toEqual({
        link: 'https://example.com/doc.pdf',
        caption: 'Invoice',
        filename: 'invoice.pdf',
      });
    });

    it('sends document without optional fields', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        { action: 'document', to: '+5511999999999', url: 'https://example.com/doc.pdf' },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.document).toEqual({ link: 'https://example.com/doc.pdf' });
    });
  });

  describe('audio', () => {
    it('sends audio message', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        { action: 'audio', to: '+5511999999999', url: 'https://example.com/audio.ogg' },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.type).toBe('audio');
      expect(body.audio).toEqual({ link: 'https://example.com/audio.ogg' });
    });
  });

  describe('location', () => {
    it('sends location with name and address', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'location',
          to: '+5511999999999',
          latitude: -23.5505,
          longitude: -46.6333,
          name: 'São Paulo',
          address: 'Av Paulista, 1000',
        },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.type).toBe('location');
      expect(body.location).toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
        name: 'São Paulo',
        address: 'Av Paulista, 1000',
      });
    });

    it('sends location without optional fields', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        { action: 'location', to: '+5511999999999', latitude: -23.5505, longitude: -46.6333 },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.location).toEqual({ latitude: -23.5505, longitude: -46.6333 });
    });
  });

  describe('reaction', () => {
    it('sends reaction message', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'reaction',
          to: '+5511999999999',
          emoji: '👍',
          messageId: 'wamid.original123',
        },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.type).toBe('reaction');
      expect(body.reaction).toEqual({ message_id: 'wamid.original123', emoji: '👍' });
    });
  });

  describe('interactive', () => {
    it('sends button interactive message', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'interactive',
          to: '+5511999999999',
          body: 'Choose one',
          header: 'Options',
          footer: 'Tap a button',
          buttons: [
            { id: 'btn_yes', title: 'Yes' },
            { id: 'btn_no', title: 'No' },
          ],
        },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.type).toBe('interactive');
      expect(body.interactive.type).toBe('button');
      expect(body.interactive.body).toEqual({ text: 'Choose one' });
      expect(body.interactive.header).toEqual({ type: 'text', text: 'Options' });
      expect(body.interactive.footer).toEqual({ text: 'Tap a button' });
      expect(body.interactive.action.buttons).toEqual([
        { type: 'reply', reply: { id: 'btn_yes', title: 'Yes' } },
        { type: 'reply', reply: { id: 'btn_no', title: 'No' } },
      ]);
    });

    it('sends list interactive message', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'interactive',
          to: '+5511999999999',
          body: 'Pick an item',
          sections: [
            {
              title: 'Section 1',
              rows: [
                { id: 'row_1', title: 'Item 1', description: 'First item' },
                { id: 'row_2', title: 'Item 2' },
              ],
            },
          ],
        },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.interactive.type).toBe('list');
      expect(body.interactive.action.button).toBe('Select');
      expect(body.interactive.action.sections).toEqual([
        {
          title: 'Section 1',
          rows: [
            { id: 'row_1', title: 'Item 1', description: 'First item' },
            { id: 'row_2', title: 'Item 2' },
          ],
        },
      ]);
    });

    it('sends interactive without optional header/footer', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'interactive',
          to: '+5511999999999',
          body: 'Choose',
          buttons: [{ id: 'btn_1', title: 'OK' }],
        },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.interactive.header).toBeUndefined();
      expect(body.interactive.footer).toBeUndefined();
    });

    it('returns VALIDATION error when both buttons and sections are present', async () => {
      const t = whatsappMetaTransport(opts);
      const result = await t.send(
        {
          action: 'interactive',
          to: '+5511999999999',
          body: 'Bad',
          buttons: [{ id: 'b', title: 'B' }],
          sections: [{ title: 'S', rows: [{ id: 'r', title: 'R' }] }],
        },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(NotifyRpcError);
        expect(result.error.message).toContain('both buttons and sections');
        expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
      }
    });

    it('returns VALIDATION error when neither buttons nor sections are present', async () => {
      const t = whatsappMetaTransport(opts);
      const result = await t.send(
        { action: 'interactive', to: '+5511999999999', body: 'Empty' },
        ctx,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain('either buttons or sections');
        expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
      }
    });
  });

  describe('contacts', () => {
    it('sends contacts message with full data', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'contacts',
          to: '+5511999999999',
          contacts: [
            {
              name: { formatted: 'John Doe', first: 'John', last: 'Doe' },
              phones: [{ phone: '+1234567890', type: 'WORK' }],
              emails: [{ email: 'john@example.com', type: 'WORK' }],
            },
          ],
        },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.type).toBe('contacts');
      expect(body.contacts).toEqual([
        {
          name: { formatted_name: 'John Doe', first_name: 'John', last_name: 'Doe' },
          phones: [{ phone: '+1234567890', type: 'WORK' }],
          emails: [{ email: 'john@example.com', type: 'WORK' }],
        },
      ]);
    });

    it('derives first_name from formatted when only formatted is provided (single name)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'contacts',
          to: '+5511999999999',
          contacts: [{ name: { formatted: 'Jane' } }],
        },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.contacts).toEqual([{ name: { formatted_name: 'Jane', first_name: 'Jane' } }]);
    });

    it('derives first_name and last_name from formatted when not provided', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'contacts',
          to: '+5511999999999',
          contacts: [{ name: { formatted: 'Maria Silva' } }],
        },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.contacts).toEqual([
        { name: { formatted_name: 'Maria Silva', first_name: 'Maria', last_name: 'Silva' } },
      ]);
    });

    it('sends contacts with phones without type', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'contacts',
          to: '+5511999999999',
          contacts: [
            {
              name: { formatted: 'Jane' },
              phones: [{ phone: '+1234567890' }],
              emails: [{ email: 'jane@example.com' }],
            },
          ],
        },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.contacts[0].name).toEqual({ formatted_name: 'Jane', first_name: 'Jane' });
      expect(body.contacts[0].phones).toEqual([{ phone: '+1234567890' }]);
      expect(body.contacts[0].emails).toEqual([{ email: 'jane@example.com' }]);
    });
  });

  describe('template', () => {
    it('sends template with name, language, and components', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const rendered: RenderedWhatsApp = {
        action: 'template',
        to: '+5511999999999',
        templateName: 'order_shipped',
        language: 'pt_BR',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'ORD-1234' },
              { type: 'text', text: 'BR987654321' },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: 'BR987654321' }],
          },
        ],
      };
      await t.send(rendered, ctx);

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body).toEqual({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '+5511999999999',
        type: 'template',
        template: {
          name: 'order_shipped',
          language: { code: 'pt_BR' },
          components: rendered.components,
        },
      });
    });

    it('sends template without components', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'template',
          to: '+5511999999999',
          templateName: 'hello_world',
          language: 'en_US',
        },
        ctx,
      );

      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.template).toEqual({ name: 'hello_world', language: { code: 'en_US' } });
      expect(body.template.components).toBeUndefined();
    });
  });

  describe('buffer upload', () => {
    const mediaUploadResponse = (id = 'media-123') => jsonResponse({ id });

    it('uploads buffer and sends image with media id', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mediaUploadResponse())
        .mockResolvedValueOnce(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.send(
        {
          action: 'image',
          to: '+5511999999999',
          data: Buffer.from('fake-image'),
          mimeType: 'image/png',
          caption: 'A photo',
        },
        ctx,
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);

      const uploadCall = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(uploadCall[0])).toBe(
        `https://graph.facebook.com/v25.0/${opts.phoneNumberId}/media`,
      );
      const uploadHeaders = new Headers(uploadCall[1].headers as Record<string, string>);
      expect(uploadHeaders.get('Authorization')).toBe('Bearer test-token');

      const sendCall = fetchMock.mock.calls[1] as [string, RequestInit];
      const body = parseBody(sendCall);
      expect(body.image).toEqual({ id: 'media-123', caption: 'A photo' });
      expect(result.ok).toBe(true);
    });

    it('uploads buffer and sends document with media id', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mediaUploadResponse('doc-456'))
        .mockResolvedValueOnce(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'document',
          to: '+5511999999999',
          data: Buffer.from('fake-pdf'),
          mimeType: 'application/pdf',
          filename: 'report.pdf',
          caption: 'Your report',
        },
        ctx,
      );

      const sendCall = fetchMock.mock.calls[1] as [string, RequestInit];
      const body = parseBody(sendCall);
      expect(body.document).toEqual({
        id: 'doc-456',
        caption: 'Your report',
        filename: 'report.pdf',
      });
    });

    it('uploads buffer and sends audio with media id', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mediaUploadResponse('audio-789'))
        .mockResolvedValueOnce(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'audio',
          to: '+5511999999999',
          data: Buffer.from('fake-audio'),
          mimeType: 'audio/mpeg',
        },
        ctx,
      );

      const sendCall = fetchMock.mock.calls[1] as [string, RequestInit];
      const body = parseBody(sendCall);
      expect(body.audio).toEqual({ id: 'audio-789' });
    });

    it('uploads buffer and sends video with media id', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mediaUploadResponse('vid-101'))
        .mockResolvedValueOnce(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        {
          action: 'video',
          to: '+5511999999999',
          data: Buffer.from('fake-video'),
          mimeType: 'video/mp4',
          caption: 'Watch this',
        },
        ctx,
      );

      const sendCall = fetchMock.mock.calls[1] as [string, RequestInit];
      const body = parseBody(sendCall);
      expect(body.video).toEqual({ id: 'vid-101', caption: 'Watch this' });
    });

    it('throws PROVIDER when media upload fails with network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

      const t = whatsappMetaTransport(opts);
      const promise = t.send(
        {
          action: 'image',
          to: '+5511999999999',
          data: Buffer.from('x'),
          mimeType: 'image/png',
        },
        ctx,
      );

      await expect(promise).rejects.toBeInstanceOf(NotifyRpcProviderError);
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('network error'),
        code: 'PROVIDER',
        provider: 'whatsapp-meta',
        retriable: true,
      });
    });

    it('throws TIMEOUT when media upload times out', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));

      const t = whatsappMetaTransport(opts);
      const promise = t.send(
        {
          action: 'image',
          to: '+5511999999999',
          data: Buffer.from('x'),
          mimeType: 'image/png',
        },
        ctx,
      );

      await expect(promise).rejects.toBeInstanceOf(NotifyRpcProviderError);
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('request timed out'),
        code: 'TIMEOUT',
      });
    });

    it('throws PROVIDER when media upload returns non-ok HTTP', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(jsonResponse({ error: { message: 'Invalid file', code: 100 } }, 400)),
      );

      const t = whatsappMetaTransport(opts);
      const promise = t.send(
        {
          action: 'image',
          to: '+5511999999999',
          data: Buffer.from('x'),
          mimeType: 'image/png',
        },
        ctx,
      );

      await expect(promise).rejects.toBeInstanceOf(NotifyRpcProviderError);
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('Invalid file'),
        code: 'PROVIDER',
        httpStatus: 400,
      });
    });

    it('throws PROVIDER with HTTP status fallback when upload error body has no message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: {} }, 502)));

      const t = whatsappMetaTransport(opts);
      const promise = t.send(
        {
          action: 'image',
          to: '+5511999999999',
          data: Buffer.from('x'),
          mimeType: 'image/png',
        },
        ctx,
      );

      await expect(promise).rejects.toBeInstanceOf(NotifyRpcProviderError);
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('HTTP 502'),
        code: 'PROVIDER',
        httpStatus: 502,
        retriable: true,
      });
    });

    it('throws PROVIDER when media upload returns no id', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));

      const t = whatsappMetaTransport(opts);
      const promise = t.send(
        {
          action: 'image',
          to: '+5511999999999',
          data: Buffer.from('x'),
          mimeType: 'image/png',
        },
        ctx,
      );

      await expect(promise).rejects.toBeInstanceOf(NotifyRpcProviderError);
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('missing media ID'),
      });
    });

    it('returns VALIDATION error when media has no url property', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const rendered = { action: 'audio', to: '+5511999999999' } as RenderedWhatsApp;
      const result = await t.send(rendered, ctx);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcError;
        expect(err).toBeInstanceOf(NotifyRpcError);
        expect(err.code).toBe('VALIDATION');
        expect(err.message).toContain('audio');
      }
    });

    it('returns VALIDATION error when media url is undefined', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const rendered = {
        action: 'audio',
        to: '+5511999999999',
        url: undefined,
      } as unknown as RenderedWhatsApp;
      const result = await t.send(rendered, ctx);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcError;
        expect(err).toBeInstanceOf(NotifyRpcError);
        expect(err.code).toBe('VALIDATION');
      }
    });

    it('skips upload for URL-based media', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      await t.send(
        { action: 'image', to: '+5511999999999', url: 'https://example.com/img.jpg' },
        ctx,
      );

      expect(fetchMock).toHaveBeenCalledOnce();
      const body = parseBody(fetchMock.mock.calls[0] as [string, RequestInit]);
      expect(body.image).toEqual({ link: 'https://example.com/img.jpg' });
    });
  });

  describe('configuration', () => {
    it('uses custom baseUrl', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successResponse()));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport({ ...opts, baseUrl: 'https://custom.graph.com/v26.0' });
      await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      const call = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(call[0])).toBe(`https://custom.graph.com/v26.0/${opts.phoneNumberId}/messages`);
    });
  });

  describe('validation', () => {
    it('returns VALIDATION error when to is empty', async () => {
      const t = whatsappMetaTransport(opts);
      const result = await t.send({ action: 'text', to: '', body: 'Hi' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(NotifyRpcError);
        expect(result.error.message).toContain('recipient');
        expect((result.error as NotifyRpcError).code).toBe('VALIDATION');
      }
    });
  });

  describe('error handling', () => {
    it('returns CONFIG error for auth failure (code 190)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { message: 'Invalid OAuth access token', code: 190, type: 'OAuthException' } },
            401,
          ),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(NotifyRpcProviderError);
        const err = result.error as NotifyRpcProviderError;
        expect(err.message).toContain('Invalid OAuth access token');
        expect(err.code).toBe('CONFIG');
        expect(err.provider).toBe('whatsapp-meta');
        expect(err.httpStatus).toBe(401);
        expect(err.providerCode).toBe('190');
        expect(err.retriable).toBe(false);
      }
    });

    it('returns CONFIG error for permission failure (code 200)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { message: 'Permission denied', code: 200, type: 'OAuthException' } },
            403,
          ),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('CONFIG');
        expect(err.providerCode).toBe('200');
        expect(err.retriable).toBe(false);
      }
    });

    it('returns CONFIG error for API call rate limit (code 4)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { error: { message: 'API call limit', code: 4, type: 'OAuthException' } },
            429,
          ),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('CONFIG');
        expect(err.providerCode).toBe('4');
        expect(err.retriable).toBe(false);
      }
    });

    it('returns retriable RATE_LIMITED error for throughput rate limit (code 130429)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { message: 'Throughput limit', code: 130429 } }, 429),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('RATE_LIMITED');
        expect(err.providerCode).toBe('130429');
        expect(err.retriable).toBe(true);
      }
    });

    it('returns retriable RATE_LIMITED error for per-user rate limit (code 131056)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { message: 'Per-user limit', code: 131056 } }, 429),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('RATE_LIMITED');
        expect(err.providerCode).toBe('131056');
        expect(err.retriable).toBe(true);
      }
    });

    it('returns VALIDATION error for message blocked (code 131026)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { message: 'Message blocked', code: 131026 } }, 400),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('VALIDATION');
        expect(err.providerCode).toBe('131026');
        expect(err.retriable).toBe(false);
      }
    });

    it('returns VALIDATION error for parameter validation error (code 100)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { message: 'Invalid parameter', code: 100 } }, 400),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('VALIDATION');
        expect(err.providerCode).toBe('100');
        expect(err.retriable).toBe(false);
      }
    });

    it.each([132000, 132001, 132005, 132007, 132012])(
      'returns VALIDATION error for template error code %i',
      async (metaCode) => {
        const fetchMock = vi
          .fn()
          .mockResolvedValue(
            jsonResponse({ error: { message: 'template error', code: metaCode } }, 400),
          );
        vi.stubGlobal('fetch', fetchMock);

        const t = whatsappMetaTransport(opts);
        const result = await t.send(
          {
            action: 'template',
            to: '+5511999999999',
            templateName: 'order_shipped',
            language: 'pt_BR',
          },
          ctx,
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
          const err = result.error as NotifyRpcProviderError;
          expect(err.code).toBe('VALIDATION');
          expect(err.providerCode).toBe(String(metaCode));
          expect(err.retriable).toBe(false);
        }
      },
    );

    it('returns retriable PROVIDER error for unknown error codes', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: { message: 'Unknown error', code: 999999 } }, 500),
        );
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.code).toBe('PROVIDER');
        expect(err.providerCode).toBe('999999');
        expect(err.retriable).toBe(true);
      }
    });

    it('returns PROVIDER error with HTTP status fallback when no error body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 500));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        const err = result.error as NotifyRpcProviderError;
        expect(err.message).toContain('HTTP 500');
        expect(err.code).toBe('PROVIDER');
        expect(err.retriable).toBe(true);
      }
    });

    it('throws PROVIDER on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

      const t = whatsappMetaTransport(opts);
      const promise = t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      await expect(promise).rejects.toBeInstanceOf(NotifyRpcProviderError);
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('network error'),
        code: 'PROVIDER',
        provider: 'whatsapp-meta',
        retriable: true,
      });
    });

    it('throws TIMEOUT on request timeout', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')));

      const t = whatsappMetaTransport(opts);
      const promise = t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      await expect(promise).rejects.toBeInstanceOf(NotifyRpcProviderError);
      await expect(promise).rejects.toMatchObject({
        message: expect.stringContaining('request timed out'),
        code: 'TIMEOUT',
        provider: 'whatsapp-meta',
        retriable: true,
      });
    });

    it('throws PROVIDER when response body is empty', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('   ', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );

      const t = whatsappMetaTransport(opts);
      const promise = t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      await expect(promise).rejects.toBeInstanceOf(NotifyRpcProviderError);
      await expect(promise).rejects.toMatchObject({
        message: 'WhatsApp Cloud API: empty response body',
        code: 'PROVIDER',
        provider: 'whatsapp-meta',
        retriable: true,
      });
    });

    it('throws PROVIDER when response omits message ID', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ messaging_product: 'whatsapp' }));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const promise = t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      await expect(promise).rejects.toBeInstanceOf(NotifyRpcProviderError);
      await expect(promise).rejects.toMatchObject({
        message: 'WhatsApp Cloud API: missing message ID in response',
        code: 'PROVIDER',
        provider: 'whatsapp-meta',
        retriable: true,
      });
    });

    it('omits waId when response has no contacts entry', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            jsonResponse({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.no-contact' }] }),
          ),
      );

      const t = whatsappMetaTransport(opts);
      const result = await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      expect(result).toEqual({ ok: true, data: { messageId: 'wamid.no-contact' } });
    });

    it('uses HTTP retry config', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ error: { message: 'retry', code: 2 } }, 503))
        .mockResolvedValueOnce(jsonResponse(successResponse()));
      const onRetry = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport({
        ...opts,
        http: {
          retry: {
            type: 'linear',
            attempts: 2,
            delay: 0,
            shouldRetry: (response) => response?.status === 503,
          },
          onRetry,
        },
      });
      const result = await t.send({ action: 'text', to: '+5511999999999', body: 'Hi' }, ctx);

      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledOnce();
    });
  });

  describe('verify', () => {
    it('returns ok with phone details', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({
          verified_name: 'My Business',
          display_phone_number: '+5511999999999',
          quality_rating: 'GREEN',
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.verify!();

      const call = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(String(call[0])).toBe(`https://graph.facebook.com/v25.0/${opts.phoneNumberId}`);
      const headers = new Headers(call[1].headers as Record<string, string>);
      expect(headers.get('Authorization')).toBe('Bearer test-token');
      expect(result).toEqual({
        ok: true,
        details: {
          verified_name: 'My Business',
          display_phone_number: '+5511999999999',
          quality_rating: 'GREEN',
        },
      });
    });

    it('returns not ok on HTTP failure', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ error: { message: 'Invalid token' } }, 401));
      vi.stubGlobal('fetch', fetchMock);

      const t = whatsappMetaTransport(opts);
      const result = await t.verify!();

      expect(result).toEqual({ ok: false, details: 'HTTP 401' });
    });

    it('returns not ok on network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection refused')));

      const t = whatsappMetaTransport(opts);
      const result = await t.verify!();

      expect(result).toEqual({ ok: false, details: 'connection refused' });
    });
  });
});

describe('mockWhatsappTransport', () => {
  it('tracks sent messages and returns mock data', async () => {
    const transport = mockWhatsappTransport();
    const result = await transport.send(
      { action: 'text', to: '+5511999999999', body: 'Hello' },
      ctx,
    );

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.messageId).toBe('wamid-mock-1');
    expect(transport.messages).toHaveLength(1);
    expect(transport.messages[0]).toMatchObject({ action: 'text', body: 'Hello' });
  });

  it('increments counter for multiple messages', async () => {
    const transport = mockWhatsappTransport();
    await transport.send({ action: 'text', to: '+55', body: 'First' }, ctx);
    const result = await transport.send({ action: 'text', to: '+55', body: 'Second' }, ctx);

    if (!result.ok) throw new Error('expected ok');
    expect(result.data.messageId).toBe('wamid-mock-2');
    expect(transport.messages).toHaveLength(2);
  });
});
