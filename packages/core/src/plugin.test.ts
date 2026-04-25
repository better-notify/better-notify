import { describe, it, expect, expectTypeOf } from 'vitest';
import { z } from 'zod';
import { createClient } from './client.js';
import { emailRpc } from './init.js';
import type { Middleware } from './middleware.js';
import type { Plugin } from './plugin.js';
import type { AnyEmailRouter } from './router.js';
import { mockProvider } from './test.js';

describe('Plugin type', () => {
  it('accepts the minimum shape', () => {
    const p: Plugin = { name: 'x' };
    expectTypeOf(p).toMatchTypeOf<{ name: string }>();
  });

  it('accepts middleware, onCreate, onClose', () => {
    const p: Plugin<AnyEmailRouter> = {
      name: 'full',
      middleware: [],
      onCreate: () => {},
      onClose: async () => {},
    };
    expectTypeOf(p.name).toEqualTypeOf<string>();
  });
});

const makeRouter = () => {
  const t = emailRpc.init();
  return t.router({
    welcome: t
      .email()
      .input(z.object({ name: z.string() }))
      .subject('hi')
      .template({ render: async () => ({ html: '<p/>' }) }),
  });
};

describe('plugin lifecycle', () => {
  it('runs onCreate in array order at createClient time', () => {
    const order: string[] = [];
    const a: Plugin = { name: 'a', onCreate: () => { order.push('a'); } };
    const b: Plugin = { name: 'b', onCreate: () => { order.push('b'); } };
    createClient({
      router: makeRouter(),
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      plugins: [a, b],
    });
    expect(order).toEqual(['a', 'b']);
  });

  it('runs onClose in REVERSE order on mail.close()', async () => {
    const order: string[] = [];
    const a: Plugin = { name: 'a', onClose: () => { order.push('a'); } };
    const b: Plugin = { name: 'b', onClose: () => { order.push('b'); } };
    const mail = createClient({
      router: makeRouter(),
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
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
      hooks: { onAfterSend: () => { order.push('plugin'); } },
    };
    const mail = createClient({
      router: makeRouter(),
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      plugins: [plugin],
      hooks: { onAfterSend: () => { order.push('user'); } },
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });
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
    const t = emailRpc.init();
    const router = t.router({
      welcome: t
        .use(routeMw)
        .email()
        .input(z.object({ name: z.string() }))
        .subject('hi')
        .template({ render: async () => ({ html: '<p/>' }) }),
    });
    const mail = createClient({
      router,
      providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
      defaults: { from: 'a@b.com' },
      plugins: [{ name: 'p', middleware: [pluginMw] }],
    });
    await mail.welcome.send({ to: 'x@y.com', input: { name: 'Lucas' } });
    expect(order).toEqual(['plugin enter', 'route enter', 'route exit', 'plugin exit']);
  });

  it('onCreate failure aborts createClient', () => {
    const failing: Plugin = {
      name: 'failing',
      onCreate: () => { throw new Error('init boom'); },
    };
    expect(() =>
      createClient({
        router: makeRouter(),
        providers: [{ name: 'mock', provider: mockProvider(), priority: 1 }],
        defaults: { from: 'a@b.com' },
        plugins: [failing],
      }),
    ).toThrow('init boom');
  });
});

