import { describe, expect, it } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';
import { isGithubRetriable } from './is-retriable.js';

describe('isGithubRetriable', () => {
  it('returns retriable from NotifyRpcProviderError', () => {
    const retriable = new NotifyRpcProviderError({
      message: 'timeout',
      code: 'TIMEOUT',
      provider: 'github',
      retriable: true,
    });
    expect(isGithubRetriable(retriable)).toBe(true);
  });

  it('returns false for non-retriable NotifyRpcProviderError', () => {
    const nonRetriable = new NotifyRpcProviderError({
      message: 'bad auth',
      code: 'CONFIG',
      provider: 'github',
      retriable: false,
    });
    expect(isGithubRetriable(nonRetriable)).toBe(false);
  });

  it('returns false for unknown errors', () => {
    expect(isGithubRetriable(new Error('something'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isGithubRetriable('string error')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGithubRetriable(null)).toBe(false);
  });
});
