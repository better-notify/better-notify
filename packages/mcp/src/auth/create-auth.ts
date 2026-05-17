import type { AuthFn, McpAuth } from './types.js';

/** Wraps a raw {@link AuthFn} into an {@link McpAuth} object for use with HTTP transport authentication. */
export const createAuth = (fn: AuthFn): McpAuth => ({ verify: fn });
