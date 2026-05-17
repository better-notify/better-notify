import type { AnyCatalog } from '@betternotify/core';
import type { HistoryOptions } from './history/types.js';

export type JsonSchema = Record<string, unknown>;

export type RoutesOf<C extends AnyCatalog> = C['routes'][number];

export type McpServerOptions<C extends AnyCatalog> = {
  catalog: C;
  name?: string;
  version?: string;
  expose?: Array<RoutesOf<C> | (string & {})>;
  deny?: Array<RoutesOf<C> | (string & {})>;
  history?: HistoryOptions;
  inputSchemas?: Partial<Record<RoutesOf<C> | (string & {}), JsonSchema>>;
};
