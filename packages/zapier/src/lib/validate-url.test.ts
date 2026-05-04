import { describe, expect, it } from 'vitest';
import { NotifyRpcError } from '@betternotify/core';
import { validateWebhookUrl } from './validate-url.js';

describe('validateWebhookUrl', () => {
  it('accepts a valid HTTPS URL', () => {
    expect(() => validateWebhookUrl('https://hooks.zapier.com/hooks/catch/123/abc')).not.toThrow();
  });

  it('accepts non-zapier HTTPS URLs', () => {
    expect(() => validateWebhookUrl('https://custom-proxy.example.com/webhook')).not.toThrow();
  });

  it('throws CONFIG for HTTP (non-HTTPS) URL', () => {
    expect(() => validateWebhookUrl('http://hooks.zapier.com/hooks/catch/123/abc')).toThrow(
      NotifyRpcError,
    );
  });

  it('throws CONFIG for malformed URL', () => {
    expect(() => validateWebhookUrl('not-a-url')).toThrow(NotifyRpcError);
  });

  it('throws CONFIG for empty string', () => {
    expect(() => validateWebhookUrl('')).toThrow(NotifyRpcError);
  });

  it('thrown error has code CONFIG', () => {
    try {
      validateWebhookUrl('http://insecure.com');
    } catch (err) {
      expect((err as NotifyRpcError).code).toBe('CONFIG');
      return;
    }
    throw new Error('should have thrown');
  });
});
