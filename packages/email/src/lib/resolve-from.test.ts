import { describe, expect, it } from 'vitest';
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

  it('returns undefined when no email is resolvable', () => {
    expect(resolveFrom(undefined, undefined)).toBeUndefined();
  });

  it('returns undefined when both inputs lack an email field', () => {
    expect(resolveFrom({ name: 'A' }, { name: 'B' })).toBeUndefined();
  });
});
