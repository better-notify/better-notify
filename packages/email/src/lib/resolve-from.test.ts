import { describe, expect, it } from 'vitest';
import { EmailRpcError } from '@emailrpc/core';
import { resolveFrom } from './resolve-from.js';

describe('resolveFrom', () => {
  it('returns per-email address when set', () => {
    expect(resolveFrom('a@b.com', undefined)).toEqual({ email: 'a@b.com' });
  });

  it('falls back to defaults when per-email is missing', () => {
    expect(resolveFrom(undefined, 'd@b.com')).toEqual({ email: 'd@b.com' });
  });

  it('merges name from defaults when per-email lacks one', () => {
    expect(resolveFrom({ email: 'a@b.com' }, { name: 'D', email: 'x@b.com' })).toEqual({
      name: 'D',
      email: 'a@b.com',
    });
  });

  it('throws VALIDATION when no email is resolvable', () => {
    expect(() => resolveFrom(undefined, undefined)).toThrow(EmailRpcError);
  });

  it('embeds route into the error message when route is provided', () => {
    try {
      resolveFrom(undefined, undefined, 'welcome');
      throw new Error('expected to throw');
    } catch (err) {
      expect((err as EmailRpcError).message).toContain('welcome');
      expect((err as EmailRpcError).route).toBe('welcome');
    }
  });
});
