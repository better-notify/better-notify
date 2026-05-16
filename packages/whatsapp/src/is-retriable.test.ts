import { describe, expect, it } from 'vitest';
import { NotifyRpcProviderError } from '@betternotify/core';
import { isWhatsappRetriable } from './is-retriable.js';

describe('isWhatsappRetriable', () => {
  it('returns retriable from NotifyRpcProviderError when true', () => {
    const err = new NotifyRpcProviderError({
      message: 'rate limited',
      code: 'PROVIDER',
      provider: 'whatsapp-meta',
      retriable: true,
    });
    expect(isWhatsappRetriable(err)).toBe(true);
  });

  it('returns retriable from NotifyRpcProviderError when false', () => {
    const err = new NotifyRpcProviderError({
      message: 'bad config',
      code: 'CONFIG',
      provider: 'whatsapp-meta',
      retriable: false,
    });
    expect(isWhatsappRetriable(err)).toBe(false);
  });

  it('returns true for non-NotifyRpcProviderError errors', () => {
    expect(isWhatsappRetriable(new Error('random'))).toBe(true);
  });

  it('returns true for non-error values', () => {
    expect(isWhatsappRetriable('string')).toBe(true);
  });
});
