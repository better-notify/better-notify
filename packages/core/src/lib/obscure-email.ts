import { obscureString } from './obscure-string.js';

/**
 * Obscure the local part of an email address while keeping the domain visible.
 * Returns the input unchanged if it doesn't contain `@`.
 *
 * Useful for GDPR-compliant logging of email addresses.
 *
 * @example
 * obscureEmail('john.doe@example.com'); // 'j******e@example.com'
 * obscureEmail('a@example.com');        // 'a@example.com' (too short to obscure)
 */
export const obscureEmail = (email: string): string => {
  const [local, domain] = email.split('@');
  if (!local || !domain) {
    return email;
  }
  const [visibleStart, visibleEnd] = local.length <= 2 ? [0, 0] : [1, 1];
  return `${obscureString(local, visibleStart, visibleEnd)}@${domain}`;
};
