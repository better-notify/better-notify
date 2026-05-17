import type { McpAuth } from '../auth/types.js';

export type StdioTransportConfig = {
  type: 'stdio';
};

export type HttpTransportConfig = {
  type: 'http';
  port: number;
  path?: string;
  authenticate?: McpAuth;
  enableJsonResponse?: boolean;
};

export type McpTransportConfig = StdioTransportConfig | HttpTransportConfig;
