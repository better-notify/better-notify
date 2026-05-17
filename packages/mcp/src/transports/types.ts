import type { McpAuth } from '../auth/types.js';

/** Transport config for stdio-based MCP communication (e.g. CLI tools). */
export type StdioTransportConfig = {
  type: 'stdio';
};

/** Transport config for HTTP-based MCP communication with optional auth and session management. */
export type HttpTransportConfig = {
  type: 'http';
  port: number;
  path?: string;
  authenticate?: McpAuth;
  enableJsonResponse?: boolean;
};

/** Discriminated union of supported MCP transport configurations. */
export type McpTransportConfig = StdioTransportConfig | HttpTransportConfig;
