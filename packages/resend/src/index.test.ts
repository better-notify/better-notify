import { describe, expect, it } from 'vitest';
import { resendTransport, resendAdapter } from './index.js';

describe('@betternotify/resend (stub)', () => {
  it('resendTransport() throws not-implemented', () => {
    expect(() => resendTransport({ apiKey: 'fake' })).toThrow(/not implemented/);
  });

  it('resendAdapter() throws not-implemented', () => {
    expect(() => resendAdapter()).toThrow(/not implemented/);
  });
});
