import type { Address } from '../types.js';

/**
 * Render an `Address` in RFC 5322 mailbox format (`"Display Name" <email>`).
 *
 * Use when feeding addresses to a provider's send API that respects display names
 * (SMTP `From`/`To` headers, SES/Resend body fields). Falls back to the bare
 * email when no name is set.
 */
export const formatAddress = (addr: Address): string => {
  if (typeof addr === 'string') return addr;
  return addr.name ? `"${addr.name}" <${addr.email}>` : addr.email;
};
