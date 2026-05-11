import { describe, expect, it } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';

describe('isOneSignalRetriable', () => {
  it('returns retriable from NotifyRpcProviderError when retriable is true', async () => {
    const { isOneSignalRetriable } = await import('./is-retriable.js');
    const err = new NotifyRpcProviderError({
      message: 'err',
      code: 'PROVIDER',
      provider: 'onesignal',
      retriable: true,
    });
    expect(isOneSignalRetriable(err)).toBe(true);
  });

  it('returns retriable from NotifyRpcProviderError when retriable is false', async () => {
    const { isOneSignalRetriable } = await import('./is-retriable.js');
    const err = new NotifyRpcProviderError({
      message: 'err',
      code: 'CONFIG',
      provider: 'onesignal',
      retriable: false,
    });
    expect(isOneSignalRetriable(err)).toBe(false);
  });

  it('returns false for unknown errors', async () => {
    const { isOneSignalRetriable } = await import('./is-retriable.js');
    expect(isOneSignalRetriable(new Error('unknown'))).toBe(false);
    expect(isOneSignalRetriable('string error')).toBe(false);
    expect(isOneSignalRetriable(null)).toBe(false);
  });
});
