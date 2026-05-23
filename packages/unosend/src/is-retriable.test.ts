import { describe, expect, it } from 'vitest';
import { NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { isUnosendRetriable } from './is-retriable.js';

describe('isUnosendRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable: true', () => {
    const err = new NotifyRpcProviderError({
      message: 'timeout',
      provider: 'unosend',
      retriable: true,
    });
    expect(isUnosendRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable: false', () => {
    const err = new NotifyRpcProviderError({
      message: 'invalid',
      provider: 'unosend',
      code: 'VALIDATION',
      retriable: false,
    });
    expect(isUnosendRetriable(err)).toBe(false);
  });

  it('returns true for non-NotifyRpcProviderError errors', () => {
    expect(isUnosendRetriable(new NotifyRpcError({ message: 'x' }))).toBe(true);
    expect(isUnosendRetriable(new Error('random'))).toBe(true);
  });
});
