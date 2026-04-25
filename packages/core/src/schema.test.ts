import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { validate } from './schema.js';
import { EmailRpcValidationError } from './errors.js';

describe('validate', () => {
  it('returns the parsed value on success', async () => {
    const schema = z.object({ to: z.string().email(), name: z.string() });
    const value = await validate(schema, { to: 'user@example.com', name: 'Lucas' });
    expect(value).toEqual({ to: 'user@example.com', name: 'Lucas' });
  });

  it('applies schema defaults', async () => {
    const schema = z.object({ locale: z.enum(['en', 'pt-BR']).default('en') });
    const value = await validate(schema, {});
    expect(value).toEqual({ locale: 'en' });
  });

  it('throws EmailRpcValidationError with issues populated', async () => {
    const schema = z.object({ to: z.string().email() });
    await expect(validate(schema, { to: 'not-an-email' })).rejects.toMatchObject({
      name: 'EmailRpcValidationError',
      code: 'VALIDATION',
    });
    try {
      await validate(schema, { to: 'not-an-email' });
    } catch (err) {
      expect(err).toBeInstanceOf(EmailRpcValidationError);
      const e = err as EmailRpcValidationError;
      expect(e.issues.length).toBeGreaterThan(0);
      expect(e.issues[0]).toHaveProperty('message');
    }
  });

  it('attaches the route name to the error message when provided', async () => {
    const schema = z.object({ to: z.string().email() });
    await expect(validate(schema, { to: 'bad' }, { route: 'welcome' })).rejects.toThrow(
      /route "welcome"/,
    );
  });
});
