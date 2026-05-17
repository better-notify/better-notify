import type { AuthFn, McpAuth } from './types.js';

export const createAuth = (fn: AuthFn): McpAuth => ({ verify: fn });
