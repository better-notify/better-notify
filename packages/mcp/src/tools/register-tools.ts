import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AnyCatalog } from '@betternotify/core';
import { handlePromise } from '@betternotify/core';
import { z, type ZodTypeAny } from 'zod';
import { toMcpInputSchema } from './to-mcp-input-schema.js';

type AnyClient = Record<string, unknown> & { close: () => Promise<void> };

const getRouteMethod = (client: AnyClient, route: string): Record<string, unknown> | undefined => {
  const parts = route.split('.');
  let current: unknown = client;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current as Record<string, unknown> | undefined;
};

type ToolConfig = {
  description: string;
  inputSchema?: unknown;
  annotations?: Record<string, boolean>;
};

const buildToolConfig = (
  description: string,
  inputSchema: unknown,
  annotations?: Record<string, boolean>,
): ToolConfig => {
  const config: ToolConfig = { description };
  if (inputSchema) config.inputSchema = inputSchema;
  if (annotations) config.annotations = annotations;
  return config;
};

const errorResult = (message: string) => ({
  isError: true as const,
  content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
});

const okResult = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
});

const wrapSendSchema = (inputSchema: unknown): unknown => {
  if (!inputSchema) return undefined;
  return z.object({ input: inputSchema as ZodTypeAny }).passthrough();
};

export const registerTools = (
  server: McpServer,
  catalog: AnyCatalog,
  routes: string[],
  getClient: () => AnyClient | undefined,
  inputSchemas?: Record<string, unknown>,
): void => {
  for (const route of routes) {
    const definition = catalog.definitions[route];
    if (!definition) continue;

    const override = inputSchemas?.[route];
    const baseInputSchema = override ? undefined : toMcpInputSchema(definition.schema);
    const sendSchema = override ? undefined : wrapSendSchema(baseInputSchema);

    server.registerTool(
      `${route}.send`,
      buildToolConfig(`Send ${definition.channel} notification via ${route}`, sendSchema) as never,
      async (args: Record<string, unknown>) => {
        const client = getClient();
        if (!client) {
          return errorResult('Client not connected. Call mcp.connect(client) before starting.');
        }
        const methods = getRouteMethod(client, route);
        if (!methods?.send || typeof methods.send !== 'function') {
          return errorResult(`Route "${route}" not found on client`);
        }
        const [err, result] = await handlePromise(methods.send(args) as Promise<unknown>);
        if (err) return errorResult(err.message);
        return okResult(result);
      },
    );

    server.registerTool(
      `${route}.render`,
      buildToolConfig(
        `Preview ${definition.channel} notification for ${route} without sending`,
        baseInputSchema,
        { readOnlyHint: true },
      ) as never,
      async (args: Record<string, unknown>) => {
        const client = getClient();
        if (!client) {
          return errorResult('Client not connected. Call mcp.connect(client) before starting.');
        }
        const methods = getRouteMethod(client, route);
        if (!methods?.render || typeof methods.render !== 'function') {
          return errorResult(`Route "${route}" does not support .render()`);
        }
        const [err, result] = await handlePromise(methods.render(args) as Promise<unknown>);
        if (err) return errorResult(err.message);
        return okResult(result);
      },
    );
  }
};
