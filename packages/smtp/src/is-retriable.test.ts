import { describe, expect, it } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';
import { isSmtpRetriable } from './is-retriable.js';

describe('isSmtpRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable=true', () => {
    const err = new NotifyRpcProviderError({
      message: 'Connection refused',
      provider: 'smtp',
      retriable: true,
    });
    expect(isSmtpRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable=false', () => {
    const err = new NotifyRpcProviderError({
      message: 'Invalid login',
      provider: 'smtp',
      code: 'CONFIG',
      retriable: false,
    });
    expect(isSmtpRetriable(err)).toBe(false);
  });

  it('returns true for unknown errors that are not NotifyRpcProviderError', () => {
    expect(isSmtpRetriable(new Error('random'))).toBe(true);
    expect(isSmtpRetriable('string error')).toBe(true);
    expect(isSmtpRetriable(null)).toBe(true);
  });
});
