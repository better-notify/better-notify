import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { AnyCatalog, Client, Plugin } from '@betternotify/core';
import { createRingBuffer, type SendEventRecord } from './history/index.js';
import { filterRoutes } from './routing/index.js';
import { collectInputSchemaOverrides, registerTools, wrapListToolsHandler } from './tools/index.js';
import { createHttpHandler } from './transports/index.js';
import type { McpTransportConfig } from './transports/index.js';
import type { McpServerOptions } from './types.js';

type AnyClient = Record<string, unknown> & { close: () => Promise<void> };

export const createMcpServer = <C extends AnyCatalog>(options: McpServerOptions<C>) => {
  const { catalog, name = 'betternotify', version = '1.0.0' } = options;

  const maxSize = options.history?.maxSize ?? 200;
  const buffer = createRingBuffer(maxSize);

  let client: AnyClient | undefined;
  let started = false;

  const attachedServers = new Set<McpServer>();
  let httpServer: import('node:http').Server | undefined;

  const routes = filterRoutes(
    catalog.routes,
    options.expose as string[] | undefined,
    options.deny as string[] | undefined,
  );

  const overrides = collectInputSchemaOverrides(routes, options.inputSchemas);

  const buildServer = (): McpServer => {
    const server = new McpServer({ name, version });
    registerTools(server, catalog, routes, () => client, options.inputSchemas as never);
    if (overrides.size > 0) wrapListToolsHandler(server, overrides);

    server.registerResource(
      'recent-notifications',
      'notifications://recent',
      { title: 'Recent Notifications', mimeType: 'application/json' },
      async (uri) => ({
        contents: [{ uri: uri.href, text: JSON.stringify(buffer.getAll()) }],
      }),
    );

    server.registerResource(
      'route-history',
      new ResourceTemplate('notifications://routes/{routeId}/history', {
        list: async () => ({
          resources: routes.map((route) => ({
            uri: `notifications://routes/${route}/history`,
            name: `${route} history`,
          })),
        }),
      }),
      { title: 'Route Notification History', mimeType: 'application/json' },
      async (uri, { routeId }) => ({
        contents: [{ uri: uri.href, text: JSON.stringify(buffer.getByRoute(routeId as string)) }],
      }),
    );

    server.registerResource(
      'notification-stats',
      'notifications://stats',
      { title: 'Notification Statistics', mimeType: 'application/json' },
      async (uri) => ({
        contents: [{ uri: uri.href, text: JSON.stringify(buffer.getStats()) }],
      }),
    );

    return server;
  };

  const attach = async (transport: Transport): Promise<void> => {
    const server = buildServer();
    attachedServers.add(server);
    await server.connect(transport);
  };

  const connect = (c: Client<C> & { close: () => Promise<void> }): void => {
    if (started) throw new Error('Cannot connect client after server has started.');
    client = c as unknown as AnyClient;
  };

  const plugin = (): Plugin => ({
    name: '@betternotify/mcp',
    hooks: {
      onAfterSend: (params: { route: string; messageId: string; durationMs?: number }) => {
        const event: SendEventRecord = {
          route: params.route,
          messageId: params.messageId,
          status: 'success',
          durationMs: params.durationMs ?? 0,
          startedAt: new Date(),
          endedAt: new Date(),
        };
        buffer.push(event);
      },
      onError: (params: { route: string; messageId: string; error: Error }) => {
        const event: SendEventRecord = {
          route: params.route,
          messageId: params.messageId,
          status: 'error',
          durationMs: 0,
          startedAt: new Date(),
          endedAt: new Date(),
          error: { name: params.error.name, message: params.error.message },
        };
        buffer.push(event);
      },
    },
  });

  const start = async (transport: McpTransportConfig): Promise<void> => {
    started = true;

    if (transport.type === 'stdio') {
      const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
      await attach(new StdioServerTransport());
      return;
    }

    const { StreamableHTTPServerTransport: HttpTransportCtor } =
      await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const { createServer } = await import('node:http');
    const { randomUUID } = await import('node:crypto');

    const sessions = new Map<string, StreamableHTTPServerTransport>();
    const handler = createHttpHandler({
      path: transport.path ?? '/mcp',
      authenticate: transport.authenticate,
      enableJsonResponse: transport.enableJsonResponse ?? false,
      sessions,
      HttpTransportCtor,
      newSessionId: () => randomUUID(),
      attach,
    });

    httpServer = createServer((req, res) => {
      handler(req, res).catch(() => {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
    });

    if (!transport.authenticate) {
      process.stderr.write(
        `[${name}] MCP server running on port ${transport.port} without authentication\n`,
      );
    }

    await new Promise<void>((resolve) => {
      httpServer?.listen(transport.port, resolve);
    });
  };

  const close = async (): Promise<void> => {
    for (const server of attachedServers) {
      await server.close();
    }
    attachedServers.clear();
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer?.close(() => resolve());
      });
      httpServer = undefined;
    }
    started = false;
  };

  const history = {
    recent: () => buffer.getAll(),
    byRoute: (route: string) => buffer.getByRoute(route),
    stats: () => buffer.getStats(),
  };

  return { start, close, connect, plugin, attach, routes, history };
};
