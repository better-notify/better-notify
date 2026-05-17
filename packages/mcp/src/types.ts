import type { AnyCatalog } from '@betternotify/core';
import type { HistoryOptions } from './history/types.js';

/** A plain JSON Schema object used for MCP tool input overrides. */
export type JsonSchema = Record<string, unknown>;

/** Extracts the union of route string literals from a catalog. */
export type RoutesOf<C extends AnyCatalog> = C['routes'][number];

/** Configuration for {@link createMcpServer}. */
export type McpServerOptions<C extends AnyCatalog> = {
  catalog: C;
  name?: string;
  version?: string;
  expose?: Array<RoutesOf<C> | (string & {})>;
  deny?: Array<RoutesOf<C> | (string & {})>;
  history?: HistoryOptions;
  inputSchemas?: Partial<Record<RoutesOf<C> | (string & {}), JsonSchema>>;
};
