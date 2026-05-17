import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { toMcpInputSchema } from './to-mcp-input-schema.js';

describe('toMcpInputSchema', () => {
  it('returns Zod object schemas (with _def)', () => {
    const schema = z.object({ name: z.string() });
    expect(toMcpInputSchema(schema)).toBe(schema);
  });

  it('returns schemas with _zod marker (zod v4 style)', () => {
    const schema = { _zod: {}, foo: 'bar' };
    expect(toMcpInputSchema(schema)).toBe(schema);
  });

  it('returns schemas with parse + safeParse methods', () => {
    const schema = { parse: () => null, safeParse: () => ({ success: true }) };
    expect(toMcpInputSchema(schema)).toBe(schema);
  });

  it('returns undefined for null', () => {
    expect(toMcpInputSchema(null)).toBeUndefined();
  });

  it('returns undefined for primitive values', () => {
    expect(toMcpInputSchema('string')).toBeUndefined();
    expect(toMcpInputSchema(42)).toBeUndefined();
    expect(toMcpInputSchema(undefined)).toBeUndefined();
  });

  it('returns undefined for objects without Zod markers', () => {
    expect(toMcpInputSchema({ kind: 'valibot' })).toBeUndefined();
    expect(toMcpInputSchema({ '~standard': { vendor: 'valibot' } })).toBeUndefined();
  });

  it('returns undefined for objects with parse but no safeParse', () => {
    expect(toMcpInputSchema({ parse: () => null })).toBeUndefined();
  });
});
