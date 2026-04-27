import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createPushBuilder } from './builder.js';

describe('PushBuilder', () => {
  it('produces a ChannelDefinition with channel="push", id, and runtime fields', () => {
    const b = createPushBuilder<unknown>({})
      .input(z.object({ name: z.string() }))
      .title(({ input }) => `Hello ${input.name}`)
      .body(({ input }) => `Welcome ${input.name}`);
    const def = b._finalize('greet');
    expect(def.channel).toBe('push');
    expect(def.id).toBe('greet');
    const runtime = def.runtime as { title: unknown; body: unknown };
    expect(runtime.title).toBeTypeOf('function');
    expect(runtime.body).toBeTypeOf('function');
  });

  it('throws on _finalize when body is missing', () => {
    const b = createPushBuilder<unknown>({})
      .input(z.object({ name: z.string() }))
      .title('Hello');
    expect(() => b._finalize('greet')).toThrow(/incomplete/);
  });

  it('throws on _finalize when input is missing', () => {
    const b = createPushBuilder<unknown>({});
    const partial = b as unknown as {
      title: (r: string) => { body: (r: string) => { _finalize: (id: string) => unknown } };
    };
    const stage = partial.title('Hello').body('World');
    expect(() => stage._finalize('greet')).toThrow(/incomplete/);
  });
});
