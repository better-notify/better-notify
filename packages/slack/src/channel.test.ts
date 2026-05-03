import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { slackChannel } from './channel.js';

const buildBuilder = (ch: ReturnType<typeof slackChannel>) =>
  ch.createBuilder({ ctx: undefined, rootMiddleware: [] }).input(z.object({ name: z.string() }));

describe('slackChannel', () => {
  it('has name "slack"', () => {
    expect(slackChannel().name).toBe('slack');
  });

  it('createBuilder returns a builder with _channel="slack"', () => {
    const b = slackChannel().createBuilder({ ctx: undefined, rootMiddleware: [] });
    expect((b as unknown as { _channel: string })._channel).toBe('slack');
  });

  it('validateArgs rejects empty to string', () => {
    const ch = slackChannel();
    expect(() => ch.validateArgs({ to: '' })).toThrow();
  });

  it('validateArgs accepts missing to (for defaultChannel fallback)', () => {
    const ch = slackChannel();
    expect(ch.validateArgs({ input: { x: 1 } })).toEqual({ input: { x: 1 } });
  });

  it('validateArgs rejects null args', () => {
    const ch = slackChannel();
    expect(() => ch.validateArgs(null)).toThrow();
  });

  it('validateArgs accepts string to', () => {
    const ch = slackChannel();
    expect(ch.validateArgs({ to: '#general', input: { x: 1 } })).toEqual({
      to: '#general',
      input: { x: 1 },
    });
  });

  it('validateArgs accepts threadTs', () => {
    const ch = slackChannel();
    expect(ch.validateArgs({ to: '#general', threadTs: '1234.5678', input: {} })).toEqual({
      to: '#general',
      threadTs: '1234.5678',
      input: {},
    });
  });

  it('render returns { text, to } from a function text resolver', async () => {
    const ch = slackChannel();
    const builder = buildBuilder(ch).text(({ input }) => `Hi ${(input as { name: string }).name}`);
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: '#general', input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ text: 'Hi Lucas', to: '#general' });
  });

  it('renders a static text resolver (string form)', async () => {
    const ch = slackChannel();
    const builder = buildBuilder(ch).text('Static message');
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: '#alerts', input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ text: 'Static message', to: '#alerts' });
  });

  it('render includes blocks when set', async () => {
    const ch = slackChannel();
    const builder = buildBuilder(ch)
      .text('fallback')
      .blocks(({ input }) => [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*${(input as { name: string }).name}*` },
        },
      ]);
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { to: '#general', input: { name: 'Lucas' } }, {});
    expect(out).toEqual({
      text: 'fallback',
      to: '#general',
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*Lucas*' } }],
    });
  });

  it('render includes threadTs from args', async () => {
    const ch = slackChannel();
    const builder = buildBuilder(ch).text('reply');
    const def = ch.finalize(builder, 'reply');
    const out = await ch.render(
      def,
      { to: '#general', threadTs: '1111.2222', input: { name: 'X' } },
      {},
    );
    expect(out).toEqual({ text: 'reply', to: '#general', threadTs: '1111.2222' });
  });

  it('render includes file when set', async () => {
    const ch = slackChannel();
    const fileData = Buffer.from('hello');
    const builder = buildBuilder(ch)
      .text('see attached')
      .file(() => ({ data: fileData, filename: 'test.txt', title: 'Test File' }));
    const def = ch.finalize(builder, 'upload');
    const out = await ch.render(def, { to: '#docs', input: { name: 'X' } }, {});
    expect(out).toEqual({
      text: 'see attached',
      to: '#docs',
      file: { data: fileData, filename: 'test.txt', title: 'Test File' },
    });
  });

  it('finalize throws when text is missing', () => {
    const ch = slackChannel();
    const partial = buildBuilder(ch);
    expect(() => ch.finalize(partial, 'r')).toThrow(/missing required slot: text/);
  });

  it('createBuilder seeds rootMiddleware when provided', () => {
    const ch = slackChannel();
    const mw = async () => undefined as never;
    const b = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
    expect((b as unknown as { _state: { middleware: unknown[] } })._state.middleware).toEqual([mw]);
  });
});
