import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createSmsBuilder } from './builder.js';

describe('SmsBuilder', () => {
  it('produces a ChannelDefinition with channel="sms", id, and runtime.body', () => {
    const b = createSmsBuilder<unknown>({})
      .input(z.object({ name: z.string() }))
      .body(({ input }) => `Hi ${input.name}`);
    const def = b._finalize('greet');
    expect(def.channel).toBe('sms');
    expect(def.id).toBe('greet');
    const runtime = def.runtime as { body: unknown };
    expect(runtime.body).toBeTypeOf('function');
  });

  it('throws on _finalize when body is missing', () => {
    const b = createSmsBuilder<unknown>({}).input(z.object({ name: z.string() }));
    expect(() => b._finalize('greet')).toThrow(/incomplete/);
  });

  it('throws on _finalize when input is missing', () => {
    const b = createSmsBuilder<unknown>({});
    const partial = b as unknown as {
      body: (r: string) => { _finalize: (id: string) => unknown };
    };
    const stage = partial.body('hello');
    expect(() => stage._finalize('greet')).toThrow(/incomplete/);
  });

  it('use() appends middleware', () => {
    const b = createSmsBuilder<unknown>({});
    const mw = (async ({ next }: { next: () => Promise<unknown> }) => next()) as never;
    const b2 = b.use(mw);
    expect(b2).not.toBe(b);
    expect(
      (b2 as unknown as { _state: { middleware: unknown[] } })._state.middleware,
    ).toEqual([mw]);
  });
});
