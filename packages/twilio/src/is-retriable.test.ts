import { describe, expect, it } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';
import { isTwilioRetriable } from './is-retriable.js';

describe('isTwilioRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable: true', () => {
    const err = new NotifyRpcProviderError({
      message: 'timeout',
      provider: 'twilio',
      code: 'TIMEOUT',
      retriable: true,
    });
    expect(isTwilioRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable: false', () => {
    const err = new NotifyRpcProviderError({
      message: 'bad config',
      provider: 'twilio',
      code: 'CONFIG',
      retriable: false,
    });
    expect(isTwilioRetriable(err)).toBe(false);
  });

  it('returns true for non-NotifyRpcProviderError values', () => {
    expect(isTwilioRetriable(new Error('random'))).toBe(true);
    expect(isTwilioRetriable('string error')).toBe(true);
    expect(isTwilioRetriable(null)).toBe(true);
  });
});
