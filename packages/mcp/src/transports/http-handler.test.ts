import { describe, it, expect } from 'vitest';
import { createHttpHandler } from './http-handler.js';
import { bearerAuth } from '../auth/index.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const makeRes = () => {
  const res = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: '' as string | undefined,
    headersSent: false,
    listeners: {} as Record<string, () => void>,
    writeHead(code: number, headers?: Record<string, string>) {
      res.statusCode = code;
      if (headers) res.headers = { ...res.headers, ...headers };
      res.headersSent = true;
    },
    end(body?: string) {
      if (body !== undefined) res.body = body;
    },
    on(event: string, cb: () => void) {
      res.listeners[event] = cb;
    },
  };
  return res;
};

const makeReq = (method: string, url: string, headers: Record<string, unknown> = {}) =>
  ({ method, url, headers }) as unknown as IncomingMessage;

class FakeHttpTransport {
  sessionId: string | undefined;
  onclose?: () => void;
  onerror?: (e: Error) => void;
  onmessage?: () => void;
  handleRequestCalls = 0;
  constructor(
    public options: {
      sessionIdGenerator?: () => string;
      enableJsonResponse?: boolean;
      onsessioninitialized?: (id: string) => void;
      onsessionclosed?: (id: string) => void;
    },
  ) {}
  async handleRequest(_req: IncomingMessage, _res: ServerResponse) {
    this.handleRequestCalls++;
    const id = this.options.sessionIdGenerator?.();
    if (id) {
      this.sessionId = id;
      this.options.onsessioninitialized?.(id);
    }
  }
  async start() {}
  async close() {
    if (this.sessionId) this.options.onsessionclosed?.(this.sessionId);
  }
  async send() {}
}

describe('createHttpHandler', () => {
  it('returns 401 when auth fails', async () => {
    const handler = createHttpHandler({
      path: '/mcp',
      authenticate: bearerAuth('secret'),
      enableJsonResponse: false,
      sessions: new Map(),
      HttpTransportCtor: FakeHttpTransport as never,
      newSessionId: () => 'sid',
      attach: async () => {},
    });
    const res = makeRes();
    await handler(makeReq('POST', '/mcp'), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(401);
  });

  it('falls back to "Unauthorized" when auth result omits a reason', async () => {
    const handler = createHttpHandler({
      path: '/mcp',
      authenticate: { verify: () => ({ ok: false }) },
      enableJsonResponse: false,
      sessions: new Map(),
      HttpTransportCtor: FakeHttpTransport as never,
      newSessionId: () => 'sid',
      attach: async () => {},
    });
    const res = makeRes();
    await handler(makeReq('POST', '/mcp'), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body ?? '{}').error).toBe('Unauthorized');
  });

  it('returns 404 for paths outside the configured MCP path', async () => {
    const handler = createHttpHandler({
      path: '/mcp',
      authenticate: undefined,
      enableJsonResponse: false,
      sessions: new Map(),
      HttpTransportCtor: FakeHttpTransport as never,
      newSessionId: () => 'sid',
      attach: async () => {},
    });
    const res = makeRes();
    await handler(makeReq('GET', '/elsewhere'), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(404);
  });

  it('returns 404 for paths that merely share a prefix with the configured path', async () => {
    const handler = createHttpHandler({
      path: '/mcp',
      authenticate: undefined,
      enableJsonResponse: false,
      sessions: new Map(),
      HttpTransportCtor: FakeHttpTransport as never,
      newSessionId: () => 'sid',
      attach: async () => {},
    });
    const res = makeRes();
    await handler(makeReq('GET', '/mcpfoo'), res as unknown as ServerResponse);
    expect(res.statusCode).toBe(404);
  });

  it('matches the configured path even when query strings are present', async () => {
    const sessions = new Map();
    const handler = createHttpHandler({
      path: '/mcp',
      authenticate: undefined,
      enableJsonResponse: false,
      sessions,
      HttpTransportCtor: FakeHttpTransport as never,
      newSessionId: () => 'new-session',
      attach: async () => {},
    });
    const res = makeRes();
    await handler(makeReq('POST', '/mcp?x=1'), res as unknown as ServerResponse);
    expect(sessions.has('new-session')).toBe(true);
  });

  it('creates a new transport for unsessioned requests and registers it', async () => {
    const sessions = new Map();
    const attached: unknown[] = [];
    const handler = createHttpHandler({
      path: '/mcp',
      authenticate: undefined,
      enableJsonResponse: false,
      sessions,
      HttpTransportCtor: FakeHttpTransport as never,
      newSessionId: () => 'new-session',
      attach: async (t) => {
        attached.push(t);
      },
    });
    const res = makeRes();
    await handler(makeReq('POST', '/mcp'), res as unknown as ServerResponse);
    expect(attached).toHaveLength(1);
    expect(sessions.has('new-session')).toBe(true);

    const transport = attached[0] as FakeHttpTransport;
    await transport.close();
    expect(sessions.has('new-session')).toBe(false);
  });

  it('routes follow-up requests to the matching session transport', async () => {
    const session = new FakeHttpTransport({});
    const sessions = new Map([['existing', session]]);
    const handler = createHttpHandler({
      path: '/mcp',
      authenticate: undefined,
      enableJsonResponse: false,
      sessions: sessions as never,
      HttpTransportCtor: FakeHttpTransport as never,
      newSessionId: () => 'never-used',
      attach: async () => {},
    });
    const res = makeRes();
    await handler(
      makeReq('POST', '/mcp', { 'mcp-session-id': 'existing' }),
      res as unknown as ServerResponse,
    );
    expect(session.handleRequestCalls).toBe(1);
  });

  it('handles array-valued mcp-session-id headers by taking the first value', async () => {
    const session = new FakeHttpTransport({});
    const sessions = new Map([['existing', session]]);
    const handler = createHttpHandler({
      path: '/mcp',
      authenticate: undefined,
      enableJsonResponse: false,
      sessions: sessions as never,
      HttpTransportCtor: FakeHttpTransport as never,
      newSessionId: () => 'never-used',
      attach: async () => {},
    });
    const res = makeRes();
    await handler(
      makeReq('POST', '/mcp', { 'mcp-session-id': ['existing', 'ignored'] }),
      res as unknown as ServerResponse,
    );
    expect(session.handleRequestCalls).toBe(1);
  });

  it('falls back to "/" when url is missing', async () => {
    const handler = createHttpHandler({
      path: '/mcp',
      authenticate: bearerAuth('s'),
      enableJsonResponse: false,
      sessions: new Map(),
      HttpTransportCtor: FakeHttpTransport as never,
      newSessionId: () => 'sid',
      attach: async () => {},
    });
    const res = makeRes();
    await handler(
      { headers: { 'x-other': ['array', 'value'] } } as unknown as IncomingMessage,
      res as unknown as ServerResponse,
    );
    expect(res.statusCode).toBe(401);
  });

  it('returns 404 when url is missing and no auth is configured', async () => {
    const handler = createHttpHandler({
      path: '/mcp',
      authenticate: undefined,
      enableJsonResponse: false,
      sessions: new Map(),
      HttpTransportCtor: FakeHttpTransport as never,
      newSessionId: () => 'sid',
      attach: async () => {},
    });
    const res = makeRes();
    await handler(
      { headers: {} } as unknown as IncomingMessage,
      res as unknown as ServerResponse,
    );
    expect(res.statusCode).toBe(404);
  });
});
