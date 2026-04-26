import { describe, expect, it } from 'vitest';
import { sesTransport, sesAdapter } from './index.js';

describe('@emailrpc/ses (stub)', () => {
  it('sesTransport() throws not-implemented', () => {
    expect(() => sesTransport({ region: 'eu-west-1' })).toThrow(/not implemented/);
  });

  it('sesAdapter() throws not-implemented', () => {
    expect(() => sesAdapter()).toThrow(/not implemented/);
  });
});
