import { describe, expect, it } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';
import { isCloudflareEmailRetriable } from './is-retriable.js';

describe('isCloudflareEmailRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable: true', () => {
    const err = new NotifyRpcProviderError({
      message: 'timeout',
      code: 'TIMEOUT',
      provider: 'cloudflare-email',
      retriable: true,
    });
    expect(isCloudflareEmailRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable: false', () => {
    const err = new NotifyRpcProviderError({
      message: 'validation failed',
      code: 'VALIDATION',
      provider: 'cloudflare-email',
      retriable: false,
    });
    expect(isCloudflareEmailRetriable(err)).toBe(false);
  });

  it('returns true for non-provider errors', () => {
    const err = new Error('unknown');
    expect(isCloudflareEmailRetriable(err)).toBe(true);
  });
});
