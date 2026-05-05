import { describe, expect, it } from 'vitest';
import { NotifyRpcError, NotifyRpcProviderError } from '@betternotify/core';
import { isMailchimpRetriable } from './is-retriable.js';

describe('isMailchimpRetriable', () => {
  it('returns true when NotifyRpcProviderError has retriable: true', () => {
    const err = new NotifyRpcProviderError({ message: 'timeout', provider: 'mailchimp', retriable: true });
    expect(isMailchimpRetriable(err)).toBe(true);
  });

  it('returns false when NotifyRpcProviderError has retriable: false', () => {
    const err = new NotifyRpcProviderError({ message: 'invalid key', provider: 'mailchimp', code: 'CONFIG', retriable: false });
    expect(isMailchimpRetriable(err)).toBe(false);
  });

  it('returns true for non-NotifyRpcProviderError errors', () => {
    expect(isMailchimpRetriable(new NotifyRpcError({ message: 'x' }))).toBe(true);
    expect(isMailchimpRetriable(new Error('random'))).toBe(true);
  });
});
