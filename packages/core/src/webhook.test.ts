import { describe, expect, it } from 'vitest';
import { toFetchHandler, toNodeHandler } from './webhook.js';
import { NotifyRpcNotImplementedError } from './errors.js';
import type { WebhookAdapter, WebhookRouter } from './webhook.js';

describe('webhook stubs', () => {
  const router = { _brand: 'WebhookRouter', handlers: {} } as WebhookRouter;
  const adapter: WebhookAdapter = {
    name: 'mock',
    parse: async () => ({ event: 'x', data: {} }),
  };

  it('toNodeHandler() throws NotifyRpcNotImplementedError', () => {
    expect(() => toNodeHandler(router, { adapter })).toThrow(NotifyRpcNotImplementedError);
  });

  it('toFetchHandler() throws NotifyRpcNotImplementedError', () => {
    expect(() => toFetchHandler(router, { adapter })).toThrow(NotifyRpcNotImplementedError);
  });
});
