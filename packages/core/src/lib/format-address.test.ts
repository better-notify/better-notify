import { describe, expect, it } from 'vitest';
import { formatAddress } from './format-address.js';

describe('formatAddress', () => {
  it('returns a bare-string address unchanged', () => {
    expect(formatAddress('hello@example.com')).toBe('hello@example.com');
  });

  it('formats RFC 5322 mailbox when name is set', () => {
    expect(formatAddress({ name: 'Lucas', email: 'lucas@example.com' })).toBe(
      '"Lucas" <lucas@example.com>',
    );
  });

  it('falls back to bare email when name is missing', () => {
    expect(formatAddress({ email: 'lucas@example.com' })).toBe('lucas@example.com');
  });

  it('falls back to bare email when name is empty string', () => {
    expect(formatAddress({ name: '', email: 'lucas@example.com' })).toBe('lucas@example.com');
  });
});
