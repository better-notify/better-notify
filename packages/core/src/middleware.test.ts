import { describe, expect, it } from 'vitest';
import {
  dryRunMw,
  eventLoggerMw,
  idempotencyMw,
  loggerMw,
  rateLimitMw,
  suppressionListMw,
  tagInjectMw,
  tracingMw,
} from './middleware.js';
import { EmailRpcNotImplementedError } from './errors.js';

describe('middleware stubs', () => {
  it('all middleware factories throw EmailRpcNotImplementedError', () => {
    expect(() => loggerMw()).toThrow(EmailRpcNotImplementedError);
    expect(() => eventLoggerMw({ storage: {} })).toThrow(EmailRpcNotImplementedError);
    expect(() => suppressionListMw({ list: [] })).toThrow(EmailRpcNotImplementedError);
    expect(() => rateLimitMw({ key: 'k', max: 1, window: '1m' })).toThrow(
      EmailRpcNotImplementedError,
    );
    expect(() => idempotencyMw({ store: {} })).toThrow(EmailRpcNotImplementedError);
    expect(() => dryRunMw()).toThrow(EmailRpcNotImplementedError);
    expect(() => tracingMw()).toThrow(EmailRpcNotImplementedError);
    expect(() => tagInjectMw({ tags: { tier: 'pro' } })).toThrow(EmailRpcNotImplementedError);
  });
});
