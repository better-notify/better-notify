import { describe, expect, it } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';
import { isZapierRetriable } from './is-retriable.js';

describe('isZapierRetriable', () => {
  it('returns true when provider error has retriable: true', () => {
    const err = new NotifyRpcProviderError({
      message: 'Zapier: network error',
      code: 'PROVIDER',
      provider: 'zapier',
      retriable: true,
    });

    expect(isZapierRetriable(err)).toBe(true);
  });

  it('returns false when provider error has retriable: false', () => {
    const err = new NotifyRpcProviderError({
      message: 'Zapier: webhook URL expired or deleted',
      code: 'CONFIG',
      provider: 'zapier',
      httpStatus: 410,
      retriable: false,
    });

    expect(isZapierRetriable(err)).toBe(false);
  });

  it('returns true for non-NotifyRpcProviderError values', () => {
    expect(isZapierRetriable(new Error('random'))).toBe(true);
    expect(isZapierRetriable('string error')).toBe(true);
    expect(isZapierRetriable(null)).toBe(true);
  });
});
