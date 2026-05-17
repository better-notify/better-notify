import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { JsonSchema } from '../types.js';

type RawRequestHandler = (request: unknown, extra: unknown) => Promise<unknown>;
type ToolListResult = { tools: Array<{ name: string; inputSchema?: unknown }> };

export const collectInputSchemaOverrides = (
  routes: string[],
  inputSchemas: Record<string, JsonSchema | undefined> | undefined,
): Map<string, JsonSchema> => {
  const result = new Map<string, JsonSchema>();
  if (!inputSchemas) return result;
  for (const route of routes) {
    const schema = inputSchemas[route];
    if (!schema) continue;
    result.set(`${route}.send`, schema);
    result.set(`${route}.render`, schema);
  }
  return result;
};

export const wrapListToolsHandler = (
  server: McpServer,
  overrides: Map<string, JsonSchema>,
): void => {
  const inner = server.server as unknown as { _requestHandlers: Map<string, RawRequestHandler> };
  const handlers = inner._requestHandlers;
  const original = handlers.get('tools/list') as RawRequestHandler;
  handlers.set('tools/list', async (request, extra) => {
    const result = (await original(request, extra)) as ToolListResult;
    return {
      ...result,
      tools: result.tools.map((tool) => {
        const override = overrides.get(tool.name);
        return override ? { ...tool, inputSchema: override } : tool;
      }),
    };
  });
};
