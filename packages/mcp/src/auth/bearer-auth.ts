import { createHash, timingSafeEqual } from 'node:crypto';
import { createAuth } from './create-auth.js';
import type { McpAuth } from './types.js';

const BEARER_PREFIX = /^Bearer\s+(.+)$/i;

const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();

export const bearerAuth = (secret: string): McpAuth => {
  const expected = sha256(secret);
  return createAuth((req) => {
    const header = req.headers.get('authorization');
    if (!header) return { ok: false, reason: 'missing authorization header' };
    const match = BEARER_PREFIX.exec(header);
    if (!match?.[1]) return { ok: false, reason: 'invalid bearer token' };
    if (timingSafeEqual(sha256(match[1]), expected)) return { ok: true };
    return { ok: false, reason: 'invalid bearer token' };
  });
};
