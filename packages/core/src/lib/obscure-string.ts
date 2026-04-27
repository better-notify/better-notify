/**
 * Obscure the middle of a string by replacing it with `*` characters, leaving
 * the first `visibleStart` and last `visibleEnd` characters intact. If the
 * string is too short to obscure anything, it is returned unchanged.
 *
 * Useful for GDPR-compliant logging of personal identifiers.
 *
 * @example
 * obscureString('1234567890', 2, 2); // '12******90'
 * obscureString('abc', 1, 1);        // 'abc' (nothing to obscure)
 */
export const obscureString = (text: string, visibleStart: number, visibleEnd: number): string => {
  const obscuredLength = text.length - (visibleStart + visibleEnd);
  if (obscuredLength <= 0) {
    return text;
  }
  const start = text.slice(0, visibleStart);
  const end = text.slice(visibleStart + obscuredLength);
  const obscuredPart = '*'.repeat(obscuredLength);
  return `${start}${obscuredPart}${end}`;
};
