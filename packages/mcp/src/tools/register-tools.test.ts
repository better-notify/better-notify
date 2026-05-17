import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnyCatalog, ChannelDefinition } from '@betternotify/core';
import { registerTools } from './register-tools.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

type FakeServer = {
  tools: Map<
    string,
    {
      config: {
        description: string;
        inputSchema?: unknown;
        annotations?: Record<string, boolean>;
      };
      handler: ToolHandler;
    }
  >;
  registerTool: McpServer['registerTool'];
};

const makeFakeServer = (): FakeServer => {
  const tools = new Map<
    string,
    {
      config: {
        description: string;
        inputSchema?: unknown;
        annotations?: Record<string, boolean>;
      };
      handler: ToolHandler;
    }
  >();
  return {
    tools,
    registerTool: ((name: string, config: { description: string }, handler: ToolHandler) => {
      tools.set(name, { config, handler });
      return undefined;
    }) as never,
  };
};

const makeCatalog = (routes: string[], schema?: unknown): AnyCatalog => {
  const definitions: Record<string, ChannelDefinition<unknown, unknown>> = {};
  for (const route of routes) {
    definitions[route] = {
      channel: 'email',
      schema: schema ?? z.object({ name: z.string() }),
      middleware: [],
      id: route,
      channelRef: null,
      runtime: {},
    } as unknown as ChannelDefinition<unknown, unknown>;
  }
  return {
    _brand: 'Catalog' as const,
    _ctx: undefined,
    _channels: {},
    definitions,
    nested: {},
    routes,
  } as unknown as AnyCatalog;
};

