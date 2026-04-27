import { describe, expect, it } from 'vitest';
import { obscureEmail } from './obscure-email.js';

describe('obscureEmail', () => {
  it('obscures the middle of the local part', () => {
    expect(obscureEmail('john.doe@example.com')).toBe('j******e@example.com');
  });

  it('fully obscures short local parts to avoid leaking the address', () => {
    expect(obscureEmail('a@example.com')).toBe('*@example.com');
    expect(obscureEmail('ab@example.com')).toBe('**@example.com');
  });

  it('partially obscures a 3-char local part', () => {
    expect(obscureEmail('abc@example.com')).toBe('a*c@example.com');
  });

  it('returns input unchanged when no @ is present', () => {
    expect(obscureEmail('not-an-email')).toBe('not-an-email');
    expect(obscureEmail('')).toBe('');
  });

  it('returns input unchanged when local or domain is empty', () => {
    expect(obscureEmail('@example.com')).toBe('@example.com');
    expect(obscureEmail('john@')).toBe('john@');
  });

  it('keeps the domain visible', () => {
    expect(obscureEmail('alice@subdomain.example.co.uk')).toBe('a***e@subdomain.example.co.uk');
  });
});
