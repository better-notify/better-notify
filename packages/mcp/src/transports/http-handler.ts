import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpAuth } from '../auth/index.js';

export type HttpHandlerDeps = {
  path: string;
  authenticate: McpAuth | undefined;
  enableJsonResponse: boolean;
  sessions: Map<string, StreamableHTTPServerTransport>;
  HttpTransportCtor: new (options: {
    sessionIdGenerator?: () => string;
    enableJsonResponse?: boolean;
    onsessioninitialized?: (sessionId: string) => void;
    onsessionclosed?: (sessionId: string) => void;
  }) => StreamableHTTPServerTransport;
  newSessionId: () => string;
  attach: (transport: Transport) => Promise<void>;
};

export const createHttpHandler =
  (deps: HttpHandlerDeps) =>
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (deps.authenticate) {
      const headers = new Headers();

      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers.set(key, value);
      }

      const request = new Request(`http://localhost${req.url ?? '/'}`, {
        method: req.method ?? 'GET',
        headers,
      });

      const authResult = await deps.authenticate.verify(request);

      if (!authResult.ok) {
        res.writeHead(401, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: authResult.reason ?? 'Unauthorized' }));
        return;
      }
    }

    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (pathname !== deps.path) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const sessionId = req.headers['mcp-session-id'];
    const existingSessionId = Array.isArray(sessionId) ? sessionId[0] : sessionId;
    const existing = existingSessionId ? deps.sessions.get(existingSessionId) : undefined;
    if (existing) {
      await existing.handleRequest(req, res);
      return;
    }

    const transport: StreamableHTTPServerTransport = new deps.HttpTransportCtor({
      sessionIdGenerator: deps.newSessionId,
      enableJsonResponse: deps.enableJsonResponse,
      onsessioninitialized: (id) => deps.sessions.set(id, transport),
      onsessionclosed: (id) => deps.sessions.delete(id),
    });

    await deps.attach(transport);
    await transport.handleRequest(req, res);
  };
