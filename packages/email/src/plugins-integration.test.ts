import { describe, it, expect, expectTypeOf } from 'vitest';
import { z } from 'zod';
import {
  createClient,
  createNotify,
  type AnyCatalog,
  type Middleware,
  type Plugin,
} from '@emailrpc/core';
import { emailChannel, mockTransport } from './index.js';

describe('Plugin type', () => {
  it('accepts the minimum shape', () => {
    const p: Plugin = { name: 'x' };
    expectTypeOf(p).toExtend<{ name: string }>();
  });

  it('accepts middleware, onCreate, onClose', () => {
    const p: Plugin<AnyCatalog> = {
      name: 'full',
      middleware: [],
      onCreate: () => {},
      onClose: async () => {},
    };
    expectTypeOf(p.name).toEqualTypeOf<string>();
  });
});

const makeSetup = () => {
  const ch = emailChannel({ defaults: { from: 'a@b.com' } });
  const rpc = createNotify({ channels: { email: ch } });
  const catalog = rpc.catalog({
    welcome: rpc
      .email()
      .input(z.object({ name: z.string() }))
      .subject('hi')
      .template({ render: async () => ({ html: '<p/>' }) }),
  });
  return { ch, catalog };
};

describe('plugin lifecycle', () => {
  it('runs onCreate in array order at createClient time', () => {
    const order: string[] = [];
    const a: Plugin = {
      name: 'a',
      onCreate: () => {
        order.push('a');
      },
    };
    const b: Plugin = {
      name: 'b',
      onCreate: () => {
        order.push('b');
      },
    };
    const { ch, catalog } = makeSetup();
    createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
      plugins: [a, b],
    });
    expect(order).toEqual(['a', 'b']);
  });

  it('runs onClose in REVERSE order on mail.close()', async () => {
    const order: string[] = [];
    const a: Plugin = {
      name: 'a',
      onClose: () => {
        order.push('a');
      },
    };
    const b: Plugin = {
      name: 'b',
      onClose: () => {
        order.push('b');
      },
    };
    const { ch, catalog } = makeSetup();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
      plugins: [a, b],
    });
    await mail.close();
    expect(order).toEqual(['b', 'a']);
  });

  it('plugin hooks run BEFORE user hooks', async () => {
    const order: string[] = [];
    const plugin: Plugin = {
      name: 'p',
      hooks: {
        onAfterSend: () => {
          order.push('plugin');
        },
      },
    };
    const { ch, catalog } = makeSetup();
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
      plugins: [plugin],
      hooks: {
        onAfterSend: () => {
          order.push('user');
        },
      },
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'John Doe' } });
    expect(order).toEqual(['plugin', 'user']);
  });

  it('plugin middleware wraps route middleware', async () => {
    const order: string[] = [];
    const pluginMw: Middleware = async ({ next }) => {
      order.push('plugin enter');
      const r = await next();
      order.push('plugin exit');
      return r;
    };
    const routeMw: Middleware = async ({ next }) => {
      order.push('route enter');
      const r = await next();
      order.push('route exit');
      return r;
    };
    const ch = emailChannel({ defaults: { from: 'a@b.com' } });
    const rpc = createNotify({ channels: { email: ch } });
    const catalog = rpc.catalog({
      welcome: rpc
        .email()
        .use(routeMw)
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      catalog,
      channels: { email: ch },
      transportsByChannel: { email: mockTransport() },
      plugins: [{ name: 'p', middleware: [pluginMw] }],
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'John Doe' } });
    expect(order).toEqual(['plugin enter', 'route enter', 'route exit', 'plugin exit']);
  });

  it('onCreate failure aborts createClient', () => {
    const failing: Plugin = {
      name: 'failing',
      onCreate: () => {
        throw new Error('init boom');
      },
    };
    const { ch, catalog } = makeSetup();
    expect(() =>
      createClient({
        catalog,
        channels: { email: ch },
        transportsByChannel: { email: mockTransport() },
        plugins: [failing],
      }),
    ).toThrow('init boom');
  });
});
