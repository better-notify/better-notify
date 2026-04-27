import { describe, it, expect, expectTypeOf } from 'vitest';
import { z } from 'zod';
import { createClient } from '../client.js';
import { createEmailRpc } from '../factory.js';
import type { Middleware } from '../middlewares/types.js';
import type { Plugin } from './types.js';
import type { AnyEmailCatalog } from '../catalog.js';
import { mockTransport } from '../lib/mock-transport.js';

describe('Plugin type', () => {
  it('accepts the minimum shape', () => {
    const p: Plugin = { name: 'x' };
    expectTypeOf(p).toExtend<{ name: string }>();
  });

  it('accepts middleware, onCreate, onClose', () => {
    const p: Plugin<AnyEmailCatalog> = {
      name: 'full',
      middleware: [],
      onCreate: () => {},
      onClose: async () => {},
    };
    expectTypeOf(p.name).toEqualTypeOf<string>();
  });
});

const makeRouter = () => {
  const rpc = createEmailRpc();
  return rpc.catalog({
    welcome: rpc
      .email()
      .input(z.object({ name: z.string() }))
      .subject('hi')
      .template({ render: async () => ({ html: '<p/>' }) }),
  });
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
    createClient({
      catalog: makeRouter(),
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
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
    const mail = createClient({
      catalog: makeRouter(),
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
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
    const mail = createClient({
      catalog: makeRouter(),
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
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
    const rpc = createEmailRpc();
    const catalog = rpc.catalog({
      welcome: rpc
        .use(routeMw)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      catalog,
      transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
      defaults: { from: 'a@b.com' },
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
    expect(() =>
      createClient({
        catalog: makeRouter(),
        transports: [{ name: 'mock', transport: mockTransport(), priority: 1 }],
        defaults: { from: 'a@b.com' },
        plugins: [failing],
      }),
    ).toThrow('init boom');
  });
});
