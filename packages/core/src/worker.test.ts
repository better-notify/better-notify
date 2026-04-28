import { describe, expect, it } from 'vitest';
import { createWorker } from './worker.js';
import { NotifyRpcNotImplementedError } from './errors.js';
import type { Transport } from './transports/types.js';
import type { AnyCatalog } from './catalog.js';
import type { QueueAdapter } from './queue/types.js';

describe('worker stubs', () => {
  it('createWorker() throws NotifyRpcNotImplementedError', () => {
    const catalog: AnyCatalog = {
      _brand: 'Catalog',
      _ctx: undefined as never,
      definitions: {},
      nested: {},
      routes: [],
    };
    const transport = {} as Transport;
    const queue = {} as QueueAdapter;
    expect(() => createWorker({ catalog, transport, queue })).toThrow(NotifyRpcNotImplementedError);
  });
});
