import { describe, expect, it } from 'vitest';
import { NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { isSelligentRetriable } from './is-retriable.js';

describe('isSelligentRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable: true', () => {
    const err = new NotifyRpcProviderError({
      message: 'timeout',
      provider: 'selligent',
      retriable: true,
    });
    expect(isSelligentRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable: false', () => {
    const err = new NotifyRpcProviderError({
      message: 'invalid key',
      provider: 'selligent',
      code: 'CONFIG',
      retriable: false,
    });
    expect(isSelligentRetriable(err)).toBe(false);
  });

  it('returns true for non-NotifyRpcProviderError errors', () => {
    expect(isSelligentRetriable(new NotifyRpcError({ message: 'x' }))).toBe(true);
    expect(isSelligentRetriable(new Error('random'))).toBe(true);
  });
});
