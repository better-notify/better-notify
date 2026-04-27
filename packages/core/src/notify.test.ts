import { describe, expect, it } from 'vitest';
import type { Channel } from './channel/types.js';
import { createNotify } from './notify.js';

const fakeChannel: Channel<
  'fake',
  { _channel: 'fake'; _finalize: (id: string) => any },
  any,
  any,
  any
> = {
  name: 'fake',
  createBuilder: () => ({
    _channel: 'fake',
    _finalize: (id: string) => ({
      id,
      channel: 'fake',
      schema: {
        '~standard': {
          version: 1,
          vendor: 'fake',
          validate: (v: unknown) => ({ value: v }),
        },
      } as any,
      middleware: [],
      runtime: {},
      _args: undefined as never,
      _rendered: undefined as never,
    }),
  }),
  finalize: (s, id) => (s as any)._finalize(id),
  validateArgs: (a) => a,
  render: async () => ({}),
  _transport: undefined as never,
};

describe('createNotify', () => {
  it('exposes a builder method per registered channel', () => {
    const rpc = createNotify({ channels: { fake: fakeChannel } });
    expect(typeof rpc.fake).toBe('function');
    const builder = rpc.fake();
    expect((builder as any)._channel).toBe('fake');
  });

  it('use() chains return a new root with augmented middleware', () => {
    const rpc = createNotify({ channels: { fake: fakeChannel } });
    const passthrough = (params: any) => params.next(params.ctx);
    const rpc2 = rpc.use(passthrough);
    expect(typeof rpc2.fake).toBe('function');
    expect(typeof rpc2.catalog).toBe('function');
  });

  it('catalog() builds an EmailCatalog from registered builders', () => {
    const rpc = createNotify({ channels: { fake: fakeChannel } });
    const cat = rpc.catalog({ greet: rpc.fake() as never });
    expect(cat._brand).toBe('EmailCatalog');
    expect(cat.routes).toEqual(['greet']);
  });
});
