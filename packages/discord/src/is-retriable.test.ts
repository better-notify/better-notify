import { describe, expect, it } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';
import { isDiscordRetriable } from './is-retriable.js';

describe('isDiscordRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable: true', () => {
    const err = new NotifyRpcProviderError({
      message: 'rate limited',
      provider: 'discord',
      code: 'RATE_LIMITED',
      retriable: true,
    });
    expect(isDiscordRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable: false', () => {
    const err = new NotifyRpcProviderError({
      message: 'invalid webhook',
      provider: 'discord',
      code: 'CONFIG',
      retriable: false,
    });
    expect(isDiscordRetriable(err)).toBe(false);
  });

  it('returns true for non-NotifyRpcProviderError errors', () => {
    expect(isDiscordRetriable(new Error('random'))).toBe(true);
    expect(isDiscordRetriable('string error')).toBe(true);
    expect(isDiscordRetriable(null)).toBe(true);
  });
});
