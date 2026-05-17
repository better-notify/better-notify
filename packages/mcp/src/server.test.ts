import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createMcpServer } from './server.js';
import { bearerAuth } from './auth/index.js';
import type { AnyCatalog, ChannelDefinition } from '@betternotify/core';

const makeCatalog = (routes: string[]): AnyCatalog => {
  const definitions: Record<string, ChannelDefinition<unknown, unknown>> = {};
  for (const route of routes) {
    definitions[route] = {
      channel: 'email',
      schema: z.object({ name: z.string() }),
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

const getFreePort = async (): Promise<number> => {
  const { createServer } = await import('node:net');
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
};

describe('createMcpServer', () => {
  it('exposes filtered routes via .routes', () => {
    const catalog = makeCatalog([
      'transactional.welcome',
      'transactional.reset',
      'marketing.promo',
    ]);
    const mcp = createMcpServer({ catalog, expose: ['transactional.*'] });
    expect(mcp.routes).toEqual(['transactional.welcome', 'transactional.reset']);
  });

  it('honors deny precedence over expose', () => {
    const catalog = makeCatalog([
      'transactional.welcome',
      'transactional.reset',
      'marketing.promo',
    ]);
    const mcp = createMcpServer({
      catalog,
      expose: ['transactional.*', 'marketing.*'],
      deny: ['transactional.reset'],
    });
    expect(mcp.routes).toEqual(['transactional.welcome', 'marketing.promo']);
  });

  it('honors history.maxSize override', () => {
    const catalog = makeCatalog(['welcome']);
    const mcp = createMcpServer({ catalog, history: { maxSize: 2 } });
    const hook = mcp.plugin().hooks?.onAfterSend;
    if (typeof hook !== 'function') throw new Error('hook missing');
    hook({ route: 'welcome', messageId: '1', durationMs: 1 } as never);
    hook({ route: 'welcome', messageId: '2', durationMs: 2 } as never);
    hook({ route: 'welcome', messageId: '3', durationMs: 3 } as never);
    const recent = mcp.history.recent();
    expect(recent).toHaveLength(2);
    expect(recent[0]?.messageId).toBe('2');
  });

  it('uses custom name and version', async () => {
    const catalog = makeCatalog(['welcome']);
    const mcp = createMcpServer({ catalog, name: 'my-app', version: '2.0.0' });
    const [s, c] = InMemoryTransport.createLinkedPair();
    await mcp.attach(s);
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(c);
    const info = client.getServerVersion();
    expect(info?.name).toBe('my-app');
    expect(info?.version).toBe('2.0.0');
    await mcp.close();
  });

  describe('plugin', () => {
    it('records success events via onAfterSend', () => {
      const mcp = createMcpServer({ catalog: makeCatalog(['welcome']) });
      const p = mcp.plugin();
      expect(p.name).toBe('@betternotify/mcp');
      const hook = p.hooks?.onAfterSend;
      if (typeof hook !== 'function') throw new Error('hook missing');
      hook({
        route: 'welcome',
        messageId: 'm-1',
        durationMs: 150,
      } as never);
      const recent = mcp.history.recent();
      expect(recent).toHaveLength(1);
      expect(recent[0]?.status).toBe('success');
      expect(recent[0]?.durationMs).toBe(150);
    });

    it('defaults durationMs to 0 when missing', () => {
      const mcp = createMcpServer({ catalog: makeCatalog(['welcome']) });
      const hook = mcp.plugin().hooks?.onAfterSend;
      if (typeof hook !== 'function') throw new Error('hook missing');
      hook({ route: 'welcome', messageId: 'm-2' } as never);
      expect(mcp.history.recent()[0]?.durationMs).toBe(0);
    });

    it('records error events via onError', () => {
      const mcp = createMcpServer({ catalog: makeCatalog(['welcome']) });
      const hook = mcp.plugin().hooks?.onError;
      if (typeof hook !== 'function') throw new Error('hook missing');
      hook({
        route: 'welcome',
        messageId: 'm-3',
        error: new Error('boom'),
      } as never);
      const recent = mcp.history.recent();
      expect(recent[0]?.status).toBe('error');
      expect(recent[0]?.error?.message).toBe('boom');
    });
  });

  describe('history', () => {
    it('filters by route and aggregates stats', () => {
      const mcp = createMcpServer({ catalog: makeCatalog(['a', 'b']) });
      const hook = mcp.plugin().hooks?.onAfterSend;
      if (typeof hook !== 'function') throw new Error('hook missing');
      hook({ route: 'a', messageId: '1', durationMs: 10 } as never);
      hook({ route: 'a', messageId: '2', durationMs: 20 } as never);
      hook({ route: 'b', messageId: '3', durationMs: 30 } as never);
      expect(mcp.history.byRoute('a')).toHaveLength(2);
      expect(mcp.history.stats().total).toBe(3);
    });
  });

  describe('connect', () => {
    it('attaches a client before start', () => {
      const mcp = createMcpServer({ catalog: makeCatalog(['welcome']) });
      const fakeClient = { close: async () => {} };
      expect(() => mcp.connect(fakeClient as never)).not.toThrow();
    });

    it('throws when called after start', async () => {
      const mcp = createMcpServer({ catalog: makeCatalog(['welcome']) });
      const [s] = InMemoryTransport.createLinkedPair();
      await mcp.attach(s);
      const fakeClient = { close: async () => {} };
      mcp.connect(fakeClient as never);
      const port = await getFreePort();
      await mcp.start({ type: 'http', port, authenticate: bearerAuth('s') });
      expect(() => mcp.connect(fakeClient as never)).toThrow(/Cannot connect/);
      await mcp.close();
    });
  });

  describe('attach + MCP protocol', () => {
    it('exposes tools and resources matching filtered routes', async () => {
      const catalog = makeCatalog(['transactional.welcome', 'marketing.promo']);
      const mcp = createMcpServer({ catalog, expose: ['transactional.*'] });
      const [server, clientT] = InMemoryTransport.createLinkedPair();
      await mcp.attach(server);
      const client = new Client({ name: 'test', version: '1.0.0' });
      await client.connect(clientT);

      const tools = await client.listTools();
      const names = tools.tools.map((t) => t.name).sort();
      expect(names).toEqual(['transactional.welcome.render', 'transactional.welcome.send']);

      const resources = await client.listResources();
      expect(resources.resources.map((r) => r.uri)).toContain('notifications://recent');
      expect(resources.resources.map((r) => r.uri)).toContain('notifications://stats');

      const templates = await client.listResourceTemplates();
      expect(
        templates.resourceTemplates.some((t) => t.uriTemplate.includes('notifications://routes/')),
      ).toBe(true);

      const stats = await client.readResource({ uri: 'notifications://stats' });
      const statsText = (stats.contents[0] as { text?: string }).text ?? '{}';
      expect(JSON.parse(statsText).total).toBe(0);

      const history = await client.readResource({
        uri: 'notifications://routes/transactional.welcome/history',
      });
      const historyText = (history.contents[0] as { text?: string }).text ?? '[]';
      expect(JSON.parse(historyText)).toEqual([]);

      await mcp.close();
    });

    it('reads the recent notifications resource', async () => {
      const catalog = makeCatalog(['welcome']);
      const mcp = createMcpServer({ catalog });
      const hook = mcp.plugin().hooks?.onAfterSend;
      if (typeof hook !== 'function') throw new Error('hook missing');
      hook({ route: 'welcome', messageId: 'm-1', durationMs: 5 } as never);

      const [server, clientT] = InMemoryTransport.createLinkedPair();
      await mcp.attach(server);
      const client = new Client({ name: 'test', version: '1.0.0' });
      await client.connect(clientT);

      const recent = await client.readResource({ uri: 'notifications://recent' });
      const recentText = (recent.contents[0] as { text?: string }).text ?? '[]';
      const events = JSON.parse(recentText);
      expect(events).toHaveLength(1);
      expect(events[0].route).toBe('welcome');

      await mcp.close();
    });

    it('honors per-route inputSchemas overrides in tools/list', async () => {
      const catalog = makeCatalog(['welcome']);
      const override = {
        type: 'object',
        properties: { name: { type: 'string', description: 'Recipient name' } },
        required: ['name'],
        additionalProperties: false,
      };
      const mcp = createMcpServer({ catalog, inputSchemas: { welcome: override } });

      const [server, clientT] = InMemoryTransport.createLinkedPair();
      await mcp.attach(server);
      const client = new Client({ name: 'test', version: '1.0.0' });
      await client.connect(clientT);

      const { tools } = await client.listTools();
      const sendTool = tools.find((t) => t.name === 'welcome.send');
      const renderTool = tools.find((t) => t.name === 'welcome.render');
      expect(sendTool?.inputSchema).toEqual(override);
      expect(renderTool?.inputSchema).toEqual(override);

      await mcp.close();
    });

    it('mixes overrides with Zod-derived schemas across routes', async () => {
      const catalog = makeCatalog(['welcome', 'reset']);
      const override = { type: 'object', properties: { only: { type: 'boolean' } } };
      const mcp = createMcpServer({
        catalog,
        inputSchemas: { welcome: override },
      });

      const [server, clientT] = InMemoryTransport.createLinkedPair();
      await mcp.attach(server);
      const client = new Client({ name: 'test', version: '1.0.0' });
      await client.connect(clientT);

      const { tools } = await client.listTools();
      expect(tools.find((t) => t.name === 'welcome.send')?.inputSchema).toEqual(override);
      const resetSchema = tools.find((t) => t.name === 'reset.send')?.inputSchema as {
        properties?: { input?: { properties?: { name?: unknown } } };
      };
      expect(resetSchema.properties?.input?.properties?.name).toBeDefined();

      await mcp.close();
    });

    it('leaves Zod-derived schemas in place when no override is provided', async () => {
      const catalog = makeCatalog(['welcome']);
      const mcp = createMcpServer({ catalog });

      const [server, clientT] = InMemoryTransport.createLinkedPair();
      await mcp.attach(server);
      const client = new Client({ name: 'test', version: '1.0.0' });
      await client.connect(clientT);

      const { tools } = await client.listTools();
      const sendTool = tools.find((t) => t.name === 'welcome.send');
      const sendSchema = sendTool?.inputSchema as
        | { properties?: { input?: { properties?: { name?: unknown } } } }
        | undefined;
      expect(sendSchema?.properties?.input?.properties?.name).toBeDefined();
      const renderTool = tools.find((t) => t.name === 'welcome.render');
      const renderSchema = renderTool?.inputSchema as
        | { properties?: { name?: unknown } }
        | undefined;
      expect(renderSchema?.properties?.name).toBeDefined();

      await mcp.close();
    });

    it('supports calling a tool through MCP', async () => {
      const catalog = makeCatalog(['welcome']);
      const mcp = createMcpServer({ catalog });
      const fakeClient = {
        welcome: {
          send: (args: unknown) => Promise.resolve({ messageId: 'msg-1', received: args }),
        },
        close: async () => {},
      };
      mcp.connect(fakeClient as never);

      const [server, clientT] = InMemoryTransport.createLinkedPair();
      await mcp.attach(server);
      const client = new Client({ name: 'test', version: '1.0.0' });
      await client.connect(clientT);

      const result = await client.callTool({
        name: 'welcome.send',
        arguments: { to: 'a@x.com', input: { name: 'alice' } },
      });
      const content = (result.content as Array<{ text: string }>)[0];
      const parsed = JSON.parse(content?.text ?? '{}');
      expect(parsed.messageId).toBe('msg-1');
      expect(parsed.received).toEqual({ to: 'a@x.com', input: { name: 'alice' } });

      await mcp.close();
    });
  });

  describe('start re-entrancy guard', () => {
    it('throws when start is called twice', async () => {
      const catalog = makeCatalog(['welcome']);
      const mcp = createMcpServer({ catalog });
      const port = await getFreePort();
      await mcp.start({ type: 'http', port, authenticate: bearerAuth('s') });
      await expect(
        mcp.start({ type: 'http', port: port + 1, authenticate: bearerAuth('s') }),
      ).rejects.toThrow('already started');
      await mcp.close();
    });
  });

  describe('start({ type: stdio })', () => {
    afterEach(() => {
      vi.doUnmock('@modelcontextprotocol/sdk/server/stdio.js');
    });

    it('connects via the stdio transport', async () => {
      vi.doMock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
        StdioServerTransport: class {
          sessionId = 'stdio';
          async start() {}
          async close() {}
          async send() {}
          onclose?: () => void;
          onerror?: (e: Error) => void;
          onmessage?: () => void;
        },
      }));
      vi.resetModules();
      const { createMcpServer: freshCreate } = await import('./server.js');
      const mcp = freshCreate({ catalog: makeCatalog(['welcome']) });
      await mcp.start({ type: 'stdio' });
      await mcp.close();
    });
  });

  describe('start({ type: http })', () => {
    it('round-trips listTools through Streamable HTTP', async () => {
      const catalog = makeCatalog(['welcome']);
      const mcp = createMcpServer({ catalog });
      const port = await getFreePort();
      await mcp.start({ type: 'http', port, authenticate: bearerAuth('s3cr3t') });

      const client = new Client({ name: 'test', version: '1.0.0' });
      const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
        requestInit: { headers: { authorization: 'Bearer s3cr3t' } },
      });
      await client.connect(transport);
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual(['welcome.render', 'welcome.send']);
      await client.close();

      const unauthorized = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'GET' });
      expect(unauthorized.status).toBe(401);

      const notFound = await fetch(`http://127.0.0.1:${port}/nope`, {
        headers: { authorization: 'Bearer s3cr3t' },
      });
      expect(notFound.status).toBe(404);

      await mcp.close();
    });

    it('returns 500 when an unexpected handler error occurs', async () => {
      const catalog = makeCatalog(['welcome']);
      const mcp = createMcpServer({ catalog });
      const port = await getFreePort();
      const verify = vi.fn(() => {
        throw new Error('auth blew up');
      });
      await mcp.start({
        type: 'http',
        port,
        authenticate: { verify } as never,
      });
      const response = await fetch(`http://127.0.0.1:${port}/mcp`);
      expect(response.status).toBe(500);
      await mcp.close();
    });

    it('logs a warning when started without authentication', async () => {
      const writes: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = ((chunk: string | Uint8Array) => {
        writes.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;
      try {
        const catalog = makeCatalog(['welcome']);
        const mcp = createMcpServer({ catalog });
        const port = await getFreePort();
        await mcp.start({ type: 'http', port });
        expect(writes.some((w) => w.includes('without authentication'))).toBe(true);
        await mcp.close();
      } finally {
        process.stderr.write = original;
      }
    });
  });
});
