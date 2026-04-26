import type { Address } from '../types.js';

/**
 * Extract the bare email address from an `Address`, dropping any display name.
 *
 * Use when comparing addresses (e.g. matching against an authenticated SMTP user)
 * or when the wire format strictly requires a plain email (envelope-MAIL-FROM,
 * routing keys, recipient lists for analytics).
 */
export const normalizeAddress = (addr: Address): string => {
  return typeof addr === 'string' ? addr : addr.email;
};
