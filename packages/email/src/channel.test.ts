import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { emailChannel } from './channel.js';

const schema = z.object({ name: z.string() });

const makeBuilder = (ch: ReturnType<typeof emailChannel>) =>
  ch.createBuilder({ ctx: undefined, rootMiddleware: [] })
    .input(schema)
    .subject(({ input }) => `Hi ${input.name}`)
    .template(({ input }) => ({ html: `<p>${input.name}</p>`, text: `Hi ${input.name}` }));

describe('emailChannel', () => {
  it('returns a Channel<"email", ...> implementation', () => {
    const ch = emailChannel();
    expect(ch.name).toBe('email');
    expect(typeof ch.createBuilder).toBe('function');
    expect(typeof ch.validateArgs).toBe('function');
    expect(typeof ch.render).toBe('function');
    expect(typeof ch.finalize).toBe('function');
  });

  it('createBuilder returns a builder with _channel="email"', () => {
    const ch = emailChannel();
    const builder = ch.createBuilder({ ctx: undefined, rootMiddleware: [] });
    expect((builder as { _channel: string })._channel).toBe('email');
  });

  it('finalize on a complete builder produces a ChannelDefinition tagged "email"', () => {
    const ch = emailChannel();
    const builder = ch.createBuilder({ ctx: undefined, rootMiddleware: [] })
      .input(schema)
      .subject(({ input }) => `Hi ${input.name}`)
      .template(({ input }) => ({ html: `<p>${input.name}</p>` }));
    const def = ch.finalize(builder, 'welcome');
    expect(def.channel).toBe('email');
    expect(def.id).toBe('welcome');
  });

  it('validateArgs requires `to`', async () => {
    const ch = emailChannel();
    expect(() => ch.validateArgs({ input: {} } as any)).toThrow();
    const validated = await ch.validateArgs({ to: 'a@b.com', input: { x: 1 } } as any);
    expect(validated.to).toBe('a@b.com');
  });

  it('render returns html, text, subject from a complete definition', async () => {
    const ch = emailChannel({ defaults: { from: 'sender@example.com' } });
    const def = ch.finalize(makeBuilder(ch), 'welcome');
    const rendered = await ch.render(def, { to: 'a@b.com', input: { name: 'Lucas' } } as any, {});
    expect(rendered.html).toBe('<p>Lucas</p>');
    expect(rendered.text).toBe('Hi Lucas');
    expect(rendered.subject).toBe('Hi Lucas');
    expect(rendered.to).toEqual(['a@b.com']);
  });

  it('render resolves from from channel defaults when neither builder nor args provide it', async () => {
    const ch = emailChannel({ defaults: { from: 'default@example.com' } });
    const def = ch.finalize(makeBuilder(ch), 'welcome');
    const rendered = await ch.render(def, { to: 'a@b.com', input: { name: 'Lucas' } } as any, {});
    expect(rendered.from).toEqual({ email: 'default@example.com' });
  });

  it('per-call args.from overrides builder runtime and defaults', async () => {
    const ch = emailChannel({ defaults: { from: 'default@example.com' } });
    const def = ch.finalize(makeBuilder(ch).from('builder@example.com'), 'welcome');
    const rendered = await ch.render(
      def,
      { to: 'a@b.com', from: 'perCall@example.com', input: { name: 'Lucas' } } as any,
      {},
    );
    expect(rendered.from).toEqual({ email: 'perCall@example.com' });
  });

  it('per-call args.from merges name from defaults when args only provide email via object', async () => {
    const ch = emailChannel({ defaults: { from: { name: 'Default Name', email: 'default@example.com' } } });
    const def = ch.finalize(makeBuilder(ch), 'welcome');
    const rendered = await ch.render(
      def,
      { to: 'a@b.com', from: { email: 'override@example.com' }, input: { name: 'Lucas' } } as any,
      {},
    );
    expect((rendered.from as { email: string; name?: string }).email).toBe('override@example.com');
  });

  it('replyTo falls back through args → runtime → defaults', async () => {
    const ch = emailChannel({ defaults: { from: 'sender@example.com', replyTo: { email: 'defaults-reply@example.com' } } });
    const builder = makeBuilder(ch);
    const def = ch.finalize(builder, 'welcome');

    const withDefault = await ch.render(def, { to: 'a@b.com', input: { name: 'Lucas' } } as any, {});
    expect(withDefault.replyTo).toEqual({ email: 'defaults-reply@example.com' });

    const builderWithReplyTo = makeBuilder(ch).replyTo({ email: 'runtime-reply@example.com' });
    const defWithRuntime = ch.finalize(builderWithReplyTo, 'welcome2');
    const withRuntime = await ch.render(defWithRuntime, { to: 'a@b.com', input: { name: 'Lucas' } } as any, {});
    expect(withRuntime.replyTo).toEqual({ email: 'runtime-reply@example.com' });

    const withArgs = await ch.render(
      defWithRuntime,
      { to: 'a@b.com', replyTo: { email: 'args-reply@example.com' }, input: { name: 'Lucas' } } as any,
      {},
    );
    expect(withArgs.replyTo).toEqual({ email: 'args-reply@example.com' });
  });

  it('headers from defaults + args merge correctly (args wins on conflicts)', async () => {
    const ch = emailChannel({
      defaults: {
        from: 'sender@example.com',
        headers: { 'X-Default': 'default', 'X-Shared': 'default-shared' },
      },
    });
    const def = ch.finalize(makeBuilder(ch), 'welcome');
    const rendered = await ch.render(
      def,
      { to: 'a@b.com', headers: { 'X-Shared': 'args-wins', 'X-Custom': 'custom' }, input: { name: 'Lucas' } } as any,
      {},
    );
    expect(rendered.headers).toEqual({
      'X-Default': 'default',
      'X-Shared': 'args-wins',
      'X-Custom': 'custom',
    });
  });

  it('tags and priority from builder runtime appear in output', async () => {
    const ch = emailChannel({ defaults: { from: 'sender@example.com' } });
    const def = ch.finalize(
      makeBuilder(ch).tags({ category: 'transactional' }).priority('high'),
      'welcome',
    );
    const rendered = await ch.render(def, { to: 'a@b.com', input: { name: 'Lucas' } } as any, {});
    expect(rendered.tags).toEqual({ category: 'transactional' });
    expect(rendered.priority).toBe('high');
  });

  it('render throws if no from email is provided by any source', async () => {
    const ch = emailChannel();
    const def = ch.finalize(makeBuilder(ch), 'welcome');
    await expect(
      ch.render(def, { to: 'a@b.com', input: { name: 'Lucas' } } as any, {}),
    ).rejects.toThrow('No "from" email');
  });

  it('render produces a complete RenderedMessage with all expected fields populated', async () => {
    const ch = emailChannel({
      defaults: {
        from: { name: 'Sender', email: 'sender@example.com' },
        replyTo: { email: 'reply@example.com' },
        headers: { 'X-Default': 'yes' },
      },
    });
    const def = ch.finalize(
      makeBuilder(ch).tags({ env: 'test' }).priority('low'),
      'welcome',
    );
    const rendered = await ch.render(
      def,
      {
        to: ['a@b.com', { name: 'Bob', email: 'bob@b.com' }],
        cc: 'cc@b.com',
        bcc: { email: 'bcc@b.com' },
        headers: { 'X-Custom': 'value' },
        input: { name: 'Alice' },
      } as any,
      {},
    );

    expect(rendered.from).toEqual({ name: 'Sender', email: 'sender@example.com' });
    expect(rendered.to).toEqual(['a@b.com', { name: 'Bob', email: 'bob@b.com' }]);
    expect(rendered.cc).toEqual(['cc@b.com']);
    expect(rendered.bcc).toEqual([{ email: 'bcc@b.com' }]);
    expect(rendered.replyTo).toEqual({ email: 'reply@example.com' });
    expect(rendered.subject).toBe('Hi Alice');
    expect(rendered.html).toBe('<p>Alice</p>');
    expect(rendered.text).toBe('Hi Alice');
    expect(rendered.headers).toEqual({ 'X-Default': 'yes', 'X-Custom': 'value' });
    expect(rendered.tags).toEqual({ env: 'test' });
    expect(rendered.priority).toBe('low');
  });

  it('createBuilder seeds rootMiddleware when provided', () => {
    const ch = emailChannel();
    const mw = async () => undefined as never;
    const builder = ch.createBuilder({ ctx: undefined, rootMiddleware: [mw as never] });
    expect((builder as unknown as { _state: { middleware: unknown[] } })._state.middleware).toEqual([mw]);
  });

  it('validateArgs rejects non-object args', () => {
    const ch = emailChannel();
    expect(() => ch.validateArgs(null)).toThrow(/must be an object/);
    expect(() => ch.validateArgs('string' as unknown)).toThrow(/must be an object/);
  });

  it('email package _finalize throws when builder is incomplete', () => {
    const ch = emailChannel();
    const builder = ch.createBuilder({ ctx: undefined, rootMiddleware: [] }) as unknown as {
      input: (s: unknown) => { _finalize: (id: string) => unknown };
    };
    const partial = builder.input(z.object({ name: z.string() }));
    expect(() => partial._finalize('x')).toThrow(/missing required slot/);
  });
});
