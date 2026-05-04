import { describe, expect, it } from 'vitest';
import { NotifyRpcError, NotifyRpcProviderError } from '../errors.js';
import { isProviderRetriable } from './is-provider-retriable.js';

describe('isProviderRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable: true', () => {
    const err = new NotifyRpcProviderError({
      message: 'timeout',
      provider: 'resend',
      retriable: true,
    });
    expect(isProviderRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable: false', () => {
    const err = new NotifyRpcProviderError({
      message: 'invalid auth',
      provider: 'slack',
      code: 'CONFIG',
      retriable: false,
    });
    expect(isProviderRetriable(err)).toBe(false);
  });

  it('returns true for non-NotifyRpcProviderError errors', () => {
    const err = new NotifyRpcError({ message: 'unknown', code: 'UNKNOWN' });
    expect(isProviderRetriable(err)).toBe(true);
  });

  it('returns true for plain Error', () => {
    expect(isProviderRetriable(new Error('random'))).toBe(true);
  });

  it('returns true for non-error values', () => {
    expect(isProviderRetriable('string error')).toBe(true);
    expect(isProviderRetriable(null)).toBe(true);
    expect(isProviderRetriable(undefined)).toBe(true);
  });
});
