import { describe, expect, it } from 'vitest';
import { NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { isResendRetriable } from './is-retriable.js';

describe('isResendRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable: true', () => {
    const err = new NotifyRpcProviderError({
      message: 'timeout',
      provider: 'resend',
      retriable: true,
    });
    expect(isResendRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable: false', () => {
    const err = new NotifyRpcProviderError({
      message: 'invalid',
      provider: 'resend',
      code: 'VALIDATION',
      retriable: false,
    });
    expect(isResendRetriable(err)).toBe(false);
  });

  it('returns true for non-NotifyRpcProviderError errors', () => {
    expect(isResendRetriable(new NotifyRpcError({ message: 'x' }))).toBe(true);
    expect(isResendRetriable(new Error('random'))).toBe(true);
  });
});
