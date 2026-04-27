import { describe, expect, it } from 'vitest';
import { createSender } from './sender.js';
import { NotifyRpcNotImplementedError } from './errors.js';
import type { AnyCatalog } from './catalog.js';

describe('sender stubs', () => {
  it('createSender() throws NotifyRpcNotImplementedError', () => {
    const catalog: AnyCatalog = {
      _brand: 'Catalog',
      _ctx: undefined as never,
      definitions: {},
      nested: {},
      routes: [],
    };
    expect(() => createSender({ catalog, transport: {} })).toThrow(NotifyRpcNotImplementedError);
  });
});
