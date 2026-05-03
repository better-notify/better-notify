import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { discordChannel } from './channel.js';

const buildBuilder = (ch: ReturnType<typeof discordChannel>) =>
  ch.createBuilder({ ctx: undefined, rootMiddleware: [] }).input(z.object({ name: z.string() }));

describe('discordChannel', () => {
  it('has name "discord"', () => {
    expect(discordChannel().name).toBe('discord');
  });

  it('createBuilder returns a builder with _channel="discord"', () => {
    const b = discordChannel().createBuilder({ ctx: undefined, rootMiddleware: [] });
    expect((b as unknown as { _channel: string })._channel).toBe('discord');
  });

  it('validateArgs accepts { input }', () => {
    const ch = discordChannel();
    expect(ch.validateArgs({ input: { x: 1 } })).toEqual({ input: { x: 1 } });
  });

  it('validateArgs rejects null', () => {
    const ch = discordChannel();
    expect(() => ch.validateArgs(null)).toThrow();
  });

  it('render returns { body } from a function body resolver', async () => {
    const ch = discordChannel();
    const builder = buildBuilder(ch).body(({ input }) => `Hi ${input.name}`);
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'Hi Lucas' });
  });

  it('renders a static body resolver (string form)', async () => {
    const ch = discordChannel();
    const builder = buildBuilder(ch).body('Static message');
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'Static message' });
  });

  it('render includes embeds when set', async () => {
    const ch = discordChannel();
    const embeds = [{ title: 'Deploy', description: 'v2.0', color: 0x00ff00 }];
    const builder = buildBuilder(ch).body('deployed').embeds(() => embeds);
    const def = ch.finalize(builder, 'deploy');
    const out = await ch.render(def, { input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'deployed', embeds });
  });

  it('render includes username when set', async () => {
    const ch = discordChannel();
    const builder = buildBuilder(ch).body('hi').username(() => 'Bot');
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'hi', username: 'Bot' });
  });

  it('render includes avatarUrl when set', async () => {
    const ch = discordChannel();
    const builder = buildBuilder(ch).body('hi').avatarUrl(() => 'https://img.png');
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'hi', avatarUrl: 'https://img.png' });
  });

  it('omits optional fields when not set', async () => {
    const ch = discordChannel();
    const builder = buildBuilder(ch).body('plain');
    const def = ch.finalize(builder, 'greet');
    const out = await ch.render(def, { input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'plain' });
    expect(out).not.toHaveProperty('embeds');
    expect(out).not.toHaveProperty('username');
    expect(out).not.toHaveProperty('avatarUrl');
  });

  it('render includes attachments when set', async () => {
    const ch = discordChannel();
    const attachments = [{ filename: 'test.pdf', content: Buffer.from('pdf'), contentType: 'application/pdf' }];
    const builder = buildBuilder(ch).body('check this').attachments(() => attachments);
    const def = ch.finalize(builder, 'upload');
    const out = await ch.render(def, { input: { name: 'Lucas' } }, {});
    expect(out).toEqual({ body: 'check this', attachments });
  });

  it('finalize throws when body is missing', () => {
    const ch = discordChannel();
    const partial = buildBuilder(ch);
    expect(() => ch.finalize(partial, 'r')).toThrow(/missing required slot: body/);
  });
});
