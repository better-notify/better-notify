import { describe, expect, it } from 'vitest';
import { toFetchHandler, toNodeHandler } from './webhook.js';
import { EmailRpcNotImplementedError } from './errors.js';
import type { WebhookAdapter, WebhookRouter } from './webhook.js';

describe('webhook stubs', () => {
  const router = { _brand: 'WebhookRouter', handlers: {} } as WebhookRouter;
  const adapter: WebhookAdapter = {
    name: 'mock',
    parse: async () => ({ event: 'x', data: {} }),
  };

  it('toNodeHandler() throws EmailRpcNotImplementedError', () => {
    expect(() => toNodeHandler(router, { adapter })).toThrow(EmailRpcNotImplementedError);
  });

  it('toFetchHandler() throws EmailRpcNotImplementedError', () => {
    expect(() => toFetchHandler(router, { adapter })).toThrow(EmailRpcNotImplementedError);
  });
});