describe('registerTools', () => {
  it('registers .send and .render for each route', () => {
    const server = makeFakeServer();
    const catalog = makeCatalog(['welcome', 'reset']);
    registerTools(server as unknown as McpServer, catalog, ['welcome', 'reset'], () => undefined);
    expect(server.tools.has('welcome.send')).toBe(true);
    expect(server.tools.has('welcome.render')).toBe(true);
    expect(server.tools.has('reset.send')).toBe(true);
    expect(server.tools.has('reset.render')).toBe(true);
  });

  it('skips routes missing from definitions', () => {
    const server = makeFakeServer();
    const catalog = makeCatalog(['welcome']);
    registerTools(server as unknown as McpServer, catalog, ['welcome', 'missing'], () => undefined);
    expect(server.tools.has('welcome.send')).toBe(true);
    expect(server.tools.has('missing.send')).toBe(false);
  });

  it('omits inputSchema when schema is not Zod-like', () => {
    const server = makeFakeServer();
    const catalog = makeCatalog(['welcome'], { kind: 'valibot' });
    registerTools(server as unknown as McpServer, catalog, ['welcome'], () => undefined);
    expect(server.tools.get('welcome.send')?.config.inputSchema).toBeUndefined();
  });

  it('omits Zod inputSchema when the route has a user-provided override', () => {
    const server = makeFakeServer();
    const catalog = makeCatalog(['welcome']);
    registerTools(server as unknown as McpServer, catalog, ['welcome'], () => undefined, {
      welcome: { type: 'object' },
    });
    expect(server.tools.get('welcome.send')?.config.inputSchema).toBeUndefined();
    expect(server.tools.get('welcome.render')?.config.inputSchema).toBeUndefined();
  });

  it('annotates .render as readOnlyHint', () => {
    const server = makeFakeServer();
    const catalog = makeCatalog(['welcome']);
    registerTools(server as unknown as McpServer, catalog, ['welcome'], () => undefined);
    expect(server.tools.get('welcome.render')?.config.annotations).toEqual({ readOnlyHint: true });
  });

  describe('.send handler', () => {
    it('returns error when client not connected', async () => {
      const server = makeFakeServer();
      const catalog = makeCatalog(['welcome']);
      registerTools(server as unknown as McpServer, catalog, ['welcome'], () => undefined);
      const { handler } = server.tools.get('welcome.send') ?? {};
      const result = (await handler?.({})) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0]?.text ?? '{}').error).toContain('Client not connected');
    });

    it('returns error when route not found on client', async () => {
      const server = makeFakeServer();
      const catalog = makeCatalog(['welcome']);
      const client = { other: { send: () => Promise.resolve() }, close: async () => {} };
      registerTools(server as unknown as McpServer, catalog, ['welcome'], () => client as never);
      const { handler } = server.tools.get('welcome.send') ?? {};
      const result = (await handler?.({})) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0]?.text ?? '{}').error).toContain('not found on client');
    });

    it('returns error when traversal hits a non-object', async () => {
      const server = makeFakeServer();
      const catalog = makeCatalog(['transactional.welcome']);
      const client = { transactional: 'not-an-object', close: async () => {} };
      registerTools(
        server as unknown as McpServer,
        catalog,
        ['transactional.welcome'],
        () => client as never,
      );
      const { handler } = server.tools.get('transactional.welcome.send') ?? {};
      const result = (await handler?.({})) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0]?.text ?? '{}').error).toContain('not found');
    });

    it('forwards args directly to client.send so to/from/transport pass through', async () => {
      const server = makeFakeServer();
      const catalog = makeCatalog(['welcome']);
      let received: unknown;
      const client = {
        welcome: {
          send: (args: unknown) => {
            received = args;
            return Promise.resolve({ messageId: 'm-1' });
          },
        },
        close: async () => {},
      };
      registerTools(server as unknown as McpServer, catalog, ['welcome'], () => client as never);
      const { handler } = server.tools.get('welcome.send') ?? {};
      const args = { to: 'alice@x.com', input: { name: 'alice' } };
      const result = (await handler?.(args)) as { content: Array<{ text: string }> };
      expect(received).toEqual(args);
      expect(JSON.parse(result.content[0]?.text ?? '{}')).toEqual({ messageId: 'm-1' });
    });

    it('wraps the .send input schema with passthrough so to/from pass validation', () => {
      const server = makeFakeServer();
      const catalog = makeCatalog(['welcome']);
      registerTools(server as unknown as McpServer, catalog, ['welcome'], () => undefined);
      const sendSchema = server.tools.get('welcome.send')?.config.inputSchema as z.ZodTypeAny;
      const renderSchema = server.tools.get('welcome.render')?.config.inputSchema as z.ZodTypeAny;
      expect(sendSchema).toBeDefined();
      expect(renderSchema).toBeDefined();
      const parsed = sendSchema.parse({ to: 'a@x.com', input: { name: 'alice' }, from: 'b@x.com' });
      expect(parsed).toEqual({ to: 'a@x.com', input: { name: 'alice' }, from: 'b@x.com' });
      expect(() => sendSchema.parse({ input: { name: 42 } })).toThrow();
      expect(renderSchema.parse({ name: 'alice' })).toEqual({ name: 'alice' });
    });

    it('returns isError when send throws', async () => {
      const server = makeFakeServer();
      const catalog = makeCatalog(['welcome']);
      const client = {
        welcome: { send: () => Promise.reject(new Error('boom')) },
        close: async () => {},
      };
      registerTools(server as unknown as McpServer, catalog, ['welcome'], () => client as never);
      const { handler } = server.tools.get('welcome.send') ?? {};
      const result = (await handler?.({})) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0]?.text ?? '{}').error).toBe('boom');
    });
  });

  describe('.render handler', () => {
    it('returns error when client not connected', async () => {
      const server = makeFakeServer();
      const catalog = makeCatalog(['welcome']);
      registerTools(server as unknown as McpServer, catalog, ['welcome'], () => undefined);
      const { handler } = server.tools.get('welcome.render') ?? {};
      const result = (await handler?.({})) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0]?.text ?? '{}').error).toContain('Client not connected');
    });

    it('returns error when route does not support render', async () => {
      const server = makeFakeServer();
      const catalog = makeCatalog(['welcome']);
      const client = { welcome: { send: () => Promise.resolve() }, close: async () => {} };
      registerTools(server as unknown as McpServer, catalog, ['welcome'], () => client as never);
      const { handler } = server.tools.get('welcome.render') ?? {};
      const result = (await handler?.({})) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0]?.text ?? '{}').error).toContain('does not support');
    });

    it('forwards args directly to client.render', async () => {
      const server = makeFakeServer();
      const catalog = makeCatalog(['welcome']);
      let received: unknown;
      const client = {
        welcome: {
          render: (args: unknown) => {
            received = args;
            return Promise.resolve({ html: '<p>ok</p>' });
          },
        },
        close: async () => {},
      };
      registerTools(server as unknown as McpServer, catalog, ['welcome'], () => client as never);
      const { handler } = server.tools.get('welcome.render') ?? {};
      const result = (await handler?.({ name: 'bob' })) as { content: Array<{ text: string }> };
      expect(received).toEqual({ name: 'bob' });
      expect(JSON.parse(result.content[0]?.text ?? '{}').html).toBe('<p>ok</p>');
    });

    it('returns isError when render throws', async () => {
      const server = makeFakeServer();
      const catalog = makeCatalog(['welcome']);
      const client = {
        welcome: { render: () => Promise.reject(new Error('render failed')) },
        close: async () => {},
      };
      registerTools(server as unknown as McpServer, catalog, ['welcome'], () => client as never);
      const { handler } = server.tools.get('welcome.render') ?? {};
      const result = (await handler?.({})) as {
        isError?: boolean;
        content: Array<{ text: string }>;
      };
      expect(result.isError).toBe(true);
      expect(JSON.parse(result.content[0]?.text ?? '{}').error).toBe('render failed');
    });
  });
});
