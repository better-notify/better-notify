import { describe, expect, it } from 'vitest';
import { multi, smtp } from './provider.js';
import { EmailRpcNotImplementedError } from './errors.js';

describe('provider stubs', () => {
  it('smtp() throws EmailRpcNotImplementedError', () => {
    expect(() => smtp({ host: 'localhost', port: 25 })).toThrow(EmailRpcNotImplementedError);
  });

  it('multi() throws EmailRpcNotImplementedError', () => {
    expect(() => multi({ strategy: 'failover', providers: [] })).toThrow(
      EmailRpcNotImplementedError,
    );
  });
});
