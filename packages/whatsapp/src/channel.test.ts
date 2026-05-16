import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { whatsappChannel } from './channel.js';

const ch = whatsappChannel();
const picker = () => ch.createBuilder({ ctx: undefined, rootMiddleware: [] });

describe('whatsappChannel', () => {
  it('has name "whatsapp"', () => {
    expect(ch.name).toBe('whatsapp');
  });

  describe('action picker', () => {
    it('text() returns a builder with _channel="whatsapp"', () => {
      const b = picker().text();
      expect((b as unknown as { _channel: string })._channel).toBe('whatsapp');
    });

    it('image() returns a builder with _channel="whatsapp"', () => {
      const b = picker().image();
      expect((b as unknown as { _channel: string })._channel).toBe('whatsapp');
    });

    it('video() returns a builder with _channel="whatsapp"', () => {
      const b = picker().video();
      expect((b as unknown as { _channel: string })._channel).toBe('whatsapp');
    });

    it('document() returns a builder with _channel="whatsapp"', () => {
      const b = picker().document();
      expect((b as unknown as { _channel: string })._channel).toBe('whatsapp');
    });

    it('audio() returns a builder with _channel="whatsapp"', () => {
      const b = picker().audio();
      expect((b as unknown as { _channel: string })._channel).toBe('whatsapp');
    });

    it('location() returns a builder with _channel="whatsapp"', () => {
      const b = picker().location();
      expect((b as unknown as { _channel: string })._channel).toBe('whatsapp');
    });

    it('reaction() returns a builder with _channel="whatsapp"', () => {
      const b = picker().reaction();
      expect((b as unknown as { _channel: string })._channel).toBe('whatsapp');
    });

    it('interactive() returns a builder with _channel="whatsapp"', () => {
      const b = picker().interactive();
      expect((b as unknown as { _channel: string })._channel).toBe('whatsapp');
    });

    it('contacts() returns a builder with _channel="whatsapp"', () => {
      const b = picker().contacts();
      expect((b as unknown as { _channel: string })._channel).toBe('whatsapp');
    });
  });

  describe('text builder', () => {
    it('renders text with body from resolver', async () => {
      const builder = picker()
        .text()
        .input(z.object({ msg: z.string() }))
        .body(({ input }) => `Hello: ${input.msg}`);
      const def = ch.finalize(builder, 'greeting');
      const out = await ch.render(def, { to: '+1234567890', input: { msg: 'world' } }, {});
      expect(out).toEqual({
        action: 'text',
        to: '+1234567890',
        body: 'Hello: world',
      });
    });

    it('renders text with static body', async () => {
      const builder = picker()
        .text()
        .input(z.object({ x: z.string() }))
        .body('Static message');
      const def = ch.finalize(builder, 'static');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'text',
        to: '+1234567890',
        body: 'Static message',
      });
    });

    it('finalize throws when body is missing', () => {
      const builder = picker()
        .text()
        .input(z.object({ x: z.string() }));
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: body/);
    });

    it('finalize throws when input is missing', () => {
      const builder = picker().text().body('B');
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: input/);
    });
  });

  describe('image builder', () => {
    it('renders image with url only', async () => {
      const builder = picker()
        .image()
        .input(z.object({ x: z.string() }))
        .url('https://example.com/img.png');
      const def = ch.finalize(builder, 'img');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'image',
        to: '+1234567890',
        url: 'https://example.com/img.png',
      });
      expect(out).not.toHaveProperty('caption');
    });

    it('renders image with caption', async () => {
      const builder = picker()
        .image()
        .input(z.object({ x: z.string() }))
        .url('https://example.com/img.png')
        .caption('A nice image');
      const def = ch.finalize(builder, 'img-cap');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'image',
        to: '+1234567890',
        url: 'https://example.com/img.png',
        caption: 'A nice image',
      });
    });

    it('renders image with dynamic url and caption resolvers', async () => {
      const builder = picker()
        .image()
        .input(z.object({ name: z.string() }))
        .url(({ input }) => `https://cdn.example.com/${input.name}.png`)
        .caption(({ input }) => `Photo of ${input.name}`);
      const def = ch.finalize(builder, 'img-dyn');
      const out = await ch.render(def, { to: '+1234567890', input: { name: 'cat' } }, {});
      expect(out).toEqual({
        action: 'image',
        to: '+1234567890',
        url: 'https://cdn.example.com/cat.png',
        caption: 'Photo of cat',
      });
    });

    it('finalizes without url when data is provided instead', () => {
      const builder = picker()
        .image()
        .input(z.object({ x: z.string() }))
        .data(({ input }) => Buffer.from(input.x))
        .mimeType('image/png');
      expect(() => ch.finalize(builder, 'r')).not.toThrow();
    });
  });

  describe('video builder', () => {
    it('renders video with url only', async () => {
      const builder = picker()
        .video()
        .input(z.object({ x: z.string() }))
        .url('https://example.com/video.mp4');
      const def = ch.finalize(builder, 'vid');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'video',
        to: '+1234567890',
        url: 'https://example.com/video.mp4',
      });
      expect(out).not.toHaveProperty('caption');
    });

    it('renders video with caption', async () => {
      const builder = picker()
        .video()
        .input(z.object({ x: z.string() }))
        .url('https://example.com/video.mp4')
        .caption('A great video');
      const def = ch.finalize(builder, 'vid-cap');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'video',
        to: '+1234567890',
        url: 'https://example.com/video.mp4',
        caption: 'A great video',
      });
    });

    it('finalizes without url when data is provided instead', () => {
      const builder = picker()
        .video()
        .input(z.object({ x: z.string() }))
        .data(({ input }) => Buffer.from(input.x))
        .mimeType('video/mp4');
      expect(() => ch.finalize(builder, 'r')).not.toThrow();
    });
  });

  describe('document builder', () => {
    it('renders document with url only', async () => {
      const builder = picker()
        .document()
        .input(z.object({ x: z.string() }))
        .url('https://example.com/doc.pdf');
      const def = ch.finalize(builder, 'doc');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'document',
        to: '+1234567890',
        url: 'https://example.com/doc.pdf',
      });
      expect(out).not.toHaveProperty('caption');
      expect(out).not.toHaveProperty('filename');
    });

    it('renders document with caption and filename', async () => {
      const builder = picker()
        .document()
        .input(z.object({ x: z.string() }))
        .url('https://example.com/doc.pdf')
        .caption('Important document')
        .filename('report.pdf');
      const def = ch.finalize(builder, 'doc-full');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'document',
        to: '+1234567890',
        url: 'https://example.com/doc.pdf',
        caption: 'Important document',
        filename: 'report.pdf',
      });
    });

    it('renders document with caption only', async () => {
      const builder = picker()
        .document()
        .input(z.object({ x: z.string() }))
        .url('https://example.com/doc.pdf')
        .caption('Just a caption');
      const def = ch.finalize(builder, 'doc-cap');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'document',
        to: '+1234567890',
        url: 'https://example.com/doc.pdf',
        caption: 'Just a caption',
      });
      expect(out).not.toHaveProperty('filename');
    });

    it('renders document with filename only', async () => {
      const builder = picker()
        .document()
        .input(z.object({ x: z.string() }))
        .url('https://example.com/doc.pdf')
        .filename('invoice.pdf');
      const def = ch.finalize(builder, 'doc-fn');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'document',
        to: '+1234567890',
        url: 'https://example.com/doc.pdf',
        filename: 'invoice.pdf',
      });
      expect(out).not.toHaveProperty('caption');
    });

    it('finalizes without url when data is provided instead', () => {
      const builder = picker()
        .document()
        .input(z.object({ x: z.string() }))
        .data(({ input }) => Buffer.from(input.x))
        .mimeType('application/pdf');
      expect(() => ch.finalize(builder, 'r')).not.toThrow();
    });
  });

  describe('audio builder', () => {
    it('renders audio with url', async () => {
      const builder = picker()
        .audio()
        .input(z.object({ x: z.string() }))
        .url('https://example.com/audio.ogg');
      const def = ch.finalize(builder, 'aud');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'audio',
        to: '+1234567890',
        url: 'https://example.com/audio.ogg',
      });
    });

    it('renders audio with dynamic url', async () => {
      const builder = picker()
        .audio()
        .input(z.object({ track: z.string() }))
        .url(({ input }) => `https://cdn.example.com/${input.track}.ogg`);
      const def = ch.finalize(builder, 'aud-dyn');
      const out = await ch.render(def, { to: '+1234567890', input: { track: 'song1' } }, {});
      expect(out).toEqual({
        action: 'audio',
        to: '+1234567890',
        url: 'https://cdn.example.com/song1.ogg',
      });
    });

    it('finalizes without url when data is provided instead', () => {
      const builder = picker()
        .audio()
        .input(z.object({ x: z.string() }))
        .data(({ input }) => Buffer.from(input.x))
        .mimeType('audio/mpeg');
      expect(() => ch.finalize(builder, 'r')).not.toThrow();
    });
  });

  describe('location builder', () => {
    it('renders location with required fields only', async () => {
      const builder = picker()
        .location()
        .input(z.object({ x: z.string() }))
        .latitude(37.7749)
        .longitude(-122.4194);
      const def = ch.finalize(builder, 'loc');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'location',
        to: '+1234567890',
        latitude: 37.7749,
        longitude: -122.4194,
      });
      expect(out).not.toHaveProperty('name');
      expect(out).not.toHaveProperty('address');
    });

    it('renders location with name and address', async () => {
      const builder = picker()
        .location()
        .input(z.object({ x: z.string() }))
        .latitude(37.7749)
        .longitude(-122.4194)
        .name('SF Office')
        .address('123 Market St, San Francisco, CA');
      const def = ch.finalize(builder, 'loc-full');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'location',
        to: '+1234567890',
        latitude: 37.7749,
        longitude: -122.4194,
        name: 'SF Office',
        address: '123 Market St, San Francisco, CA',
      });
    });

    it('renders location with name only', async () => {
      const builder = picker()
        .location()
        .input(z.object({ x: z.string() }))
        .latitude(40.7128)
        .longitude(-74.006)
        .name('NYC Office');
      const def = ch.finalize(builder, 'loc-name');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'location',
        to: '+1234567890',
        latitude: 40.7128,
        longitude: -74.006,
        name: 'NYC Office',
      });
      expect(out).not.toHaveProperty('address');
    });

    it('renders location with dynamic coordinates', async () => {
      const builder = picker()
        .location()
        .input(z.object({ lat: z.number(), lng: z.number() }))
        .latitude(({ input }) => input.lat)
        .longitude(({ input }) => input.lng);
      const def = ch.finalize(builder, 'loc-dyn');
      const out = await ch.render(
        def,
        { to: '+1234567890', input: { lat: 51.5074, lng: -0.1278 } },
        {},
      );
      expect(out).toEqual({
        action: 'location',
        to: '+1234567890',
        latitude: 51.5074,
        longitude: -0.1278,
      });
    });

    it('finalize throws when latitude is missing', () => {
      const builder = picker()
        .location()
        .input(z.object({ x: z.string() }))
        .longitude(-122.4194);
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: latitude/);
    });

    it('finalize throws when longitude is missing', () => {
      const builder = picker()
        .location()
        .input(z.object({ x: z.string() }))
        .latitude(37.7749);
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: longitude/);
    });
  });

  describe('reaction builder', () => {
    it('renders reaction with emoji and messageId from args', async () => {
      const builder = picker()
        .reaction()
        .input(z.object({ x: z.string() }))
        .emoji('👍');
      const def = ch.finalize(builder, 'react');
      const out = await ch.render(
        def,
        { to: '+1234567890', input: { x: 'val' }, messageId: 'wamid.abc123' },
        {},
      );
      expect(out).toEqual({
        action: 'reaction',
        to: '+1234567890',
        emoji: '👍',
        messageId: 'wamid.abc123',
      });
    });

    it('renders reaction with dynamic emoji', async () => {
      const builder = picker()
        .reaction()
        .input(z.object({ sentiment: z.string() }))
        .emoji(({ input }) => (input.sentiment === 'positive' ? '👍' : '👎'));
      const def = ch.finalize(builder, 'react-dyn');
      const out = await ch.render(
        def,
        { to: '+1234567890', input: { sentiment: 'positive' }, messageId: 'wamid.xyz' },
        {},
      );
      expect(out).toEqual({
        action: 'reaction',
        to: '+1234567890',
        emoji: '👍',
        messageId: 'wamid.xyz',
      });
    });

    it('finalize throws when emoji is missing', () => {
      const builder = picker()
        .reaction()
        .input(z.object({ x: z.string() }));
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: emoji/);
    });
  });

  describe('interactive builder', () => {
    it('renders interactive with body only', async () => {
      const builder = picker()
        .interactive()
        .input(z.object({ x: z.string() }))
        .body('Choose an option');
      const def = ch.finalize(builder, 'int');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'interactive',
        to: '+1234567890',
        body: 'Choose an option',
      });
      expect(out).not.toHaveProperty('header');
      expect(out).not.toHaveProperty('footer');
      expect(out).not.toHaveProperty('buttons');
      expect(out).not.toHaveProperty('sections');
    });

    it('renders interactive with buttons', async () => {
      const builder = picker()
        .interactive()
        .input(z.object({ x: z.string() }))
        .body('Pick one')
        .buttons([
          { id: 'yes', title: 'Yes' },
          { id: 'no', title: 'No' },
        ]);
      const def = ch.finalize(builder, 'int-btn');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'interactive',
        to: '+1234567890',
        body: 'Pick one',
        buttons: [
          { id: 'yes', title: 'Yes' },
          { id: 'no', title: 'No' },
        ],
      });
    });

    it('renders interactive with sections', async () => {
      const builder = picker()
        .interactive()
        .input(z.object({ x: z.string() }))
        .body('Browse')
        .sections([
          {
            title: 'Category A',
            rows: [
              { id: 'a1', title: 'Item A1', description: 'First item' },
              { id: 'a2', title: 'Item A2' },
            ],
          },
        ]);
      const def = ch.finalize(builder, 'int-sec');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'interactive',
        to: '+1234567890',
        body: 'Browse',
        sections: [
          {
            title: 'Category A',
            rows: [
              { id: 'a1', title: 'Item A1', description: 'First item' },
              { id: 'a2', title: 'Item A2' },
            ],
          },
        ],
      });
    });

    it('renders interactive with header and footer', async () => {
      const builder = picker()
        .interactive()
        .input(z.object({ x: z.string() }))
        .body('Content')
        .header('Welcome')
        .footer('Powered by BetterNotify');
      const def = ch.finalize(builder, 'int-hf');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'interactive',
        to: '+1234567890',
        body: 'Content',
        header: 'Welcome',
        footer: 'Powered by BetterNotify',
      });
    });

    it('renders interactive with all optional fields', async () => {
      const builder = picker()
        .interactive()
        .input(z.object({ x: z.string() }))
        .body('Full interactive')
        .header('Header')
        .footer('Footer')
        .buttons([{ id: 'ok', title: 'OK' }]);
      const def = ch.finalize(builder, 'int-all');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'interactive',
        to: '+1234567890',
        body: 'Full interactive',
        header: 'Header',
        footer: 'Footer',
        buttons: [{ id: 'ok', title: 'OK' }],
      });
    });

    it('finalize throws when body is missing', () => {
      const builder = picker()
        .interactive()
        .input(z.object({ x: z.string() }));
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: body/);
    });
  });

  describe('contacts builder', () => {
    it('renders contacts with minimal contact', async () => {
      const builder = picker()
        .contacts()
        .input(z.object({ x: z.string() }))
        .contacts([{ name: { formatted: 'John Doe' } }]);
      const def = ch.finalize(builder, 'ct');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'contacts',
        to: '+1234567890',
        contacts: [{ name: { formatted: 'John Doe' } }],
      });
    });

    it('renders contacts with full contact details', async () => {
      const builder = picker()
        .contacts()
        .input(z.object({ x: z.string() }))
        .contacts([
          {
            name: { formatted: 'Jane Doe', first: 'Jane', last: 'Doe' },
            phones: [{ phone: '+1234567890', type: 'MOBILE' }],
            emails: [{ email: 'jane@example.com', type: 'WORK' }],
          },
        ]);
      const def = ch.finalize(builder, 'ct-full');
      const out = await ch.render(def, { to: '+1234567890', input: { x: 'val' } }, {});
      expect(out).toEqual({
        action: 'contacts',
        to: '+1234567890',
        contacts: [
          {
            name: { formatted: 'Jane Doe', first: 'Jane', last: 'Doe' },
            phones: [{ phone: '+1234567890', type: 'MOBILE' }],
            emails: [{ email: 'jane@example.com', type: 'WORK' }],
          },
        ],
      });
    });

    it('renders contacts with dynamic resolver', async () => {
      const builder = picker()
        .contacts()
        .input(z.object({ contactName: z.string() }))
        .contacts(({ input }) => [{ name: { formatted: input.contactName } }]);
      const def = ch.finalize(builder, 'ct-dyn');
      const out = await ch.render(def, { to: '+1234567890', input: { contactName: 'Alice' } }, {});
      expect(out).toEqual({
        action: 'contacts',
        to: '+1234567890',
        contacts: [{ name: { formatted: 'Alice' } }],
      });
    });

    it('finalize throws when contacts is missing', () => {
      const builder = picker()
        .contacts()
        .input(z.object({ x: z.string() }));
      expect(() => ch.finalize(builder, 'r')).toThrow(/missing required slot: contacts/);
    });
  });

  describe('validateArgs', () => {
    it('accepts text args', () => {
      const result = ch.validateArgs({ to: '+1234567890', input: { msg: 'hello' } });
      expect(result).toMatchObject({ to: '+1234567890' });
    });

    it('accepts reaction args with messageId', () => {
      const result = ch.validateArgs({
        to: '+1234567890',
        messageId: 'wamid.abc',
        input: { x: 1 },
      });
      expect(result).toMatchObject({ to: '+1234567890', messageId: 'wamid.abc' });
    });

    it('accepts minimal args', () => {
      const result = ch.validateArgs({ to: '+1234567890', input: {} });
      expect(result).toMatchObject({ to: '+1234567890' });
    });

    it('rejects missing to', () => {
      expect(() => ch.validateArgs({ input: {} })).toThrow();
    });

    it('rejects empty to', () => {
      expect(() => ch.validateArgs({ to: '', input: {} })).toThrow();
    });

    it('rejects null args', () => {
      expect(() => ch.validateArgs(null)).toThrow();
    });
  });

  describe('middleware seeding', () => {
    it('seeds rootMiddleware into text builder', () => {
      const mw = async () => undefined as never;
      const p = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = p.text();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into image builder', () => {
      const mw = async () => undefined as never;
      const p = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = p.image();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into video builder', () => {
      const mw = async () => undefined as never;
      const p = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = p.video();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into document builder', () => {
      const mw = async () => undefined as never;
      const p = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = p.document();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into audio builder', () => {
      const mw = async () => undefined as never;
      const p = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = p.audio();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into location builder', () => {
      const mw = async () => undefined as never;
      const p = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = p.location();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into reaction builder', () => {
      const mw = async () => undefined as never;
      const p = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = p.reaction();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into interactive builder', () => {
      const mw = async () => undefined as never;
      const p = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = p.interactive();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });

    it('seeds rootMiddleware into contacts builder', () => {
      const mw = async () => undefined as never;
      const p = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
      const b = p.contacts();
      expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toContain(
        mw,
      );
    });
  });
});
