# @betternotify/mcp

[![npm version](https://img.shields.io/npm/v/@betternotify/mcp)](https://www.npmjs.com/package/@betternotify/mcp)
[![npm downloads](https://img.shields.io/npm/dm/@betternotify/mcp)](https://www.npmjs.com/package/@betternotify/mcp)
[![license](https://img.shields.io/npm/l/@betternotify/mcp)](https://github.com/better-notify/better-notify/blob/main/LICENSE)

[Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for [Better-Notify](https://github.com/better-notify/better-notify). Expose your notification catalog as discoverable tools for AI agents — each route becomes a typed MCP tool that agents can discover, preview, and send through.

<p>
  <a href="https://better-notify.com">Website</a> ·
  <a href="https://better-notify.com/docs">Docs</a> ·
  <a href="https://github.com/better-notify/better-notify">GitHub</a> ·
  <a href="https://x.com/better_notify">X</a>
</p>

## Install

```sh
npm install @betternotify/mcp @betternotify/core @modelcontextprotocol/sdk
```

## Usage

```ts
import { createNotify, createClient } from '@betternotify/core';
import { emailChannel, mockTransport } from '@betternotify/email';
import { createMcpServer } from '@betternotify/mcp';
import { z } from 'zod';

const email = emailChannel({ defaults: { from: 'hello@example.com' } });
const rpc = createNotify({ channels: { email } });

const catalog = rpc.catalog({
  welcome: rpc
    .email()
    .input(z.object({ name: z.string() }))
    .subject(({ input }) => `Welcome, ${input.name}`)
    .template({ render: async ({ input }) => ({ html: `<h1>Hi ${input.name}</h1>` }) }),
});

const mcp = createMcpServer({ catalog });

const mail = createClient({
  catalog,
  transportsByChannel: { email: mockTransport() },
  plugins: [mcp.plugin()],
});

mcp.connect(mail);
await mcp.start({ type: 'stdio' });
```

## Options

| Field          | Type         | Description                                                                                                                       |
| -------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `catalog`      | `AnyCatalog` | The notification catalog for tool generation. Required.                                                                           |
| `name`         | `string`     | MCP server name. Defaults to `"betternotify"`.                                                                                    |
| `version`      | `string`     | MCP server version. Defaults to `"1.0.0"`.                                                                                        |
| `expose`       | `string[]`   | Glob patterns — only matching routes become tools.                                                                                |
| `deny`         | `string[]`   | Glob patterns — deny takes precedence over expose.                                                                                |
| `history`      | `object`     | `{ maxSize?: number }` — ring buffer config (default 200).                                                                        |
| `inputSchemas` | `object`     | Per-route JSON Schema shown to AI agents in `tools/list`. Required for non-Zod Standard Schemas; optional for Zod (auto-derived). |

## Standard Schema

Zod schemas are auto-derived into JSON Schema and shown to AI agents. Valibot, ArkType, and other Standard Schemas need an explicit `inputSchemas` override since the MCP SDK can only introspect Zod natively. Runtime validation always runs through the Better-Notify client regardless.

```ts
import { type } from 'arktype';

const Input = type({ name: 'string', email: 'string.email' });

const mcp = createMcpServer({
  catalog,
  inputSchemas: { welcome: Input.toJsonSchema() },
});
```

## Transport

```ts
// stdio (local AI agents)
await mcp.start({ type: 'stdio' });

// Streamable HTTP (remote, with authentication)
import { bearerAuth } from '@betternotify/mcp';

await mcp.start({
  type: 'http',
  port: 3100,
  path: '/mcp',
  authenticate: bearerAuth(process.env.MCP_SECRET),
});
```

## Authentication

```ts
import { createAuth, bearerAuth, apiKeyAuth } from '@betternotify/mcp';

// Bearer token
bearerAuth('my-secret');

// API key
apiKeyAuth({ header: 'x-api-key', keys: ['key-1', 'key-2'] });

// Custom
createAuth(async (req) => {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  const user = await db.findByToken(token);
  if (!user) return { ok: false, reason: 'invalid token' };
  return { ok: true, context: { userId: user.id } };
});
```

## License

MIT
