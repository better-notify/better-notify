import { describe, expect, it } from 'vitest';
import { NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { isAutosendRetriable } from './is-retriable.js';

describe('isAutosendRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable: true', () => {
    const err = new NotifyRpcProviderError({
      message: 'timeout',
      provider: 'autosend',
      retriable: true,
    });
    expect(isAutosendRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable: false', () => {
    const err = new NotifyRpcProviderError({
      message: 'invalid key',
      provider: 'autosend',
      code: 'CONFIG',
      retriable: false,
    });
    expect(isAutosendRetriable(err)).toBe(false);
  });

  it('returns true for non-NotifyRpcProviderError errors', () => {
    expect(isAutosendRetriable(new NotifyRpcError({ message: 'x' }))).toBe(true);
    expect(isAutosendRetriable(new Error('random'))).toBe(true);
  });
});
