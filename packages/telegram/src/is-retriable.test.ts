import { describe, expect, it } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';
import { isTelegramRetriable } from './is-retriable.js';

describe('isTelegramRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable: true', () => {
    const err = new NotifyRpcProviderError({
      message: 'timeout',
      provider: 'telegram',
      retriable: true,
    });
    expect(isTelegramRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable: false', () => {
    const err = new NotifyRpcProviderError({
      message: 'bad request',
      provider: 'telegram',
      retriable: false,
    });
    expect(isTelegramRetriable(err)).toBe(false);
  });

  it('returns true for unknown errors', () => {
    expect(isTelegramRetriable(new Error('random'))).toBe(true);
    expect(isTelegramRetriable('string error')).toBe(true);
    expect(isTelegramRetriable(null)).toBe(true);
  });
});
