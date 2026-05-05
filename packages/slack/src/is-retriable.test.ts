import { describe, expect, it } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';
import { isSlackRetriable } from './is-retriable.js';

describe('isSlackRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable: true', () => {
    const err = new NotifyRpcProviderError({
      message: 'timeout',
      provider: 'slack',
      retriable: true,
    });
    expect(isSlackRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable: false', () => {
    const err = new NotifyRpcProviderError({
      message: 'invalid auth',
      provider: 'slack',
      code: 'CONFIG',
      retriable: false,
    });
    expect(isSlackRetriable(err)).toBe(false);
  });

  it('returns true for non-NotifyRpcProviderError errors', () => {
    expect(isSlackRetriable(new Error('random'))).toBe(true);
    expect(isSlackRetriable('string error')).toBe(true);
    expect(isSlackRetriable(null)).toBe(true);
  });
});
