import { createHash, timingSafeEqual } from 'node:crypto';
import { createAuth } from './create-auth.js';
import type { McpAuth } from './types.js';

export type ApiKeyAuthOptions = {
  header?: string;
  keys: string[];
};

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();

export const apiKeyAuth = (opts: ApiKeyAuthOptions): McpAuth => {
  if (opts.keys.length === 0) {
    throw new Error('apiKeyAuth requires at least one key');
  }
  const headerName = opts.header ?? 'x-api-key';
  const hashedKeys = opts.keys.map(sha256);
  return createAuth((req) => {
    const value = req.headers.get(headerName);
    if (!value) return { ok: false, reason: `missing ${headerName} header` };
    const provided = sha256(value);
    const ok = hashedKeys.reduce(
      (acc, key) => (timingSafeEqual(key, provided) ? true : acc),
      false,
    );
    if (ok) return { ok: true };
    return { ok: false, reason: 'invalid api key' };
  });
};
