import { describe, expect, it } from 'vitest';
import { normalizeAddress } from './normalize-address.js';

describe('normalizeAddress', () => {
  it('returns a bare-string address unchanged', () => {
    expect(normalizeAddress('hello@example.com')).toBe('hello@example.com');
  });

  it('extracts email from an object with name', () => {
    expect(normalizeAddress({ name: 'Lucas', email: 'lucas@example.com' })).toBe(
      'lucas@example.com',
    );
  });

  it('extracts email from an object without name', () => {
    expect(normalizeAddress({ email: 'lucas@example.com' })).toBe('lucas@example.com');
  });
});
