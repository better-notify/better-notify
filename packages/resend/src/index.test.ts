import { describe, expect, it } from 'vitest';
import { resend, resendAdapter } from './index.js';

describe('@emailrpc/resend (stub)', () => {
  it('resend() throws not-implemented', () => {
    expect(() => resend({ apiKey: 'fake' })).toThrow(/not implemented/);
  });

  it('resendAdapter() throws not-implemented', () => {
    expect(() => resendAdapter()).toThrow(/not implemented/);
  });
});
